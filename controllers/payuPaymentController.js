const crypto = require('crypto');
const Partner = require('../models/PartnerModel');

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

// Verify PayU hash for response
const verifyPayUHash = (data) => {
  const { salt, status, key, txnid, amount, productinfo, firstname, email, hash } = data;
  
  // PayU Response Hash Format (reverse order):
  // salt|status|||||||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
  // Since we don't use UDF fields, they are empty
  const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const generatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
  
  
  return generatedHash === hash;
};

// Shared function to update partner payment status
const updatePartnerPaymentStatus = async (txnid, mihpayid, amount, status) => {
  try {
    // Find partner by transaction ID
    console.log('🔍 Searching for partner with txnid:', txnid);
    const partner = await Partner.findOne({ 'profile.payId': txnid });
    
    if (!partner) {
      console.error('❌ Partner not found with transaction ID:', txnid);
      return { success: false, message: 'Partner not found' };
    }
    
    console.log('✅ Partner found:', partner._id);
    
    // Update payment fields
    await Partner.findByIdAndUpdate(
      partner._id,
      {
        $set: {
          'profile.txnId': txnid,
          'profile.payId': mihpayid,
          'profile.registerAmount': parseFloat(amount),
          'profile.registerdFee': status === 'success',
          'profile.paymentApproved': status === 'success',
          'onboardingProgress.step7': {
            completed: status === 'success',
            completedAt: status === 'success' ? new Date() : null
          },
          profileCompleted:status === 'success',
          profileStatus:status==="success" ? 'active':'inactive',
          'onboardingProgress.step8': {
            completed: status === 'success',
            completedAt: status === 'success' ? new Date() : null
          }
        }
      },
      { new: true }
    );
    
    console.log('✅ Payment details saved for partner:', partner._id);
    console.log('💾 Stored txnId:', txnid, 'payId:', mihpayid, 'Status:', status);
    
    return { success: true, partnerId: partner._id };
  } catch (error) {
    console.error('❌ Error updating partner payment status:', error);
    return { success: false, message: error.message };
  }
};

// Initialize payment
exports.initiatePayment = async (req, res) => {
  try {
    const { amount, phone, name, email, partnerId } = req.body;

    if (!amount || !phone || !name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, phone, name, email'
      });
    }

    // Generate unique transaction ID
    const txnid = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Prepare payment data
    const paymentData = {
      key: PAYU_CONFIG.key,
      txnid,
      amount: amount.toString(),
      productinfo: 'Partner Registration Fee',
      firstname: name,
      email,
      phone,
      surl: `${process.env.BASE_URL || 'https://nexo.works'}/api/payu/payment-success`,
      furl: `${process.env.BASE_URL || 'https://nexo.works'}/api/payu/payment-failure`,
      salt: PAYU_CONFIG.salt,
    };

    // Generate hash
    const hash = generatePayUHash(paymentData);

    // Store transaction details temporarily in profile object
    if (partnerId) {
      const partner = await Partner.findByIdAndUpdate(
        partnerId,
        {
          $set: {
            'profile.txnId': txnid, // Store transaction ID
            'profile.payId': txnid, // Also store in payId for backward compatibility
            'profile.registerAmount': amount,
            'profile.registerdFee': false, // Not yet paid
            'profile.paymentApproved': false // Not yet approved
          }
        },
        { new: true }
      );
      
      if (!partner) {
        console.error('❌ Partner not found with ID:', partnerId);
        return res.status(404).json({
          success: false,
          message: 'Partner not found'
        });
      }
      
      console.log('✅ Transaction ID stored for partner:', partnerId, 'TxnID:', txnid);
    } else {
      console.warn('⚠️  No partnerId provided, transaction not linked to partner');
    }

    res.json({
      success: true,
      data: {
        ...paymentData,
        hash,
        action: `${PAYU_CONFIG.baseUrl}/_payment`,
      }
    });
  } catch (error) {
    console.error('PayU initiate payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

// Handle payment success/failure callback (browser redirect from PayU)
exports.paymentSuccess = async (req, res) => {
  try {
    const paymentData = req.body;
    const { txnid, mihpayid, status, amount } = paymentData;
    
    console.log('🌐 Browser Redirect Callback Received:');
    console.log('   Transaction ID:', txnid);
    console.log('   PayU Payment ID:', mihpayid);
    console.log('   Status:', status);
    console.log('   Amount:', amount);

    // Verify hash (skip if configured for testing)
    if (!PAYU_CONFIG.skipHashVerification) {
      const isValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt
      });

      if (!isValid) {
        console.error('❌ Invalid payment hash - Hash verification failed');
        return res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/partner/onboard?payment=failed&reason=invalid_hash`);
      }
      
      console.log('✅ Hash verification passed');
    }

    // Update partner payment status using shared function
    await updatePartnerPaymentStatus(txnid, mihpayid, amount, status);

    // Redirect based on status
    if (status === 'success') {
      res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/partner/onboard?payment=success&txnid=${txnid}&payid=${mihpayid}`);
    } else {
      res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/partner/onboard?payment=failed&reason=payment_failed`);
    }
  } catch (error) {
    console.error('❌ Payment callback handler error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/partner/onboard?payment=failed&reason=server_error`);
  }
};

