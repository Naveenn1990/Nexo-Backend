const express = require('express');
const router = express.Router();
const {
  getCustomerBookingsPartnerWise,
  getPartnerBookingDetails,
  getBookingAnalytics
} = require('../controllers/customerBookingController');
const { adminAuth } = require('../middleware/adminAuth');

// Get customer bookings with partner-wise details
router.get('/partner-wise', adminAuth, getCustomerBookingsPartnerWise);

// Get detailed partner booking history
router.get('/partner/:partnerId/details', adminAuth, getPartnerBookingDetails);

// Get booking analytics for dashboard
router.get('/analytics', adminAuth, getBookingAnalytics);

module.exports = router;