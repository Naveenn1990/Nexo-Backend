const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { adminAuth } = require('../middleware/adminAuth');
const { isAuthenticatedUser } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');
const User = require('../models/User');

// Combined auth middleware that supports both admin and user
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's an admin token
    if (decoded.adminId) {
      const admin = await Admin.findById(decoded.adminId);
      if (admin) {
        req.user = { id: admin._id, role: 'admin' };
        return next();
      }
    }
    
    // Check if it's a user token
    if (decoded.userId || decoded._id || decoded.id) {
      const userId = decoded.userId || decoded._id || decoded.id;
      const user = await User.findById(userId);
      if (user) {
        req.user = { id: user._id, role: 'user' };
        return next();
      }
    }

    return res.status(401).json({ success: false, message: 'Invalid token' });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// @route   POST /api/notifications/token
// @desc    Update FCM token for a user or admin
// @access  Private
router.post('/token', authenticate, notificationController.updateFCMToken);

// @route   GET /api/notifications
// @desc    Get all notifications for a user or admin
// @access  Private
router.get('/', authenticate, notificationController.getNotifications);

// @route   PUT /api/notifications/mark-read
// @desc    Mark notifications as read
// @access  Private
router.put('/mark-read', authenticate, notificationController.markNotificationsAsRead);

// @route   PUT /api/notifications/:id/mark-read
// @desc    Mark a single notification as read
// @access  Private
router.put('/:id/mark-read', authenticate, notificationController.markNotificationAsRead);

// @route   POST /api/notifications/test
// @desc    Send a test notification (admin only)
// @access  Private (Admin)
router.post('/test', authenticate, notificationController.sendTestNotification);

router.post("/initiate-call",notificationController.initiateCall);
router.post("/end-call",notificationController.endCall);
router.post("/send-ice-candidate",notificationController.sendIceCandidate);

router.post("/send-answer",notificationController.AnswerCall);


module.exports = router;