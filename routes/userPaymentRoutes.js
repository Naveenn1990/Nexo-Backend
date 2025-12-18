const express = require('express');
const router = express.Router();
const userPaymentController = require('../controllers/userPaymentController');
const { authenticateUser } = require('../middleware/auth');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'User Payment API is working',
    timestamp: new Date().toISOString()
  });
});

// Initialize payment (requires authentication)
router.post('/initiate-payment', authenticateUser, userPaymentController.initiatePayment);

// Payment callbacks (POST from PayU browser redirect)
router.post('/payment-success', userPaymentController.paymentSuccess);
router.post('/payment-failure', userPaymentController.paymentFailure);

// PayU Webhook (server-to-server notification)
router.post('/webhook', userPaymentController.paymentWebhook);

// Check payment status (requires authentication)
router.get('/payment-status/:txnid', authenticateUser, userPaymentController.checkPaymentStatus);

// Get payment history (requires authentication)
router.get('/payment-history', authenticateUser, userPaymentController.getPaymentHistory);

module.exports = router;