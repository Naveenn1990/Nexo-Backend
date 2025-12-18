const crypto = require('crypto');
const axios = require('axios');
const Booking = require('../models/booking');
const User = require('../models/User');
const SubService = require('../models/SubService');
const Partner = require('../models/PartnerModel');
const Wallet = require('../models/Wallet');

// PayU configuration - Using same config as wallet payment
const PAYU_CONFIG = {
  key: process.env.PAYU_MERCHANT_KEY,
  salt: process.env.PAYU_MERCHANT_SALT,
  baseUrl: process.env.PAYU_BASE_URL || 'https://secure.payu.in',
  apiUrl: 'https://api.payu.in',
  mode: process.env.PAYU_MODE || 'production',
  skipHashVerification: process.env.PAYU_SKIP_HASH_VERIFICATION === 'true'
};

// PayU payment URL
const PAYU_PAYMENT_URL = `${PAYU_CONFIG.baseUrl}/_payment`;

/**
 * Generate PayU hash - Correct formula with UDF fields
 */
const generatePayUHash = (data) => {
  const { key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, salt } = data;
  // PayU hash formula: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1 || ''}|${udf2 || ''}|${udf3 || ''}|${udf4 || ''}|${udf5 || ''}||||||${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

/**
 * Verify PayU hash for response
 */
const verifyPayUHash = (data) => {
  const { salt, status, key, txnid, amount, productinfo, firstname, email, hash, udf1, udf2, udf3, udf4, udf5 } = data;
  const hashString = `${salt}|${status}|||||||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const generatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
  return generatedHash === hash;
};

/**
 * Auto-assign partner based on pincode and service availability
 */
const autoAssignPartner = async (booking) => {
  try {
    console.log('🔍 ============================================');
    console.log('🔍 AUTO-ASSIGNING PARTNER');
    console.log('🔍 ============================================');
    console.log('   Booking ID:', booking._id);
    console.log('   Service:', booking.serviceName);
    console.log('   Pincode:', booking.location?.pincode);
    
    const pincode = booking.location?.pincode;
    
    if (!pincode) {
      console.log('⚠️  No pincode provided - skipping auto-assignment');
      return null;
    }

    // Find active partners who service this pincode
    const eligiblePartners = await Partner.find({
      isActive: true,
      isApproved: true,
      'serviceHubs.pinCodes': pincode
    }).select('_id name email phone serviceHubs');

    console.log(`   Found ${eligiblePartners.length} eligible partners for pincode ${pincode}`);

    if (eligiblePartners.length === 0) {
      console.log('⚠️  No partners available for this pincode');
      return null;
    }

    // Filter partners who have the specific service in their hub
    // For now, assign the first available partner
    // TODO: Implement more sophisticated logic (load balancing, ratings, etc.)
    const assignedPartner = eligiblePartners[0];

    // Update booking with assigned partner
    booking.partner = assignedPartner._id;
    booking.status = 'confirmed'; // Change status to confirmed when partner is assigned
    await booking.save();

    console.log('✅ ============================================');
    console.log('✅ PARTNER AUTO-ASSIGNED');
    console.log('✅ ============================================');
    console.log('   Partner ID:', assignedPartner._id);
    console.log('   Partner Name:', assignedPartner.name);
    console.log('   Partner Email:', assignedPartner.email);
    console.log('   Partner Phone:', assignedPartner.phone);
    console.log('✅ ============================================');

    // TODO: Send notification to partner about new booking
    // TODO: Send notification to user about partner assignment

    return assignedPartner;
  } catch (error) {
    console.error('❌ Error in auto-assignment:', error);
    return null;
  }
};

/**
 * Create service booking with PayU payment
 */
exports.createServiceBooking = async (req, res) => {
  try {
    // Validate PayU configuration
    if (!PAYU_CONFIG.key || !PAYU_CONFIG.salt) {
      console.error('❌ PayU credentials not configured!');
      return res.status(500).json({
        success: false,
        message: 'Payment gateway not configured. Please contact support.'
      });
    }

    const {
      userId,
      serviceName,
      serviceData,
      cartData,
      customerDetails,
      address,
      scheduledDate,
      scheduledTime,
      specialInstructions,
      amount,
      useWallet,
      walletAmount
    } = req.body;

    // Validation
    if (!userId || !cartData || !customerDetails || !address || !scheduledDate || !scheduledTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate total amount with GST
    const subtotal = amount || cartData.total || 0;
    const gstAmount = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + gstAmount;
    
    // Calculate amount after wallet deduction
    const walletDeduction = useWallet && walletAmount ? parseFloat(walletAmount) : 0;
    const payableAmount = Math.max(0, totalAmount - walletDeduction);

    // Generate unique transaction ID
    const txnid = `TXN${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Store booking data temporarily (will be created after payment success)
    const bookingData = {
      user: userId,
      serviceName: serviceName,
      serviceData: serviceData,
      cartItems: cartData.items || [],
      customerDetails: {
        name: customerDetails.name,
        email: customerDetails.email || user.email,
        phone: customerDetails.phone
      },
      location: {
        address: address.address,
        landmark: address.landmark || '',
        pincode: address.pincode
      },
      scheduledDate: new Date(scheduledDate),
      scheduledTime: scheduledTime,
      specialInstructions: specialInstructions || '',
      amount: subtotal,
      gstAmount: gstAmount,
      totalAmount: totalAmount,
      usewallet: walletDeduction,
      paymentMode: 'online',
      paymentStatus: 'pending',
      status: 'pending',
      txnid: txnid
    };

    console.log('✅ ============================================');
    console.log('✅ BOOKING DATA PREPARED - INITIATING PAYMENT');
    console.log('✅ ============================================');
    console.log('   Transaction ID:', txnid);
    console.log('   Total Amount:', totalAmount);
    console.log('   Wallet Deduction:', walletDeduction);
    console.log('   Payable Amount:', payableAmount);
    console.log('   NOTE: Booking will be created ONLY after payment success');
    console.log('✅ ============================================');

    // Prepare PayU payment data - Same format as wallet payment
    // Store booking data in UDF5 as JSON (will be used to create booking after payment)
    const payuData = {
      key: PAYU_CONFIG.key,
      txnid: txnid,
      amount: payableAmount.toString(),
      productinfo: `Service Booking - ${serviceName || 'Nexo Service'}`,
      firstname: customerDetails.name,
      email: customerDetails.email || user.email || 'customer@nexo.com',
      phone: customerDetails.phone,
      surl: `${process.env.BASE_URL || 'https://nexo.works'}/api/user/service-booking/payment/success`,
      furl: `${process.env.BASE_URL || 'https://nexo.works'}/api/user/service-booking/payment/failure`,
      udf1: txnid, // Transaction ID (since booking doesn't exist yet)
      udf2: userId.toString(),
      udf3: serviceName || '',
      udf4: walletDeduction.toString(),
      udf5: Buffer.from(JSON.stringify(bookingData)).toString('base64') // Encoded booking data
    };

    // Generate hash (salt is used for generation but NOT sent to PayU)
    const hashData = {
      ...payuData,
      salt: PAYU_CONFIG.salt
    };
    
    // Log hash generation details
    console.log('🔐 ============================================');
    console.log('🔐 HASH GENERATION (WITH UDF FIELDS)');
    console.log('🔐 ============================================');
    console.log('   Key:', hashData.key);
    console.log('   TxnID:', hashData.txnid);
    console.log('   Amount:', hashData.amount);
    console.log('   Product Info:', hashData.productinfo);
    console.log('   First Name:', hashData.firstname);
    console.log('   Email:', hashData.email);
    console.log('   UDF1:', hashData.udf1);
    console.log('   UDF2:', hashData.udf2);
    console.log('   UDF3:', hashData.udf3);
    console.log('   UDF4:', hashData.udf4);
    console.log('   UDF5:', hashData.udf5);
    console.log('   Salt:', hashData.salt.substring(0, 10) + '...');
    
    // Correct hash string with UDF fields
    const hashString = `${hashData.key}|${hashData.txnid}|${hashData.amount}|${hashData.productinfo}|${hashData.firstname}|${hashData.email}|${hashData.udf1 || ''}|${hashData.udf2 || ''}|${hashData.udf3 || ''}|${hashData.udf4 || ''}|${hashData.udf5 || ''}||||||${hashData.salt}`;
    console.log('   Hash String:', hashString);
    
    payuData.hash = generatePayUHash(hashData);
    console.log('   Generated Hash:', payuData.hash.substring(0, 20) + '...');
    console.log('🔐 ============================================');

    console.log('💳 ============================================');
    console.log('💳 PAYU PAYMENT DATA');
    console.log('💳 ============================================');
    console.log('   Merchant Key:', PAYU_CONFIG.key);
    console.log('   Transaction ID:', payuData.txnid);
    console.log('   Amount:', payuData.amount);
    console.log('   Product Info:', payuData.productinfo);
    console.log('   Customer Name:', payuData.firstname);
    console.log('   Customer Email:', payuData.email);
    console.log('   Customer Phone:', payuData.phone);
    console.log('   Success URL:', payuData.surl);
    console.log('   Failure URL:', payuData.furl);
    console.log('   UDF1 (Booking ID):', payuData.udf1);
    console.log('   UDF2 (User ID):', payuData.udf2);
    console.log('   UDF4 (Wallet):', payuData.udf4);
    console.log('   Hash:', payuData.hash.substring(0, 20) + '...');
    console.log('   PayU Payment URL:', PAYU_PAYMENT_URL);
    console.log('   PayU API URL:', PAYU_CONFIG.apiUrl);
    console.log('💳 ============================================');

    // Return PayU form data - Same format as wallet payment
    res.status(200).json({
      success: true,
      message: 'Payment initiated - booking will be created after successful payment',
      txnid: txnid,
      payuData: {
        action: PAYU_PAYMENT_URL,
        params: payuData
      }
    });

  } catch (error) {
    console.error('Service booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Handle PayU payment success callback - Create booking ONLY after payment success
 */
exports.handlePaymentSuccess = async (req, res) => {
  try {
    const paymentData = req.body;
    const {
      txnid,
      status,
      mihpayid,
      amount,
      email,
      udf1: transactionId,
      udf2: userId,
      udf3: serviceName,
      udf4: walletDeduction,
      udf5: encodedBookingData
    } = paymentData;

    console.log('🌐 ============================================');
    console.log('🌐 SERVICE BOOKING PAYMENT CALLBACK');
    console.log('🌐 ============================================');
    console.log('   Transaction ID:', txnid);
    console.log('   PayU Payment ID:', mihpayid);
    console.log('   Status:', status);
    console.log('   Amount:', amount);
    console.log('   User ID:', userId);
    console.log('   Service Name:', serviceName);
    console.log('   Wallet Deduction:', walletDeduction);
    console.log('   Email:', email);
    console.log('🌐 ============================================');

    // Verify hash (optional - can skip for testing)
    if (!PAYU_CONFIG.skipHashVerification) {
      const isValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt,
        key: PAYU_CONFIG.key
      });

      if (!isValid) {
        console.error('❌ Invalid payment hash');
        return res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment/failure?reason=invalid_hash`);
      }
      
      console.log('✅ Hash verification passed');
    } else {
      console.log('⚠️  Hash verification SKIPPED (testing mode)');
    }

    if (status === 'success') {
      // Decode booking data from UDF5
      let bookingData;
      try {
        const decodedData = Buffer.from(encodedBookingData, 'base64').toString('utf-8');
        bookingData = JSON.parse(decodedData);
        console.log('✅ Booking data decoded successfully');
      } catch (decodeError) {
        console.error('❌ Failed to decode booking data:', decodeError);
        return res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment/failure?reason=invalid_booking_data`);
      }

      // Create booking ONLY after successful payment
      const booking = new Booking({
        ...bookingData,
        paymentStatus: 'completed',
        status: 'confirmed',
        paymentDetails: {
          mihpayid: mihpayid,
          txnid: txnid,
          amount: amount,
          status: status,
          paidAt: new Date()
        }
      });

      await booking.save();

      console.log('✅ ============================================');
      console.log('✅ BOOKING CREATED AFTER PAYMENT SUCCESS');
      console.log('✅ ============================================');
      console.log('   Booking ID:', booking._id);
      console.log('   Transaction ID:', txnid);
      console.log('   Payment Status:', booking.paymentStatus);
      console.log('✅ ============================================');
      
      // Deduct wallet amount if used - Same logic as wallet payment
      if (walletDeduction && parseFloat(walletDeduction) > 0) {
        const Wallet = require('../models/Wallet');
        let wallet = await Wallet.findOne({ userId: userId });
        
        if (!wallet) {
          console.log('📝 Creating new wallet for user:', userId);
          wallet = new Wallet({
            userId: userId,
            balance: 0,
            transactions: []
          });
        }
        
        if (wallet.balance >= parseFloat(walletDeduction)) {
          const oldBalance = wallet.balance;
          wallet.balance -= parseFloat(walletDeduction);
          wallet.transactions.push({
            transactionId: txnid,
            amount: parseFloat(walletDeduction),
            type: 'Debit',
            description: `Service booking payment - ${booking.serviceName || serviceName || 'Service'}`,
            date: new Date()
          });
          await wallet.save();
          
          console.log('✅ ============================================');
          console.log('✅ WALLET DEDUCTED');
          console.log('✅ ============================================');
          console.log('   User ID:', userId);
          console.log('   Old Balance:', oldBalance);
          console.log('   Deduction:', walletDeduction);
          console.log('   New Balance:', wallet.balance);
          console.log('✅ ============================================');
        } else {
          console.log('⚠️  Insufficient wallet balance for deduction');
        }
      }
      
      // Auto-assign partner based on pincode
      const assignedPartner = await autoAssignPartner(booking);
      
      if (assignedPartner) {
        console.log('✅ Partner auto-assigned:', assignedPartner.name);
      } else {
        console.log('⚠️  No partner auto-assigned - booking will remain pending');
      }
      
      // Redirect to success page
      res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment/success?bookingId=${booking._id}`);
    } else {
      // Payment failed - DO NOT create booking
      console.log('❌ Payment failed - booking NOT created');
      res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment/failure?reason=payment_failed&status=${status}`);
    }

  } catch (error) {
    console.error('❌ ============================================');
    console.error('❌ PAYMENT CALLBACK ERROR');
    console.error('❌ ============================================');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('❌ ============================================');
    res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment/failure?reason=server_error&error=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Handle PayU payment failure callback - No booking created on failure
 */
exports.handlePaymentFailure = async (req, res) => {
  try {
    const { txnid, status } = req.body;

    console.log('❌ ============================================');
    console.log('❌ PAYMENT FAILURE CALLBACK');
    console.log('❌ ============================================');
    console.log('   Transaction ID:', txnid);
    console.log('   Status:', status);
    console.log('   NOTE: No booking created - payment failed');
    console.log('❌ ============================================');

    res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment/failure?reason=payment_failed&txnid=${txnid}`);

  } catch (error) {
    console.error('Payment failure callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment/failure?reason=server_error`);
  }
};

/**
 * Get booking details
 */
exports.getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user._id;

    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId
    }).populate('user', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details'
    });
  }
};

