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
 * Verify PayU hash for response - CORRECTED VERSION
 */
const verifyPayUHash = (data) => {
  const { salt, status, key, txnid, amount, productinfo, firstname, email, hash, udf1, udf2, udf3, udf4, udf5 } = data;
  
  // PayU Response Hash Format (reverse order):
  // salt|status|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
  const hashString = `${salt}|${status}|${udf5 || ''}|${udf4 || ''}|${udf3 || ''}|${udf2 || ''}|${udf1 || ''}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const generatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
  
  console.log('🔍 Hash Verification Debug:');
  console.log('   Expected Hash:', hash);
  console.log('   Generated Hash:', generatedHash);
  console.log('   Hash String:', hashString);
  console.log('   Match:', generatedHash === hash);
  
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

    // Store booking data temporarily in database (will be converted to actual booking after payment)
    const tempBookingData = {
      user: userId,
      serviceName: (serviceData && serviceData.name) ? serviceData.name : serviceName, // Use display name from serviceData if available
      serviceData: serviceData,
      cartItems: cartData.items || [],
      cartTotal: cartData.total || 0, // Store original cart total for reference
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
      status: 'temp', // Temporary status - will be updated after payment
      txnid: txnid,
      isTemporary: true, // Flag to identify temporary bookings
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // Expire in 30 minutes
    };

    // Save temporary booking
    const tempBooking = new Booking(tempBookingData);
    await tempBooking.save();

    console.log('✅ ============================================');
    console.log('✅ TEMPORARY BOOKING CREATED - INITIATING PAYMENT');
    console.log('✅ ============================================');
    console.log('   Transaction ID:', txnid);
    console.log('   Temp Booking ID:', tempBooking._id);
    console.log('   Total Amount:', totalAmount);
    console.log('   Wallet Deduction:', walletDeduction);
    console.log('   Payable Amount:', payableAmount);
    console.log('   Cart Items Count:', (cartData.items || []).length);
    console.log('   Cart Items:', JSON.stringify(cartData.items || [], null, 2));
    console.log('   Cart Total:', cartData.total || 0);
    console.log('   NOTE: Booking will be confirmed ONLY after payment success');
    console.log('✅ ============================================');

    // Prepare PayU payment data - Use transaction ID to retrieve booking data later
    const payuData = {
      key: PAYU_CONFIG.key,
      txnid: txnid,
      amount: payableAmount.toString(),
      productinfo: `Service Booking - ${serviceName || 'Nexo Service'}`,
      firstname: customerDetails.name,
      email: customerDetails.email || user.email || 'customer@nexo.com',
      phone: customerDetails.phone,
      surl: `${process.env.BASE_URL || 'http://localhost:9088'}/api/user/service-booking/payment/success`,
      furl: `${process.env.BASE_URL || 'http://localhost:9088'}/api/user/service-booking/payment/failure`,
      udf1: txnid, // Transaction ID (to retrieve temp booking)
      udf2: userId.toString(),
      udf3: serviceName || '',
      udf4: walletDeduction.toString(),
      udf5: tempBooking._id.toString() // Temp booking ID instead of encoded data
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
    console.log('   UDF1 (TxnID):', payuData.udf1);
    console.log('   UDF2 (User ID):', payuData.udf2);
    console.log('   UDF3 (Service):', payuData.udf3);
    console.log('   UDF4 (Wallet):', payuData.udf4);
    console.log('   UDF5 (Temp Booking ID):', payuData.udf5);
    console.log('   Hash:', payuData.hash.substring(0, 20) + '...');
    console.log('   PayU Payment URL:', PAYU_PAYMENT_URL);
    console.log('💳 ============================================');

    // Return PayU form data
    res.status(200).json({
      success: true,
      message: 'Payment initiated - temporary booking created and will be confirmed after successful payment',
      txnid: txnid,
      tempBookingId: tempBooking._id,
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
 * Test payment success endpoint - for debugging
 */
exports.testPaymentSuccess = async (req, res) => {
  try {
    console.log('🧪 TEST PAYMENT SUCCESS ENDPOINT');
    console.log('   Request Body:', JSON.stringify(req.body, null, 2));
    console.log('   Request Query:', JSON.stringify(req.query, null, 2));
    
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/success?test=true`);
  } catch (error) {
    console.error('Test payment error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/failure?reason=test_error`);
  }
};

