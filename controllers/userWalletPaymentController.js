const crypto = require('crypto');
const Wallet = require('../models/Wallet');
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

// Initialize wallet payment
exports.initiateWalletPayment = async (req, res) => {
  try {
    const { amount, userId } = req.body;

    if (!amount || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, userId'
      });
    }

    // Validate amount
    if (amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least ₹1'
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate unique transaction ID
    const txnid = `WALLET${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Prepare payment data (salt should NOT be included in data sent to PayU)
    const paymentData = {
      key: PAYU_CONFIG.key,
      txnid,
      amount: amount.toString(),
      productinfo: 'Wallet Top-up',
      firstname: user.name || 'User',
      email: user.email || `user${userId}@nexo.works`,
      phone: user.phone || '',
      surl: `${process.env.BASE_URL || 'https://nexo.works'}/api/user/wallet/payment-success`,
      furl: `${process.env.BASE_URL || 'https://nexo.works'}/api/user/wallet/payment-failure`,
    };

    // Generate hash (salt is used for generation but NOT sent to PayU)
    const hashData = {
      ...paymentData,
      salt: PAYU_CONFIG.salt
    };
    const hash = generatePayUHash(hashData);

    console.log('✅ Wallet payment initiated:', {
      userId,
      txnid,
      amount,
      hash: hash.substring(0, 20) + '...'
    });

    res.json({
      success: true,
      data: {
        ...paymentData,
        hash,
        action: `${PAYU_CONFIG.baseUrl}/_payment`,
      }
    });
  } catch (error) {
    console.error('❌ Wallet payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

// Handle payment success callback
exports.walletPaymentSuccess = async (req, res) => {
  try {
    const paymentData = req.body;
    const { txnid, mihpayid, status, amount, email, phone } = paymentData;
    
    console.log('🌐 ============================================');
    console.log('🌐 WALLET PAYMENT CALLBACK RECEIVED');
    console.log('🌐 ============================================');
    console.log('   Transaction ID:', txnid);
    console.log('   PayU Payment ID:', mihpayid);
    console.log('   Status:', status);
    console.log('   Amount:', amount);
    console.log('   Email:', email);
    console.log('   Phone:', phone);
    console.log('   All Data:', JSON.stringify(paymentData, null, 2));
    console.log('🌐 ============================================');

    // Verify hash (skip if configured for testing)
    if (!PAYU_CONFIG.skipHashVerification) {
      const isValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt
      });

      if (!isValid) {
        console.error('❌ Invalid payment hash');
        return res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/user/dashboard/wallet?payment=failed&reason=invalid_hash`);
      }
      
      console.log('✅ Hash verification passed');
    } else {
      console.log('⚠️  Hash verification SKIPPED (testing mode)');
    }

    // Find user by email or phone
    let user = null;
    if (email) {
      user = await User.findOne({ email });
      console.log('🔍 Searching by email:', email, '- Found:', !!user);
    }
    
    if (!user && phone) {
      user = await User.findOne({ phone });
      console.log('🔍 Searching by phone:', phone, '- Found:', !!user);
    }

    // If still not found, try to extract userId from transaction ID
    if (!user && txnid && txnid.startsWith('WALLET')) {
      console.log('🔍 Attempting to find user from transaction context...');
      // Transaction ID format: WALLET{timestamp}{random}
      // We need to find the user who initiated this transaction
      // Check recent wallet transactions or user records
    }

    if (!user) {
      console.error('❌ User not found with email:', email, 'or phone:', phone);
      console.error('❌ Available user search methods exhausted');
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/user/dashboard/wallet?payment=failed&reason=user_not_found&email=${email}&phone=${phone}`);
    }

    console.log('✅ User found:', user._id, '-', user.name);

    // Update wallet if payment successful
    if (status === 'success') {
      console.log('💰 Processing successful payment...');
      
      // Find or create wallet
      let wallet = await Wallet.findOne({ userId: user._id });
      
      if (!wallet) {
        console.log('📝 Creating new wallet for user:', user._id);
        wallet = new Wallet({
          userId: user._id,
          balance: 0,
          transactions: []
        });
      } else {
        console.log('📝 Found existing wallet with balance:', wallet.balance);
      }

      // Check if transaction already exists (prevent duplicate)
      const existingTxn = wallet.transactions.find(
        t => t.transactionId === (mihpayid || txnid)
      );

      if (existingTxn) {
        console.log('⚠️  Transaction already processed:', mihpayid || txnid);
        return res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/user/dashboard/wallet?payment=success&amount=${amount}&txnid=${txnid}&duplicate=true`);
      }

      // Add transaction
      const transaction = {
        transactionId: mihpayid || txnid,
        amount: parseFloat(amount),
        type: 'Credit',
        description: `Wallet top-up via PayU - ${mihpayid || txnid}`,
        date: new Date()
      };
      
      wallet.transactions.push(transaction);

      // Update balance
      const oldBalance = wallet.balance;
      wallet.balance += parseFloat(amount);
      
      await wallet.save();

      // 🆕 CREATE PAYMENT TRANSACTION RECORD FOR WALLET RECHARGE
      try {
        const { createUserPaymentTransaction } = require('../utils/paymentTransactionHelper');
        await createUserPaymentTransaction(
          user._id,
          parseFloat(amount),
          'wallet_recharge',
          'payu',
          mihpayid || txnid,
          {
            userName: user.name,
            userPhone: user.phone,
            userEmail: user.email,
            mihpayid: mihpayid,
            oldBalance: oldBalance,
            newBalance: wallet.balance,
            payuTransactionId: mihpayid || txnid
          }
        );
      } catch (txnError) {
        console.error('❌ Error creating wallet recharge transaction:', txnError);
        // Don't fail the main operation
      }

      console.log('✅ ============================================');
      console.log('✅ WALLET UPDATED SUCCESSFULLY');
      console.log('✅ ============================================');
      console.log('   User ID:', user._id);
      console.log('   Old Balance:', oldBalance);
      console.log('   New Balance:', wallet.balance);
      console.log('   Amount Added:', amount);
      console.log('   Transaction ID:', mihpayid || txnid);
      console.log('✅ ============================================');
      
      res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/user/dashboard/wallet?payment=success&amount=${amount}&txnid=${txnid}`);
    } else {
      console.log('❌ Payment status is not success:', status);
      res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/user/dashboard/wallet?payment=failed&reason=payment_failed&status=${status}`);
    }
  } catch (error) {
    console.error('❌ ============================================');
    console.error('❌ WALLET PAYMENT CALLBACK ERROR');
    console.error('❌ ============================================');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('❌ ============================================');
    res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/user/dashboard/wallet?payment=failed&reason=server_error&error=${encodeURIComponent(error.message)}`);
  }
};

// Handle payment failure callback
exports.walletPaymentFailure = exports.walletPaymentSuccess;

// Handle PayU webhook for wallet payments
exports.walletPaymentWebhook = async (req, res) => {
  try {
    const paymentData = req.body;
    const { txnid, mihpayid, status, amount, email, phone } = paymentData;
    
    console.log('🔔 ============================================');
    console.log('🔔 WALLET PAYMENT WEBHOOK FROM PAYU');
    console.log('🔔 ============================================');
    console.log('   Transaction ID:', txnid);
    console.log('   PayU Payment ID:', mihpayid);
    console.log('   Status:', status);
    console.log('   Amount:', amount);
    console.log('   Email:', email);
    console.log('   Phone:', phone);
    console.log('🔔 ============================================');

    // Verify hash (skip if configured for testing)
    if (!PAYU_CONFIG.skipHashVerification) {
      const isValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt
      });

      if (!isValid) {
        console.error('❌ Invalid webhook hash');
        return res.status(400).json({
          success: false,
          message: 'Invalid hash'
        });
      }
      
      console.log('✅ Webhook hash verification passed');
    } else {
      console.log('⚠️  Hash verification SKIPPED (testing mode)');
    }

    // Find user by email or phone
    let user = null;
    if (email) {
      user = await User.findOne({ email });
      console.log('🔍 Webhook - Searching by email:', email, '- Found:', !!user);
    }
    
    if (!user && phone) {
      user = await User.findOne({ phone });
      console.log('🔍 Webhook - Searching by phone:', phone, '- Found:', !!user);
    }

    if (!user) {
      console.error('❌ Webhook - User not found with email:', email, 'or phone:', phone);
      return res.json({
        success: true,
        message: 'Webhook received but user not found'
      });
    }

    console.log('✅ Webhook - User found:', user._id);

    // Update wallet if payment successful
    if (status === 'success') {
      let wallet = await Wallet.findOne({ userId: user._id });
      
      if (!wallet) {
        console.log('📝 Webhook - Creating new wallet');
        wallet = new Wallet({
          userId: user._id,
          balance: 0,
          transactions: []
        });
      }

      // Check if transaction already exists
      const existingTxn = wallet.transactions.find(
        t => t.transactionId === (mihpayid || txnid)
      );

      if (!existingTxn) {
        const oldBalance = wallet.balance;
        
        wallet.transactions.push({
          transactionId: mihpayid || txnid,
          amount: parseFloat(amount),
          type: 'Credit',
          description: `Wallet top-up via PayU - ${mihpayid || txnid}`,
          date: new Date()
        });

        wallet.balance += parseFloat(amount);
        await wallet.save();

        console.log('✅ ============================================');
        console.log('✅ WALLET UPDATED VIA WEBHOOK');
        console.log('✅ ============================================');
        console.log('   User ID:', user._id);
        console.log('   Old Balance:', oldBalance);
        console.log('   New Balance:', wallet.balance);
        console.log('   Amount Added:', amount);
        console.log('✅ ============================================');
      } else {
        console.log('ℹ️  Webhook - Transaction already processed:', mihpayid || txnid);
      }
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('❌ Wallet webhook error:', error);
    console.error('   Stack:', error.stack);
    res.json({
      success: true,
      message: 'Webhook received but processing failed',
      error: error.message
    });
  }
};

// Get wallet balance and transactions
exports.getWalletDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Find or create wallet
    let wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        transactions: []
      });
      await wallet.save();
    }

    res.json({
      success: true,
      data: {
        balance: wallet.balance,
        transactions: wallet.transactions.sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        )
      }
    });
  } catch (error) {
    console.error('❌ Get wallet details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet details',
      error: error.message
    });
  }
};

// Check wallet payment status
exports.checkWalletPaymentStatus = async (req, res) => {
  try {
    const { txnid } = req.params;

    if (!txnid) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    // Find transaction in any wallet
    const wallet = await Wallet.findOne({
      'transactions.transactionId': txnid
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = wallet.transactions.find(
      t => t.transactionId === txnid
    );

    res.json({
      success: true,
      data: {
        status: 'completed',
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date,
        description: transaction.description
      }
    });
  } catch (error) {
    console.error('❌ Check wallet payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
};
