const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/userAuth');
const userSubscriptionController = require('../controllers/userSubscriptionController');

// User routes (protected)
router.post('/initiate-payment', auth, userSubscriptionController.initiateSubscriptionPayment);
router.get('/my-subscriptions', auth, userSubscriptionController.getUserSubscriptions);
router.get('/active', auth, userSubscriptionController.getActiveSubscription);
router.put('/:subscriptionId/cancel', auth, userSubscriptionController.cancelSubscription);

// Payment callback routes (public - called by PayU)
router.post('/payment-success', userSubscriptionController.subscriptionPaymentSuccess);
router.post('/payment-failure', userSubscriptionController.subscriptionPaymentFailure);

module.exports = router;
