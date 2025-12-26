const crypto = require('crypto');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');

// PayU Configuration
const PAYU_CONFIG = {
  key: process.env.PAYU_MERCHANT_KEY || 'YOUR_MERCHANT_KEY',
  salt: process.env.PAYU_MERCHANT_SALT || 'YOUR_MERCHANT_SALT',
  baseUrl: process.env.PAYU_BASE_URL || 'https://test.payu.in',
  skipHashVerification: process.env.PAYU_SKIP_HASH_VERIFICATION === 'true',
};

// Generate PayU hash
const generatePayUHash = (data) => {
  const { key, txnid, amount, productinfo, firstname, email, salt } = data;
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

// Verify PayU hash for response
const verifyPayUHash = (data) => {
  const { salt, status, key, txnid, amount, productinfo, firstname, email, hash } = data;
  const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const generatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
  return generatedHash === hash;
};

// Initiate subscription payment
exports.initiateSubscriptionPayment = async (req, res) => {
  try {
    const { planId, productinfo } = req.body;
    const userId = req.user._id;
    const user = req.user; // From auth middleware

    // Validate plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found or inactive'
      });
    }

    // Get user details if not from middleware
    if (!user) {
      const userData = await User.findById(userId);
      if (!userData) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    // Generate unique transaction ID
    const txnid = `SUB${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Calculate subscription dates based on plan duration
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    // Add duration based on plan settings
    const duration = plan.duration || 1;
    const durationUnit = plan.durationUnit || 'month';
    
    if (durationUnit === 'year') {
      endDate.setFullYear(endDate.getFullYear() + duration);
    } else {
      // For months, handle edge cases (e.g., Jan 31 + 1 month = Feb 28/29)
      const targetMonth = endDate.getMonth() + duration;
      endDate.setMonth(targetMonth);
      
      // If day changed due to month overflow, set to last day of previous month
      if (endDate.getDate() !== startDate.getDate()) {
        endDate.setDate(0); // Sets to last day of previous month
      }
    }

    // Create pending subscription
    const subscription = new UserSubscription({
      userId,
      planId: plan._id,
      planName: plan.name,
      planPrice: plan.price,
      startDate,
      endDate,
      status: 'pending',
      paymentStatus: 'pending',
      paymentDetails: {
        txnId: txnid,
        amount: plan.price
      }
    });

    await subscription.save();

    // Prepare payment data
    const paymentData = {
      key: PAYU_CONFIG.key,
      txnid,
      amount: plan.price.toString(),
      productinfo: `Subscription - ${plan.name}`,
      firstname: user.name || 'User',
      email: user.email || `${user.phone}@nexo.com`,
      phone: user.phone,
      surl: `${process.env.BASE_URL || 'http://localhost:9088'}/api/user/subscription/payment-success`,
      furl: `${process.env.BASE_URL || 'http://localhost:9088'}/api/user/subscription/payment-failure`,
      salt: PAYU_CONFIG.salt,
    };

    // Generate hash
    const hash = generatePayUHash(paymentData);

    console.log('✅ Subscription payment initiated:', {
      userId,
      planId: plan._id,
      planName: plan.name,
      txnid,
      amount: plan.price
    });

    res.json({
      success: true,
      data: {
        ...paymentData,
        hash,
        action: `${PAYU_CONFIG.baseUrl}/_payment`,
        subscriptionId: subscription._id
      }
    });
  } catch (error) {
    console.error('❌ Error initiating subscription payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate subscription payment',
      error: error.message
    });
  }
};

// Handle payment success
exports.subscriptionPaymentSuccess = async (req, res) => {
  try {
    const paymentData = req.body;
    const { txnid, mihpayid, status, amount } = paymentData;
    
    console.log('🌐 Subscription Payment Callback:', {
      txnid,
      mihpayid,
      status,
      amount
    });

    // Verify hash (skip if configured for testing)
    if (!PAYU_CONFIG.skipHashVerification) {
      const isValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt
      });

      if (!isValid) {
        console.error('❌ Invalid payment hash');
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?status=failed&reason=invalid_hash&type=subscription`);
      }
    }

    // Find subscription by transaction ID
    const subscription = await UserSubscription.findOne({
      'paymentDetails.txnId': txnid
    });

    if (!subscription) {
      console.error('❌ Subscription not found for txnid:', txnid);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?status=failed&reason=subscription_not_found&type=subscription`);
    }

    // Update subscription
    if (status === 'success') {
      subscription.status = 'active';
      subscription.paymentStatus = 'completed';
      subscription.paymentDetails.payId = mihpayid;
      subscription.paymentDetails.paymentDate = new Date();
      subscription.paymentDetails.paymentMethod = 'PayU';
      await subscription.save();

      console.log('✅ Subscription activated:', subscription._id);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?status=success&txnid=${txnid}&payid=${mihpayid}&type=subscription`);
    } else {
      subscription.paymentStatus = 'failed';
      await subscription.save();

      console.log('❌ Subscription payment failed:', subscription._id);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?status=failed&reason=payment_failed&type=subscription`);
    }
  } catch (error) {
    console.error('❌ Subscription payment callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?status=failed&reason=server_error&type=subscription`);
  }
};

// Handle payment failure
exports.subscriptionPaymentFailure = exports.subscriptionPaymentSuccess;

// Get user subscriptions
exports.getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user._id;

    const subscriptions = await UserSubscription.find({ userId })
      .populate('planId')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    console.error('❌ Error fetching user subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
};

// Get active subscription
exports.getActiveSubscription = async (req, res) => {
  try {
    const userId = req.user._id;

    const subscription = await UserSubscription.findOne({
      userId,
      status: 'active',
      endDate: { $gte: new Date() }
    })
      .populate('planId')
      .lean();

    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('❌ Error fetching active subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active subscription',
      error: error.message
    });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const subscription = await UserSubscription.findOne({
      _id: subscriptionId,
      userId
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (subscription.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Only active subscriptions can be cancelled'
      });
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancelReason = reason || 'User requested cancellation';
    subscription.autoRenew = false;
    await subscription.save();

    console.log('✅ Subscription cancelled:', subscriptionId);

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: subscription
    });
  } catch (error) {
    console.error('❌ Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
};

// Admin: Get all subscriptions
exports.getAllSubscriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const subscriptions = await UserSubscription.find(query)
      .populate('userId', 'name email phone')
      .populate('planId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await UserSubscription.countDocuments(query);

    res.json({
      success: true,
      data: subscriptions,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    console.error('❌ Error fetching all subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
};

// Admin: Get subscription statistics
exports.getSubscriptionStats = async (req, res) => {
  try {
    const totalSubscriptions = await UserSubscription.countDocuments();
    const activeSubscriptions = await UserSubscription.countDocuments({ status: 'active' });
    const expiredSubscriptions = await UserSubscription.countDocuments({ status: 'expired' });
    const cancelledSubscriptions = await UserSubscription.countDocuments({ status: 'cancelled' });

    const totalRevenue = await UserSubscription.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$planPrice' } } }
    ]);

    const monthlyRevenue = await UserSubscription.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          'paymentDetails.paymentDate': {
            $gte: new Date(new Date().setDate(1)) // First day of current month
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$planPrice' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalSubscriptions,
        activeSubscriptions,
        expiredSubscriptions,
        cancelledSubscriptions,
        totalRevenue: totalRevenue[0]?.total || 0,
        monthlyRevenue: monthlyRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('❌ Error fetching subscription stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription statistics',
      error: error.message
    });
  }
};
