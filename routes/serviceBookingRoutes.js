const express = require('express');
const router = express.Router();
const { isAuthenticatedUser } = require('../middleware/auth');
const {
  createServiceBooking,
  handlePaymentSuccess,
  handlePaymentFailure,
  handlePaymentWebhook,
  checkPaymentStatus,
  getBookingDetails,
  getUserServiceBookings
} = require('../controllers/serviceBookingController');

/**
 * @route   POST /api/user/service-booking/create
 * @desc    Create a new service booking with PayU payment
 * @access  Private (User)
 */
router.post('/service-booking/create', isAuthenticatedUser, createServiceBooking);

/**
 * @route   POST /api/user/service-booking/create-wallet-payment
 * @desc    Create a new service booking with wallet payment only
 * @access  Private (User)
 */
router.post('/service-booking/create-wallet-payment', isAuthenticatedUser, require('../controllers/serviceBookingController').createWalletPaymentBooking);

/**
 * @route   POST /api/user/service-booking/payment/success
 * @desc    Handle PayU payment success callback
 * @access  Public (PayU callback)
 */
router.post('/service-booking/payment/success', handlePaymentSuccess);

/**
 * @route   POST /api/user/service-booking/payment/test-success
 * @desc    Test payment success callback (for debugging)
 * @access  Public (testing)
 */
router.post('/service-booking/payment/test-success', require('../controllers/serviceBookingController').testPaymentSuccess);

/**
 * @route   POST /api/user/service-booking/payment/failure
 * @desc    Handle PayU payment failure callback
 * @access  Public (PayU callback)
 */
router.post('/service-booking/payment/failure', handlePaymentFailure);

/**
 * @route   POST /api/user/service-booking/payment/webhook
 * @desc    Handle PayU webhook for server-to-server notifications
 * @access  Public (PayU webhook)
 */
router.post('/service-booking/payment/webhook', handlePaymentWebhook);

/**
 * @route   GET /api/user/service-booking/payment-status/:txnid
 * @desc    Check payment status for a transaction
 * @access  Private (User)
 */
router.get('/service-booking/payment-status/:txnid', isAuthenticatedUser, checkPaymentStatus);

/**
 * @route   GET /api/user/service-booking/:bookingId
 * @desc    Get booking details by ID
 * @access  Private (User)
 */
router.get('/service-booking/:bookingId', isAuthenticatedUser, getBookingDetails);

/**
 * @route   GET /api/user/service-bookings
 * @desc    Get all service bookings for logged-in user
 * @access  Private (User)
 */
router.get('/service-bookings', isAuthenticatedUser, getUserServiceBookings);

module.exports = router;