/**
 * Get user's service bookings
 */
exports.getUserServiceBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { user: userId };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email phone');

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
};

/**
 * Create service booking with wallet payment only
 */
exports.createWalletPaymentBooking = async (req, res) => {
  try {
    const {
      userId,
      serviceName,
      serviceData,
      cartData,
      customerDetails,
      address,
      scheduledDate,
      scheduledTime,
      specialInstructions,
      amount,
      walletAmount
    } = req.body;

    // Validation
    if (!userId || !cartData || !customerDetails || !address || !scheduledDate || !scheduledTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate total amount with GST
    const subtotal = amount || cartData.total || 0;
    const gstAmount = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + gstAmount;
    
    // Verify wallet balance
    const Wallet = require('../models/Wallet');
    const wallet = await Wallet.findOne({ userId: userId });
    
    if (!wallet || wallet.balance < totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Generate unique transaction ID
    const txnid = `WALLET${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Create booking record
    const booking = new Booking({
      user: userId,
      serviceName: serviceName,
      serviceData: serviceData,
      cartItems: cartData.items || [],
      customerDetails: {
        name: customerDetails.name,
        email: customerDetails.email || user.email,
        phone: customerDetails.phone
      },
      location: {
        address: address.address,
        landmark: address.landmark || '',
        pincode: address.pincode
      },
      scheduledDate: new Date(scheduledDate),
      scheduledTime: scheduledTime,
      specialInstructions: specialInstructions || '',
      amount: subtotal,
      gstAmount: gstAmount,
      totalAmount: totalAmount,
      usewallet: totalAmount,
      paymentMode: 'wallet',
      paymentStatus: 'completed',
      status: 'confirmed',
      txnid: txnid,
      paymentDetails: {
        txnid: txnid,
        amount: totalAmount,
        status: 'success',
        paidAt: new Date(),
        paymentMethod: 'wallet'
      }
    });

    await booking.save();

    // Deduct from wallet
    wallet.balance -= totalAmount;
    wallet.transactions.push({
      transactionId: txnid,
      amount: totalAmount,
      type: 'Debit',
      description: `Service booking - ${serviceName || 'Service'}`,
      date: new Date()
    });
    await wallet.save();

    console.log('✅ Wallet payment booking created:', booking._id);

    // Auto-assign partner based on pincode
    const assignedPartner = await autoAssignPartner(booking);
    
    if (assignedPartner) {
      console.log('✅ Partner auto-assigned:', assignedPartner.name);
    } else {
      console.log('⚠️  No partner auto-assigned - booking will remain pending');
    }

    res.status(200).json({
      success: true,
      message: 'Booking confirmed with wallet payment',
      bookingId: booking._id,
      booking: booking,
      assignedPartner: assignedPartner ? {
        id: assignedPartner._id,
        name: assignedPartner.name,
        phone: assignedPartner.phone
      } : null
    });

  } catch (error) {
    console.error('Wallet payment booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;
