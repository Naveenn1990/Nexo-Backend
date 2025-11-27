const Notification = require("../models/Notification");
const mongoose = require('mongoose');

// Get notifications for authenticated vendor
exports.getVendorNotifications = async (req, res) => {
  try {
    const vendorId = req.vendor?._id || req.params.vendorId;
    
    if (!vendorId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vendor ID is required' 
      });
    }

    const notifications = await Notification.find({
      userId: vendorId,
      userType: 'vendor'
    }).sort({ createdAt: -1 }).limit(100);
    
    // Format notifications to include title if not present
    const formattedNotifications = notifications.map(notif => {
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
    
    res.json({ success: true, notifications: formattedNotifications });
  } catch (error) {
    console.error('Error getting vendor notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.markVendorNotificationAsRead = async (req, res) => {
  try {
    const vendorId = req.vendor?._id;
    const { notificationId } = req.params;

    if (!vendorId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vendor ID is required' 
      });
    }

    if (notificationId) {
      // Mark single notification as read
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId: vendorId },
        { read: true, seen: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ 
          success: false, 
          message: 'Notification not found' 
        });
      }

      res.json({ success: true, message: 'Notification marked as read' });
    } else {
      // Mark all notifications as read
      await Notification.updateMany(
        { userId: vendorId, userType: 'vendor' },
        { read: true, seen: true }
      );

      res.json({ success: true, message: 'All notifications marked as read' });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

