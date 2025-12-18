const express = require('express');
const router = express.Router();
const userWalletPaymentController = require('../controllers/userWalletPaymentController');
const { auth } = require('../middleware/userAuth');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'User Wallet Payment API is working',
    timestamp: new Date().toISOString()
  });
});

// Get wallet details (protected)
router.get('/:userId', auth, userWalletPaymentController.getWalletDetails);

// Initialize wallet payment (protected)
router.post('/initiate-payment', auth, userWalletPaymentController.initiateWalletPayment);

// Payment callbacks (POST from PayU browser redirect)
router.post('/payment-success', userWalletPaymentController.walletPaymentSuccess);
router.post('/payment-failure', userWalletPaymentController.walletPaymentFailure);

// PayU Webhook (server-to-server notification)
router.post('/webhook', userWalletPaymentController.walletPaymentWebhook);

// Check payment status (protected)
router.get('/payment-status/:txnid', auth, userWalletPaymentController.checkWalletPaymentStatus);

module.exports = router;
