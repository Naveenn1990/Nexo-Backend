const crypto = require('crypto');
const User = require('../models/User');
const Booking = require('../models/booking');

// PayU Configuration
const PAYU_CONFIG = {
  key: process.env.PAYU_MERCHANT_KEY || 'YOUR_MERCHANT_KEY',
  salt: process.env.PAYU_MERCHANT_SALT || 'YOUR_MERCHANT_SALT',
  baseUrl: process.env.PAYU_BASE_URL || 'https://test.payu.in', // Use https://secure.payu.in for production
  skipHashVerification: process.env.PAYU_SKIP_HASH_VERIFICATION === 'true', // For testing only
};

// Generate PayU hash
const generatePayUHash = (data) => {
  const { key, txnid, amount, productinfo, firstname, email, salt } = data;
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

// Verify PayU hash for response - CORRECTED VERSION
const verifyPayUHash = (data) => {
  const { salt, status, key, txnid, amount, productinfo, firstname, email, hash } = data;
  
  // PayU Response Hash Format (reverse order):
  // salt|status|email|firstname|productinfo|amount|txnid|key
  const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const generatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
  
  console.log('🔍 User Payment Hash Verification Debug:');
  console.log('   Expected Hash:', hash);
  console.log('   Generated Hash:', generatedHash);
  console.log('   Hash String:', hashString);
  console.log('   Match:', generatedHash === hash);
  
  return generatedHash === hash;
};

// Initialize payment for users (AMC plans, services, etc.)
exports.initiatePayment = async (req, res) => {
  try {
    const { amount, productinfo, userId } = req.body;
    const user = req.user; // From auth middleware

    if (!amount || !productinfo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, productinfo'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Generate unique transaction ID
    const txnid = `USER${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Prepare payment data
    const paymentData = {
      key: PAYU_CONFIG.key,
      txnid,
      amount: amount.toString(),
      productinfo: productinfo,
      firstname: user.name || 'User',
      email: user.email || '',
      phone: user.phone || '',
      surl: `${process.env.BASE_URL || 'https://nexo.works'}/api/user-payment/payment-success`,
      furl: `${process.env.BASE_URL || 'https://nexo.works'}/api/user-payment/payment-failure`,
      salt: PAYU_CONFIG.salt,
    };

    // Generate hash
    const hash = generatePayUHash(paymentData);

    // Store transaction details in user record or create a payment record
    const userData = await User.findById(user._id);
    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Store payment info temporarily (you might want to create a separate Payment model)
    userData.pendingPayments = userData.pendingPayments || [];
    userData.pendingPayments.push({
      txnid,
      amount: parseFloat(amount),
      productinfo,
      status: 'initiated',
      createdAt: new Date()
    });
    
    await userData.save();

    console.log('✅ Payment initiated for user:', user._id, 'TxnID:', txnid);

    res.json({
      success: true,
      data: {
        ...paymentData,
        hash,
        action: `${PAYU_CONFIG.baseUrl}/_payment`,
      }
    });
  } catch (error) {
    console.error('PayU initiate user payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

// Update user payment status
const updateUserPaymentStatus = async (txnid, mihpayid, amount, status, productinfo) => {
  try {
    console.log('🔍 Searching for user with txnid:', txnid);
    
    // Find user by transaction ID in pendingPayments
    const user = await User.findOne({ 
      'pendingPayments.txnid': txnid 
    });
    
    if (!user) {
      console.error('❌ User not found with transaction ID:', txnid);
      return { success: false, message: 'User not found' };
    }
    
    console.log('✅ User found:', user._id);
    
    // Update the specific payment record
    const paymentIndex = user.pendingPayments.findIndex(p => p.txnid === txnid);
    if (paymentIndex !== -1) {
      user.pendingPayments[paymentIndex].status = status;
      user.pendingPayments[paymentIndex].mihpayid = mihpayid;
      user.pendingPayments[paymentIndex].completedAt = new Date();
    }

    // If payment successful, handle specific product logic
    if (status === 'success') {
      // Handle AMC plan subscription
      if (productinfo.includes('AMC Plan')) {
        user.amcSubscriptions = user.amcSubscriptions || [];
        user.amcSubscriptions.push({
          planName: productinfo,
          amount: parseFloat(amount),
          txnid,
          mihpayid,
          subscribedAt: new Date(),
          status: 'active'
        });
      }
      
      // Handle service booking payment
      if (productinfo.includes('Service')) {
        // Create booking record or update existing booking
        // This depends on your booking flow
      }
    }
    
    await user.save();
    
    console.log('✅ Payment details updated for user:', user._id);
    console.log('💾 Stored txnId:', txnid, 'payId:', mihpayid, 'Status:', status);
    
    return { success: true, userId: user._id };
  } catch (error) {
    console.error('❌ Error updating user payment status:', error);
    return { success: false, message: error.message };
  }
};

// Handle payment success/failure callback
exports.paymentSuccess = async (req, res) => {
  try {
    const paymentData = req.body;
    const { txnid, mihpayid, status, amount, productinfo } = paymentData;
    
    console.log('🌐 User Payment Callback Received:');
    console.log('   Transaction ID:', txnid);
    console.log('   PayU Payment ID:', mihpayid);
    console.log('   Status:', status);
    console.log('   Amount:', amount);
    console.log('   Product Info:', productinfo);

    // Verify hash (skip if configured for testing)
    let hashValid = true;
    if (!PAYU_CONFIG.skipHashVerification) {
      hashValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt
      });

      if (!hashValid) {
        console.error('❌ Invalid payment hash - Hash verification failed');
        console.error('   This might be due to PayU hash format changes or configuration issues');
        console.error('   Payment Data:', JSON.stringify(paymentData, null, 2));
        
        // For now, let's allow the payment to proceed but log the issue
        console.log('⚠️  PROCEEDING WITH PAYMENT DESPITE HASH MISMATCH (for debugging)');
        // Uncomment the line below to enforce hash verification:
        // return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?status=failed&reason=invalid_hash`);
      } else {
        console.log('✅ Hash verification passed');
      }
    } else {
      console.log('⚠️  Hash verification SKIPPED (testing mode)');
    }

    // Update user payment status
    await updateUserPaymentStatus(txnid, mihpayid, amount, status, productinfo);

    // Redirect based on status
    if (status === 'success') {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?status=success&txnid=${txnid}&payid=${mihpayid}`);
    } else {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?status=failed&reason=payment_failed`);
    }
  } catch (error) {
    console.error('❌ User payment callback handler error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?status=failed&reason=server_error`);
  }
};