// Handle payment failure callback (same handler as success, just different route)
exports.paymentFailure = exports.paymentSuccess;

// Handle PayU webhook (server-to-server notification)
exports.paymentWebhook = async (req, res) => {
  try {
    const paymentData = req.body;
    const { txnid, mihpayid, status, amount } = paymentData;
    
    console.log('🔔 ============================================');
    console.log('🔔 WEBHOOK RECEIVED FROM PAYU');
    console.log('� =a===========================================');
    console.log('   Transaction ID:', txnid);
    console.log('   PayU Payment ID:', mihpayid);
    console.log('   Status:', status);
    console.log('   Amount:', amount);
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

    // Update partner payment status using shared function
    const result = await updatePartnerPaymentStatus(txnid, mihpayid, amount, status);

    // Always return success to PayU to acknowledge receipt
    res.json({
      success: true,
      message: 'Webhook received',
      processed: result.success
    });
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    // Still return 200 to PayU to prevent retries
    res.json({
      success: true,
      message: 'Webhook received but processing failed',
      error: error.message
    });
  }
};

// Check payment status
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { txnid } = req.params;
    console.log('🔍 Checking payment status for txnid:', txnid);

    if (!txnid) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    // Find partner by transaction ID (check both txnId and payId fields)
    // Also check if payId starts with "TXN" (transaction ID format)
    let partner = await Partner.findOne({
      $or: [
        { 'profile.txnId': txnid },
        { 'profile.payId': txnid }
      ]
    });

    console.log('📦 Partner found:', partner ? `Yes (ID: ${partner._id})` : 'No');
    
    if (!partner) {
      // Try to find by payId that starts with TXN (old format)
      partner = await Partner.findOne({
        'profile.payId': { $regex: `^${txnid}$`, $options: 'i' }
      });
      
      if (partner) {
        console.log('✅ Found partner with old payId format, migrating...');
        // Migrate: Set txnId if it's missing
        if (!partner.profile.txnId && partner.profile.payId && partner.profile.payId.startsWith('TXN')) {
          partner.profile.txnId = partner.profile.payId;
          await partner.save();
          console.log('✅ Migrated txnId for partner:', partner._id);
        }
      }
    }
    
    if (!partner) {
      // Log all partners with payId to help debug
      const allPartners = await Partner.find({ 
        $or: [
          { 'profile.payId': { $exists: true } },
          { 'profile.txnId': { $exists: true } }
        ]
      }).select('profile.payId profile.txnId _id').limit(10);
      
      console.log('💡 Available transactions (first 10):', allPartners.map(p => ({ 
        partnerId: p._id,
        payId: p.profile.payId, 
        txnId: p.profile.txnId 
      })));
      
      return res.status(404).json({
        success: false,
        message: 'Transaction not found. Payment may not have been initiated yet.',
        debug: {
          searchedTxnId: txnid,
          availableTransactions: allPartners.length,
          hint: 'Make sure payment was initiated before checking status'
        }
      });
    }

    // Determine payment status
    const isCompleted = partner.profile.registerdFee === true;
    const isApproved = partner.profile.paymentApproved === true;
    
    // Status can be: 'completed', 'pending', or 'initiated'
    let status = 'initiated'; // Payment initiated but not completed
    if (isCompleted && isApproved) {
      status = 'completed';
    } else if (isCompleted && !isApproved) {
      status = 'pending'; // Payment completed but awaiting admin approval
    }

    const responseData = {
      status,
      payId: partner.profile.payId,
      txnId: partner.profile.txnId || txnid,
      amount: partner.profile.registerAmount,
      approved: isApproved,
      registerdFee: isCompleted
    };
    
    console.log('✅ Payment status response:', responseData);

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
};
