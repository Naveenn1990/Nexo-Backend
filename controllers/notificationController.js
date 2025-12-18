const User = require('../models/User');
const Admin = require('../models/admin');
const admin = require('../config/firebase');
const Partner = require("../models/PartnerModel");
const callTimers = new Map();
const calls = new Map(); // { callId: { callerId, receiverId, status } }

const updateFCMToken = async (req, res) => {
  try {
    const { fcmToken, isAdmin } = req.body;
    const userId = req.user.id;

    if (isAdmin) {
      await Admin.findByIdAndUpdate(userId, { fcmToken });
    } else {
      await User.findByIdAndUpdate(userId, { fcmToken });
    }

    res.status(200).json({ success: true, message: 'FCM token updated' });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let user;
    if (isAdmin) {
      user = await Admin.findById(userId).select('notifications');
    } else {
      user = await User.findById(userId).select('notifications');
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if notifications array exists, if not initialize it
    if (!user.notifications || !Array.isArray(user.notifications)) {
      return res.json({ 
        success: true, 
        notifications: [] 
      });
    }

    // Format notifications to include title if not present
    const formattedNotifications = user.notifications.map(notif => {
      // If message contains title (format: "Title: Message"), split it
      if (notif.message && notif.message.includes(': ')) {
        const parts = notif.message.split(': ');
        return {
          ...notif.toObject ? notif.toObject() : notif,
          title: parts[0],
          message: parts.slice(1).join(': ')
        };
      }
      // Otherwise, use message as title if no title exists
      return {
        ...notif.toObject ? notif.toObject() : notif,
        title: notif.title || notif.message || 'Notification',
        message: notif.title ? notif.message : ''
      };
    });

    const sortedNotifications = formattedNotifications.sort(
      (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
    );

    res.status(200).json({ success: true, notifications: sortedNotifications });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (isAdmin) {
      const admin = await Admin.findById(userId);
      if (admin && admin.notifications) {
        admin.notifications.forEach(notification => {
          notification.seen = true;
          notification.read = true;
        });
        await admin.save();
      }
    } else {
      const user = await User.findById(userId);
      if (user && user.notifications) {
        user.notifications.forEach(notification => {
          notification.seen = true;
          notification.read = true;
        });
        await user.save();
      }
    }

    res.status(200).json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    const isAdmin = req.user.role === 'admin';

    if (isAdmin) {
      const admin = await Admin.findById(userId);
      if (admin && admin.notifications) {
        const notification = admin.notifications.id(notificationId);
        if (notification) {
          notification.seen = true;
          notification.read = true;
          await admin.save();
        } else {
          return res.status(404).json({ success: false, message: 'Notification not found' });
        }
      } else {
        return res.status(404).json({ success: false, message: 'Admin or notifications not found' });
      }
    } else {
      const user = await User.findById(userId);
      if (user && user.notifications) {
        const notification = user.notifications.id(notificationId);
        if (notification) {
          notification.seen = true;
          notification.read = true;
          await user.save();
        } else {
          return res.status(404).json({ success: false, message: 'Notification not found' });
        }
      } else {
        return res.status(404).json({ success: false, message: 'User or notifications not found' });
      }
    }

    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const sendTestNotification = async (req, res) => {
  try {
    const { userId, isAdmin } = req.body;
    const senderId = req.user.id;

    let user;
    if (isAdmin) {
      user = await Admin.findById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'User has no FCM token. Please ensure notifications are enabled and the user is logged in.',
        userId: userId,
        isAdmin: isAdmin
      });
    }

    const iconUrl = 'https://nexo.works/android-chrome-192x192.png';
    const message = {
      notification: {
        title: 'Test Notification',
        body: 'This is a test notification from the server',
        icon: iconUrl
      },
      data: {
        type: 'test_notification',
        senderId: senderId.toString(),
        title: 'Test Notification',
        message: 'This is a test notification from the server',
        icon: iconUrl,
        timestamp: new Date().toISOString()
      },
      token: user.fcmToken,
      webpush: {
        notification: {
          icon: iconUrl,
          badge: iconUrl,
          sound: 'default', // Play default notification sound
          requireInteraction: false,
          silent: false // Ensure sound plays
        },
        fcmOptions: {
          link: '/'
        }
      },
      android: {
        priority: 'high',
        ttl: 86400
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            sound: 'default'
          }
        },
        headers: {
          'apns-priority': '10'
        }
      }
    };

    try {
      const result = await admin.messaging().send(message);
      res.status(200).json({ 
        success: true, 
        message: 'Test notification sent',
        messageId: result
      });
    } catch (fcmError) {
      console.error('FCM send error:', fcmError);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send FCM notification',
        error: fcmError.message 
      });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};




