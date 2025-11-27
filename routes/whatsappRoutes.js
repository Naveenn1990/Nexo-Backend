const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { adminAuth } = require('../middleware/adminAuth');

// All routes require admin authentication
router.post('/initialize', adminAuth, whatsappController.initialize);
router.get('/qr-code', adminAuth, whatsappController.getQRCode);
router.get('/status', adminAuth, whatsappController.getStatus);
router.post('/disconnect', adminAuth, whatsappController.disconnect);
router.post('/reconnect', adminAuth, whatsappController.reconnect);
router.post('/auto-reconnect', adminAuth, whatsappController.setAutoReconnect);
router.post('/test-message', adminAuth, whatsappController.sendTestMessage);

module.exports = router;