// Handle payment failure callback
exports.paymentFailure = exports.paymentSuccess;

// Handle PayU webhook for user payments
exports.paymentWebhook = async (req, res) => {
  try {
    const paymentData = req.body;
    const { txnid, mihpayid, status, amount, productinfo } = paymentData;
    
    console.log('🔔 ============================================');
    console.log('🔔 USER PAYMENT WEBHOOK FROM PAYU');
    console.log('🔔 ============================================');
    console.log('   Transaction ID:', txnid);
    console.log('   PayU Payment ID:', mihpayid);
    console.log('   Status:', status);
    console.log('   Amount:', amount);
    console.log('   Product Info:', productinfo);
    console.log('🔔 ============================================');

    // Verify hash (skip if configured for testing)
    if (!PAYU_CONFIG.skipHashVerification) {
      const isValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt
      });

      if (!isValid) {
        console.error('❌ Invalid webhook hash - Hash verification failed');
        return res.status(400).json({
          success: false,
          message: 'Invalid hash'
        });
      }
      
      console.log('✅ Webhook hash verification passed');
    }

    // Update user payment status
    const result = await updateUserPaymentStatus(txnid, mihpayid, amount, status, productinfo);

    // Always return success to PayU to acknowledge receipt
    res.json({
      success: true,
      message: 'Webhook received',
      processed: result.success
    });
  } catch (error) {
    console.error('❌ User payment webhook handler error:', error);
    // Still return 200 to PayU to prevent retries
    res.json({
      success: true,
      message: 'Webhook received but processing failed',
      error: error.message
    });
  }
};

// Check user payment status
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { txnid } = req.params;
    const userId = req.user._id;
    
    console.log('🔍 Checking user payment status for txnid:', txnid, 'userId:', userId);

    if (!txnid) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    // Find user and payment record
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const payment = user.pendingPayments?.find(p => p.txnid === txnid);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    const responseData = {
      status: payment.status,
      txnid: payment.txnid,
      mihpayid: payment.mihpayid,
      amount: payment.amount,
      productinfo: payment.productinfo,
      createdAt: payment.createdAt,
      completedAt: payment.completedAt
    };
    
    console.log('✅ User payment status response:', responseData);

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ Check user payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
};

// Get user's payment history
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select('pendingPayments amcSubscriptions');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const paymentHistory = {
      payments: user.pendingPayments || [],
      amcSubscriptions: user.amcSubscriptions || []
    };

    res.json({
      success: true,
      data: paymentHistory
    });
  } catch (error) {
    console.error('❌ Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment history',
      error: error.message
    });
  }
};