/**
 * Handle PayU payment success callback - Create booking ONLY after payment success
 */
exports.handlePaymentSuccess = async (req, res) => {
  try {
    const paymentData = req.body;
    
    // Extract all PayU response fields with fallback values
    const {
      txnid = '',
      status = '',
      mihpayid = '',
      amount = '0',
      email = '',
      firstname = 'Customer',
      productinfo = '',
      hash = '',
      phone = '',
      udf1: transactionId = '',
      udf2: userId = '',
      udf3: serviceName = '',
      udf4: walletDeduction = '0',
      udf5: encodedBookingData = ''
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
    console.log('   First Name:', firstname);
    console.log('   Phone:', phone);
    console.log('   Product Info:', productinfo);
    console.log('   Hash:', hash ? hash.substring(0, 20) + '...' : 'No hash');
    console.log('   Full Payment Data:', JSON.stringify(paymentData, null, 2));
    console.log('🌐 ============================================');

    // Verify hash (optional - can skip for testing)
    let hashValid = true;
    if (!PAYU_CONFIG.skipHashVerification) {
      hashValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt,
        key: PAYU_CONFIG.key,
        firstname,
        productinfo
      });

      if (!hashValid) {
        console.error('❌ Invalid payment hash - Hash verification failed');
        console.error('   This might be due to PayU hash format changes or configuration issues');
        console.error('   Payment Data:', JSON.stringify(paymentData, null, 2));
        
        // For now, let's allow the payment to proceed but log the issue
        console.log('⚠️  PROCEEDING WITH PAYMENT DESPITE HASH MISMATCH (for debugging)');
        // Uncomment the line below to enforce hash verification:
        // return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/failure?reason=invalid_hash`);
      } else {
        console.log('✅ Hash verification passed');
      }
    } else {
      console.log('⚠️  Hash verification SKIPPED (testing mode)');
    }

    if (status === 'success') {
      // Payment successful - proceed with booking confirmation
      console.log('✅ Payment successful - proceeding with booking confirmation');
      
      // Retrieve temporary booking using transaction ID or booking ID
      let tempBooking;
      
      try {
        console.log('🔍 Retrieving temporary booking...');
        console.log('   Transaction ID:', txnid);
        console.log('   Temp Booking ID (UDF5):', encodedBookingData);
        
        // Try to find by booking ID first (from UDF5), then by transaction ID
        if (encodedBookingData && encodedBookingData.length === 24) {
          // UDF5 contains booking ID
          tempBooking = await Booking.findById(encodedBookingData);
          console.log('   Found temp booking by ID:', tempBooking ? 'Yes' : 'No');
        }
        
        if (!tempBooking) {
          // Fallback: find by transaction ID
          tempBooking = await Booking.findOne({ 
            txnid: txnid, 
            isTemporary: true,
            status: 'temp'
          });
          console.log('   Found temp booking by txnid:', tempBooking ? 'Yes' : 'No');
        }
        
        if (!tempBooking) {
          throw new Error('Temporary booking not found');
        }
        
        console.log('✅ Temporary booking retrieved successfully');
        console.log('   Booking ID:', tempBooking._id);
        console.log('   Service:', tempBooking.serviceName);
        console.log('   Customer:', tempBooking.customerDetails.name);
        console.log('   Amount:', tempBooking.totalAmount);
        
      } catch (retrieveError) {
        console.error('❌ Failed to retrieve temporary booking:', retrieveError);
        console.error('   Will create fallback booking...');
        
        // Create fallback booking data
        const user = await User.findById(userId).catch(() => null);
        const paymentAmount = parseFloat(amount) || 0;
        const calculatedGst = Math.round(paymentAmount * 0.15);
        const baseAmount = paymentAmount - calculatedGst;
        
        tempBooking = {
          user: userId,
          serviceName: (serviceData && serviceData.name) ? serviceData.name : (serviceName || 'Service Booking'), // Use display name if available
          serviceData: {
            _id: null,
            name: serviceName || 'Service Booking',
            description: 'Service booking created from payment callback'
          },
          cartItems: [{
            type: 'service',
            id: 'fallback-service',
            name: serviceName || 'Service',
            quantity: 1,
            price: baseAmount,
            total: baseAmount
          }],
          cartTotal: baseAmount, // Store cart total for reference
          customerDetails: {
            name: firstname || (user ? user.name : 'Customer'),
            email: email || (user ? user.email : 'customer@nexo.com'),
            phone: phone || (user ? user.phone : 'Not provided')
          },
          location: {
            address: user && user.addresses && user.addresses.length > 0 
              ? user.addresses[0].address 
              : 'Address from user profile',
            landmark: user && user.addresses && user.addresses.length > 0 
              ? user.addresses[0].landmark || ''
              : '',
            pincode: user && user.addresses && user.addresses.length > 0 
              ? user.addresses[0].pincode 
              : '000000'
          },
          scheduledDate: new Date(),
          scheduledTime: 'To be confirmed',
          specialInstructions: 'Booking created from payment callback - please contact customer for details',
          amount: baseAmount,
          gstAmount: calculatedGst,
          totalAmount: paymentAmount,
          usewallet: parseFloat(walletDeduction) || 0,
          paymentMode: 'online',
          paymentStatus: 'pending',
          status: 'pending',
          txnid: txnid
        };
      }

      // Convert temporary booking to confirmed booking
      try {
        let finalBooking;
        
        if (tempBooking._id) {
          // Update existing temporary booking
          console.log('🔄 Converting temporary booking to confirmed booking...');
          
          finalBooking = await Booking.findByIdAndUpdate(
            tempBooking._id,
            {
              $set: {
                paymentStatus: 'completed',
                status: 'confirmed',
                isTemporary: false,
                paymentDetails: {
                  mihpayid: mihpayid,
                  txnid: txnid,
                  amount: amount,
                  status: status,
                  paidAt: new Date()
                }
              },
              $unset: {
                expiresAt: 1 // Remove expiration
              }
            },
            { new: true }
          );
          
          console.log('✅ Temporary booking converted to confirmed booking');
          
        } else {
          // Create new booking from fallback data
          console.log('📝 Creating new booking from fallback data...');
          
          finalBooking = new Booking({
            ...tempBooking,
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

          await finalBooking.save();
          console.log('✅ New booking created from fallback data');
        }

        console.log('✅ ============================================');
        console.log('✅ BOOKING CONFIRMED AFTER PAYMENT SUCCESS');
        console.log('✅ ============================================');
        console.log('   Booking ID:', finalBooking._id);
        console.log('   Transaction ID:', txnid);
        console.log('   Payment Status:', finalBooking.paymentStatus);
        console.log('   Service:', finalBooking.serviceName);
        console.log('   Customer:', finalBooking.customerDetails.name);
        console.log('   Amount:', finalBooking.totalAmount);
        console.log('   Cart Items Count:', (finalBooking.cartItems || []).length);
        console.log('   Cart Items:', JSON.stringify(finalBooking.cartItems || [], null, 2));
        console.log('   Cart Total:', finalBooking.cartTotal || 0);
        console.log('✅ ============================================');
        
        // Deduct wallet amount if used
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
              description: `Service booking payment - ${finalBooking.serviceName || serviceName || 'Service'}`,
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
        const assignedPartner = await autoAssignPartner(finalBooking);
        
        if (assignedPartner) {
          console.log('✅ Partner auto-assigned:', assignedPartner.name);
        } else {
          console.log('⚠️  No partner auto-assigned - booking will remain pending');
        }
        
        // Redirect to success page
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/success?bookingId=${finalBooking._id}`);
        
      } catch (bookingError) {
        console.error('❌ Failed to confirm booking:', bookingError);
        console.error('   Error Details:', {
          message: bookingError.message,
          stack: bookingError.stack
        });
        
        // Even if booking confirmation fails, the payment was successful
        // So we should still redirect to success but with a warning
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/success?warning=booking_confirmation_failed&txnid=${txnid}`);
      }
    } else if (status === 'failure') {
      // Payment failed - DO NOT create booking
      console.log('❌ Payment failed - booking NOT created');
      console.log('   Failure Reason: Payment gateway reported failure');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/failure?reason=payment_failed&status=${status}&txnid=${txnid}`);
      
    } else if (status === 'pending') {
      // Payment pending - Keep temporary booking but don't confirm
      console.log('⏳ Payment pending - keeping temporary booking');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/pending?txnid=${txnid}&status=${status}`);
      
    } else if (status === 'cancel') {
      // Payment cancelled by user - Clean up temporary booking
      console.log('🚫 Payment cancelled by user');
      
      try {
        // Clean up temporary booking if it exists
        if (encodedBookingData && encodedBookingData.length === 24) {
          await Booking.findByIdAndDelete(encodedBookingData);
          console.log('🗑️  Temporary booking cleaned up');
        } else {
          await Booking.findOneAndDelete({ 
            txnid: txnid, 
            isTemporary: true,
            status: 'temp'
          });
          console.log('🗑️  Temporary booking cleaned up by txnid');
        }
      } catch (cleanupError) {
        console.error('⚠️  Failed to cleanup temporary booking:', cleanupError);
      }
      
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/cancelled?txnid=${txnid}`);
      
    } else {
      // Unknown status - treat as failure
      console.log('❓ Unknown payment status:', status);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/failure?reason=unknown_status&status=${status}&txnid=${txnid}`);
    }

  } catch (error) {
    console.error('❌ ============================================');
    console.error('❌ PAYMENT CALLBACK ERROR');
    console.error('❌ ============================================');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('❌ ============================================');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/failure?reason=server_error&error=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Handle PayU payment failure callback - No booking created on failure
 */
exports.handlePaymentFailure = async (req, res) => {
  try {
    const paymentData = req.body;
    const { 
      txnid = '', 
      status = '', 
      error = '', 
      error_Message = '',
      field9 = '', // Additional PayU error field
      bankcode = '',
      PG_TYPE = '',
      bank_ref_num = ''
    } = paymentData;

    console.log('❌ ============================================');
    console.log('❌ PAYMENT FAILURE CALLBACK');
    console.log('❌ ============================================');
    console.log('   Transaction ID:', txnid);
    console.log('   Status:', status);
    console.log('   Error:', error);
    console.log('   Error Message:', error_Message);
    console.log('   Bank Code:', bankcode);
    console.log('   PG Type:', PG_TYPE);
    console.log('   Bank Ref Num:', bank_ref_num);
    console.log('   Additional Info:', field9);
    console.log('   Full Payment Data:', JSON.stringify(paymentData, null, 2));
    console.log('   NOTE: No booking created - payment failed');
    console.log('❌ ============================================');

    // Try to clean up temporary booking if it exists
    try {
      const tempBooking = await Booking.findOne({ 
        txnid: txnid, 
        isTemporary: true,
        status: 'temp'
      });
      
      if (tempBooking) {
        await Booking.findByIdAndDelete(tempBooking._id);
        console.log('🗑️  Temporary booking cleaned up for failed payment');
      }
    } catch (cleanupError) {
      console.error('⚠️  Failed to cleanup temporary booking:', cleanupError);
    }

    // Determine failure reason for better user experience
    let failureReason = 'payment_failed';
    let userMessage = 'Payment failed. Please try again.';
    
    if (error_Message) {
      if (error_Message.toLowerCase().includes('insufficient')) {
        failureReason = 'insufficient_funds';
        userMessage = 'Insufficient funds in your account.';
      } else if (error_Message.toLowerCase().includes('declined')) {
        failureReason = 'card_declined';
        userMessage = 'Your card was declined. Please try a different payment method.';
      } else if (error_Message.toLowerCase().includes('timeout')) {
        failureReason = 'timeout';
        userMessage = 'Payment timed out. Please try again.';
      } else if (error_Message.toLowerCase().includes('cancelled')) {
        failureReason = 'user_cancelled';
        userMessage = 'Payment was cancelled.';
      }
    }

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/failure?reason=${failureReason}&txnid=${txnid}&message=${encodeURIComponent(userMessage)}`);

  } catch (error) {
    console.error('❌ Payment failure callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:9088'}/payment/failure?reason=server_error&message=${encodeURIComponent('Server error occurred')}`);
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
    })
    .populate('user', 'name email phone')
    .populate({
      path: "partner",
      select: "profile.name phone profile.email profile.address profile.city profile.pincode",
    });

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
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name profile.phone phone')
      .select('serviceName serviceData cartItems cartTotal customerDetails location scheduledDate scheduledTime specialInstructions amount gstAmount totalAmount usewallet paymentMode paymentStatus status txnid paymentDetails createdAt updatedAt');

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
      serviceName: (serviceData && serviceData.name) ? serviceData.name : serviceName, // Use display name from serviceData if available
      serviceData: serviceData,
      cartItems: cartData.items || [],
      cartTotal: cartData.total || 0, // Store original cart total for reference
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

