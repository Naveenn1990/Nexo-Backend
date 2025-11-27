const Quotation = require('../models/Quotation');
const Booking = require('../models/booking');
const User = require('../models/User');
const Partner = require('../models/PartnerModel');
const Admin = require('../models/admin');
const Notification = require('../models/Notification');
const { sendPartnerNotification, sendAdminNotification, sendAllAdminsNotification } = require('../services/notificationService');
const firebaseAdmin = require('../config/firebase');

// Create quotation (Partner)
exports.createQuotation = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { items, subtotal, tax, discount, totalAmount, description, validTill, notes } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total amount must be greater than 0'
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate('user')
      .populate('partner');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Verify partner owns this booking
    if (booking.partner._id.toString() !== req.partner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to create quotation for this booking'
      });
    }

    // Check if booking is in valid status
    if (!['accepted', 'in_progress'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Quotation can only be created for accepted or in-progress bookings'
      });
    }

    // Validate validTill date
    const validTillDate = new Date(validTill);
    if (isNaN(validTillDate.getTime()) || validTillDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Valid till date must be in the future'
      });
    }

    // Calculate totals from items
    const calculatedSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const calculatedTotal = calculatedSubtotal + (tax || 0) - (discount || 0);

    // Create quotation
    const quotation = new Quotation({
      booking: bookingId,
      user: booking.user._id,
      partner: req.partner._id,
      items,
      subtotal: subtotal || calculatedSubtotal,
      tax: tax || 0,
      discount: discount || 0,
      totalAmount: totalAmount || calculatedTotal,
      description: description || '',
      validTill: validTillDate,
      notes: notes || '',
      customerStatus: 'pending',
      adminStatus: 'pending',
      status: 'pending'
    });

    await quotation.save();
    console.log(`[Quotation] Quotation saved with number: ${quotation.quotationNumber}`);

    // Populate quotation for response
    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone');

    // Send notifications - Admin notification is CRITICAL
    console.log('[Quotation] Starting notification process...');
    
    // Notify customer (non-blocking)
    if (booking.user && booking.user.fcmToken) {
      try {
        const notification = new Notification({
          userId: booking.user._id,
          userType: 'user',
          title: 'New Quotation Received',
          message: `You have received a new quotation for ₹${totalAmount}`,
          type: 'quotation',
          skipFcm: false
        });
        await notification.save();

        if (booking.user.fcmToken) {
          try {
            await firebaseAdmin.messaging().send({
              notification: {
                title: 'New Quotation Received',
                body: `You have received a new quotation for ₹${totalAmount}`
              },
              token: booking.user.fcmToken
            });
            console.log('[Notification] ✅ User notification sent for quotation');
          } catch (fcmError) {
            console.error('[Notification] ❌ FCM error for user:', fcmError);
          }
        }
      } catch (userNotifError) {
        console.error('[Notification] Error sending user notification:', userNotifError);
      }
    }

    // Notify admins - CRITICAL: This MUST be sent
    console.log('[Quotation] ========================================');
    console.log('[Quotation] 📢 SENDING ADMIN NOTIFICATION FOR QUOTATION');
    console.log(`[Quotation] Quotation Number: ${quotation.quotationNumber || 'GENERATING...'}`);
    console.log(`[Quotation] Partner: ${req.partner.profile?.name || req.partner.phone || 'Unknown'}`);
    console.log(`[Quotation] Amount: ₹${totalAmount}`);
    console.log(`[Quotation] Booking ID: ${booking.bookingId || booking._id.toString().slice(-8)}`);
    console.log('[Quotation] ========================================');
    
    // Send admin notification - await to ensure it completes, but don't fail the request if it errors
    try {
      const adminNotificationResult = await sendAllAdminsNotification(
        'New Quotation Created by Partner',
        `Partner ${req.partner.profile?.name || req.partner.phone || 'Unknown'} created a quotation #${quotation.quotationNumber || 'N/A'} for ₹${totalAmount} for booking #${booking.bookingId || booking._id.toString().slice(-8)}`,
        'info'
      );
      
      if (adminNotificationResult && adminNotificationResult.success) {
        console.log(`[Notification] ✅✅✅ Admin notification sent successfully!`);
        console.log(`[Notification] Sent to ${adminNotificationResult.sent || 0} admin(s) with FCM tokens`);
        console.log(`[Notification] Saved to ${adminNotificationResult.saved || 0} admin(s) database`);
        console.log(`[Notification] Total admins: ${adminNotificationResult.total || 0}`);
        console.log(`[Notification] Admins with tokens: ${adminNotificationResult.withToken || 0}`);
      } else {
        console.error(`[Notification] ⚠️ Admin notification may have failed`);
        console.error(`[Notification] Result:`, JSON.stringify(adminNotificationResult, null, 2));
      }
    } catch (adminNotifError) {
      console.error('[Notification] ❌❌❌ CRITICAL ERROR: Failed to send admin notification for quotation');
      console.error('[Notification] Error:', adminNotifError.message || adminNotifError);
      console.error('[Notification] Error stack:', adminNotifError.stack);
      // Don't fail the request, but log prominently
    }

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: populatedQuotation
    });
  } catch (error) {
    console.error('Error creating quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get quotations for a booking (Partner/Customer/Admin)
exports.getQuotationsByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const quotations = await Quotation.find({ booking: bookingId })
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone')
      .populate('adminReviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all quotations for partner
exports.getPartnerQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({ partner: req.partner._id })
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('adminReviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error) {
    console.error('Error fetching partner quotations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Customer accept quotation
exports.customerAcceptQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const userId = req.user._id;

    const quotation = await Quotation.findById(quotationId)
      .populate('booking')
      .populate('partner')
      .populate('user');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Verify user owns this quotation
    if (quotation.user._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to accept this quotation'
      });
    }

    // Check if already responded
    if (quotation.customerStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'You have already responded to this quotation'
      });
    }

    // Check if expired
    if (new Date(quotation.validTill) < new Date()) {
      quotation.status = 'expired';
      await quotation.save();
      return res.status(400).json({
        success: false,
        message: 'This quotation has expired'
      });
    }

    // Update customer status
    quotation.customerStatus = 'accepted';
    quotation.customerResponseAt = new Date();
    await quotation.save();

    // Populate for response
    const updatedQuotation = await Quotation.findById(quotation._id)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone')
      .populate('adminReviewedBy', 'name email');

    // Send notifications
    try {
      // Notify partner
      await sendPartnerNotification(
        quotation.partner._id,
        'Quotation Accepted by Customer',
        `Customer has accepted your quotation #${quotation.quotationNumber}`,
        'quotation'
      );

      // Notify admins
      await sendAllAdminsNotification(
        'Quotation Accepted by Customer',
        `Customer accepted quotation #${quotation.quotationNumber}`,
        'info'
      );
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Quotation accepted successfully',
      data: updatedQuotation
    });
  } catch (error) {
    console.error('Error accepting quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Customer reject quotation
exports.customerRejectQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const { rejectionReason } = req.body;
    const userId = req.user._id;

    const quotation = await Quotation.findById(quotationId)
      .populate('booking')
      .populate('partner')
      .populate('user');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Verify user owns this quotation
    if (quotation.user._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this quotation'
      });
    }

    // Check if already responded
    if (quotation.customerStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'You have already responded to this quotation'
      });
    }

    // Update customer status
    quotation.customerStatus = 'rejected';
    quotation.customerRejectionReason = rejectionReason || '';
    quotation.customerResponseAt = new Date();
    await quotation.save();

    // Populate for response
    const updatedQuotation = await Quotation.findById(quotation._id)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone')
      .populate('adminReviewedBy', 'name email');

    // Send notifications
    try {
      // Notify partner
      if (quotation.partner.fcmToken) {
        await sendNotification(
          quotation.partner.fcmToken,
          'Quotation Rejected by Customer',
          `Customer has rejected your quotation #${quotation.quotationNumber}`,
          { type: 'quotation', quotationId: quotation._id }
        );
      }

      // Notify admins
      const admins = await Admin.find({}).select('fcmToken');
      admins.forEach(async (admin) => {
        if (admin.fcmToken) {
          await sendNotification(
            admin.fcmToken,
            'Quotation Rejected by Customer',
            `Customer rejected quotation #${quotation.quotationNumber}`,
            { type: 'quotation', quotationId: quotation._id }
          );
        }
      });
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Quotation rejected successfully',
      data: updatedQuotation
    });
  } catch (error) {
    console.error('Error rejecting quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Admin accept quotation
exports.adminAcceptQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const adminId = req.admin._id;

    const quotation = await Quotation.findById(quotationId)
      .populate('booking')
      .populate('partner')
      .populate('user');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if already responded
    if (quotation.adminStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This quotation has already been reviewed by admin'
      });
    }

    // Check if expired
    if (new Date(quotation.validTill) < new Date()) {
      quotation.status = 'expired';
      await quotation.save();
      return res.status(400).json({
        success: false,
        message: 'This quotation has expired'
      });
    }

    // Update admin status
    quotation.adminStatus = 'accepted';
    quotation.adminResponseAt = new Date();
    quotation.adminReviewedBy = adminId;
    await quotation.save();

    // Populate for response
    const updatedQuotation = await Quotation.findById(quotation._id)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone')
      .populate('adminReviewedBy', 'name email');

    // Send notifications
    try {
      // Notify customer
      if (quotation.user.fcmToken) {
        const notification = new Notification({
          userId: quotation.user._id,
          userType: 'user',
          title: 'Quotation Approved by Admin',
          message: `Your quotation #${quotation.quotationNumber} has been approved`,
          type: 'quotation',
          skipFcm: false
        });
        await notification.save();

        if (quotation.user.fcmToken) {
          try {
            await firebaseAdmin.messaging().send({
              notification: {
                title: 'Quotation Approved by Admin',
                body: `Your quotation #${quotation.quotationNumber} has been approved`
              },
              token: quotation.user.fcmToken
            });
            console.log('[Notification] User notification sent for admin approval');
          } catch (fcmError) {
            console.error('[Notification] FCM error for user:', fcmError);
          }
        }
      }

      // Notify partner
      await sendPartnerNotification(
        quotation.partner._id,
        'Quotation Approved by Admin',
        `Your quotation #${quotation.quotationNumber} has been approved`,
        'quotation'
      );
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Quotation approved successfully',
      data: updatedQuotation
    });
  } catch (error) {
    console.error('Error approving quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Admin reject quotation
exports.adminRejectQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.admin._id;

    const quotation = await Quotation.findById(quotationId)
      .populate('booking')
      .populate('partner')
      .populate('user');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if already responded
    if (quotation.adminStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This quotation has already been reviewed by admin'
      });
    }

    // Update admin status
    quotation.adminStatus = 'rejected';
    quotation.adminRejectionReason = rejectionReason || '';
    quotation.adminResponseAt = new Date();
    quotation.adminReviewedBy = adminId;
    await quotation.save();

    // Populate for response
    const updatedQuotation = await Quotation.findById(quotation._id)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone')
      .populate('adminReviewedBy', 'name email');

    // Send notifications
    try {
      // Notify customer
      if (quotation.user.fcmToken) {
        const notification = new Notification({
          userId: quotation.user._id,
          userType: 'user',
          title: 'Quotation Rejected by Admin',
          message: `Your quotation #${quotation.quotationNumber} has been rejected`,
          type: 'quotation',
          skipFcm: false
        });
        await notification.save();

        if (quotation.user.fcmToken) {
          try {
            await firebaseAdmin.messaging().send({
              notification: {
                title: 'Quotation Rejected by Admin',
                body: `Your quotation #${quotation.quotationNumber} has been rejected`
              },
              token: quotation.user.fcmToken
            });
            console.log('[Notification] User notification sent for admin rejection');
          } catch (fcmError) {
            console.error('[Notification] FCM error for user:', fcmError);
          }
        }
      }

      // Notify partner
      await sendPartnerNotification(
        quotation.partner._id,
        'Quotation Rejected by Admin',
        `Your quotation #${quotation.quotationNumber} has been rejected`,
        'quotation'
      );
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Quotation rejected successfully',
      data: updatedQuotation
    });
  } catch (error) {
    console.error('Error rejecting quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all quotations (Admin)
exports.getAllQuotations = async (req, res) => {
  try {
    const { status, customerStatus, adminStatus } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (customerStatus) filter.customerStatus = customerStatus;
    if (adminStatus) filter.adminStatus = adminStatus;

    const quotations = await Quotation.find(filter)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone')
      .populate('adminReviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single quotation details
exports.getQuotationById = async (req, res) => {
  try {
    const { quotationId } = req.params;

    const quotation = await Quotation.findById(quotationId)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone')
      .populate('adminReviewedBy', 'name email');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (error) {
    console.error('Error fetching quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