const initiateCall = async (req, res) => {
  try {
    const { callerId, receiverId, callId, isUser, offer } = req.body;

    // Validate caller and receiver
    const partner = isUser ? await User.findById(receiverId) : await Partner.findById(receiverId);
    if (!partner) {
      throw new Error('Receiver not found');
    }

    // Store call state
    calls.set(callId, { callerId, receiverId, status: 'pending' });

    // Send FCM notification
    const message = {
      notification: {
        title: 'Incoming Call',
        body: `Call from ${callerId}`,
      },
      data: {
        callId,
        callerId,
        receiverId,
        type: 'call',
        offer: JSON.stringify(offer),
      },
      token: isUser ? partner.fcmToken : partner.fcmtoken,
    };

    await admin.messaging().send(message);
    res.json({ success: true });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const AnswerCall=async(req,res)=>{
  try {
    const { callId, senderId, receiverId, answer } = req.body;

    // Validate call
    const call = calls.get(callId);
    if (!call || call.status !== 'pending') {
      throw new Error('Invalid or non-pending call');
    }

    // Find receiver (caller)
    const receiver = await User.findById(receiverId) || await Partner.findById(receiverId);
    if (!receiver) {
      throw new Error('Receiver not found');
    }

    // Update call state
    call.status = 'active';
    calls.set(callId, call);

    // Send FCM notification
    const message = {
      data: {
        callId,
        callerId: receiverId,
        receiverId: senderId,
        type: 'call_answer',
        answer: JSON.stringify(answer),
      },
      token: receiver.fcmToken || receiver.fcmtoken,
    };

    await admin.messaging().send(message);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending answer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

const sendIceCandidate=async(req,res)=>{
  try {
    const { callId, senderId, receiverId, candidate } = req.body;

    // Validate call
    const call = calls.get(callId);
    if (!call) {
      throw new Error('Invalid call');
    }

    // Find receiver
    const receiver = await User.findById(receiverId) || await Partner.findById(receiverId);
    if (!receiver) {
      throw new Error('Receiver not found');
    }

    // Send FCM notification
    const message = {
      data: {
        callId,
        callerId: receiverId,
        receiverId: senderId,
        type: 'ice_candidate',
        candidate: JSON.stringify(candidate),
      },
      token: receiver.fcmToken || receiver.fcmtoken,
    };

    await admin.messaging().send(message);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending ICE candidate:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

const endCall = async (req, res) => {
  try {
    const { callId, senderId, receiverId } = req.body;

    // Validate call
    const call = calls.get(callId);
    if (!call) {
      throw new Error('Invalid call');
    }

    // Find receiver
    const receiver = await User.findById(receiverId) || await Partner.findById(receiverId);
    if (!receiver) {
      throw new Error('Receiver not found');
    }

    // Update call state
    call.status = 'ended';
    calls.set(callId, call);

    // Send FCM notification
    const message = {
      data: {
        callId,
        callerId: receiverId,
        receiverId: senderId,
        type: 'call_ended',
      },
      token: receiver.fcmToken || receiver.fcmtoken,
    };

    await admin.messaging().send(message);

    // Clean up
    calls.delete(callId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  updateFCMToken,
  getNotifications,
  markNotificationsAsRead,
  markNotificationAsRead,
  sendTestNotification,
  initiateCall,
  endCall,
  AnswerCall,
  sendIceCandidate
};