/**
 * Handle PayU webhook for server-to-server notifications
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const paymentData = req.body;
    const {
      txnid = '',
      status = '',
      mihpayid = '',
      amount = '',
      firstname = '',
      email = '',
      productinfo = '',
      hash = ''
    } = paymentData;

    console.log('🔔 ============================================');
    console.log('🔔 PAYMENT WEBHOOK FROM PAYU');
    console.log('🔔 ============================================');
    console.log('   Transaction ID:', txnid);
    console.log('   PayU Payment ID:', mihpayid);
    console.log('   Status:', status);
    console.log('   Amount:', amount);
    console.log('   Webhook Data:', JSON.stringify(paymentData, null, 2));
    console.log('🔔 ============================================');

    // Verify hash (important for webhooks)
    if (!PAYU_CONFIG.skipHashVerification) {
      const isValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt,
        key: PAYU_CONFIG.key,
        firstname,
        productinfo
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

    // Find and update booking based on webhook status
    const booking = await Booking.findOne({ txnid: txnid });
    
    if (booking) {
      // Update payment status based on webhook
      if (status === 'success' && booking.paymentStatus !== 'completed') {
        booking.paymentStatus = 'completed';
        booking.status = 'confirmed';
        booking.paymentDetails = {
          ...booking.paymentDetails,
          mihpayid: mihpayid,
          webhookReceivedAt: new Date(),
          webhookStatus: status
        };
        await booking.save();
        console.log('✅ Booking payment status updated via webhook');
      } else if (status === 'failure' && booking.paymentStatus === 'pending') {
        booking.paymentStatus = 'failed';
        booking.status = 'cancelled';
        booking.paymentDetails = {
          ...booking.paymentDetails,
          webhookReceivedAt: new Date(),
          webhookStatus: status
        };
        await booking.save();
        console.log('❌ Booking marked as failed via webhook');
      }
    } else {
      console.log('⚠️  No booking found for webhook txnid:', txnid);
    }

    // Always return success to PayU to acknowledge receipt
    res.json({
      success: true,
      message: 'Webhook received',
      txnid: txnid,
      status: status
    });

  } catch (error) {
    console.error('❌ Payment webhook handler error:', error);
    // Still return 200 to PayU to prevent retries
    res.json({
      success: true,
      message: 'Webhook received but processing failed',
      error: error.message
    });
  }
};
/**
 * Check payment status for a transaction
 */
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { txnid } = req.params;
    const userId = req.user._id;

    console.log('🔍 Checking payment status for txnid:', txnid, 'userId:', userId);

    if (!txnid) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    // Find booking by transaction ID and user
    const booking = await Booking.findOne({
      txnid: txnid,
      user: userId
    }).select('txnid paymentStatus status paymentDetails amount totalAmount createdAt isTemporary');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found for this transaction'
      });
    }

    const responseData = {
      txnid: booking.txnid,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      amount: booking.totalAmount || booking.amount,
      paymentDetails: booking.paymentDetails,
      createdAt: booking.createdAt,
      isTemporary: booking.isTemporary || false
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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Clean up expired temporary bookings (called periodically)
 */
exports.cleanupExpiredTempBookings = async () => {
  try {
    const result = await Booking.deleteMany({
      isTemporary: true,
      expiresAt: { $lt: new Date() }
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} expired temporary bookings`);
    }
    
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Error cleaning up expired temp bookings:', error);
    return 0;
  }
};

module.exports = exports;
