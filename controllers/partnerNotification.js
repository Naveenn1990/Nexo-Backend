const Notification = require("../models/Notification");
const mongoose = require('mongoose');

exports.createNotification = async (req, res) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.params.userId,
    }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get notifications for authenticated partner
exports.getPartnerNotifications = async (req, res) => {
  try {
    const partnerId = req.partner?._id || req.params.userId;
    const notifications = await Notification.find({
      userId: partnerId,
    }).sort({ createdAt: -1 });
    
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Error getting partner notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;
    const partnerId = req.partner?._id;
    
    if (!partnerId) {
      return res.status(401).json({ success: false, error: 'Partner not authenticated' });
    }

    if (notificationId && notificationId !== 'mark-read') {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId: partnerId },
        { read: true },
        { new: true }
      );
      
      if (!notification) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }
      
      res.json({ success: true, notification });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid request. Use /notifications/mark-read for marking all' });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const partnerId = req.partner?._id;
    
    if (!partnerId) {
      return res.status(401).json({ success: false, error: 'Partner not authenticated' });
    }

    // Ensure partnerId is a valid ObjectId
    let partnerObjectId;
    try {
      partnerObjectId = mongoose.Types.ObjectId.isValid(partnerId) 
        ? new mongoose.Types.ObjectId(partnerId) 
        : partnerId;
    } catch (error) {
      console.error('Invalid partnerId format:', error);
      return res.status(400).json({ success: false, error: 'Invalid partner ID format' });
    }

    // Update all unread notifications
    const result = await Notification.updateMany(
      { userId: partnerObjectId, read: false },
      { read: true }
    );
    
    res.json({ 
      success: true, 
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};