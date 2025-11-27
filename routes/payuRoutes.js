const express = require('express');
const router = express.Router();
const payuPaymentController = require('../controllers/payuPaymentController');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'PayU API is working',
    timestamp: new Date().toISOString()
  });
});

// Initialize payment
router.post('/initiate-payment', payuPaymentController.initiatePayment);

// Payment callbacks (POST from PayU browser redirect)
router.post('/payment-success', payuPaymentController.paymentSuccess);
router.post('/payment-failure', payuPaymentController.paymentFailure);

// PayU Webhook (server-to-server notification)
router.post('/webhook', payuPaymentController.paymentWebhook);

// Check payment status
router.get('/payment-status/:txnid', payuPaymentController.checkPaymentStatus);

module.exports = router;
