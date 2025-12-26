const Quotation = require('../models/Quotation');
const Booking = require('../models/booking');
const User = require('../models/User');
const Partner = require('../models/PartnerModel');
const Admin = require('../models/admin');
const Notification = require('../models/Notification');
const { sendPartnerNotification, sendAdminNotification, sendAllAdminsNotification } = require('../services/notificationService');
const { sendMaterialQuotationNotifications } = require('../services/materialNotificationService');
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

// Submit material quotation request (Public endpoint)
exports.submitMaterialQuotationRequest = async (req, res) => {
  try {
    const { 
      name, phone, email, requirements, category, brandPreference, 
      // New customer and technician details
      customerName, customerPhone, customerEmail, customerAddress,
      technicianName, technicianPhone, technicianId, serviceType,
      urgency, notes, selectedItems, totalAmount,
      type = 'material' 
    } = req.body;

    console.log('📋 ============================================');
    console.log('📋 ENHANCED MATERIAL QUOTATION REQUEST');
    console.log('📋 ============================================');
    console.log('   Partner Name:', name);
    console.log('   Partner Phone:', phone);
    console.log('   Customer Name:', customerName);
    console.log('   Customer Phone:', customerPhone);
    console.log('   Technician Name:', technicianName);
    console.log('   Service Type:', serviceType);
    console.log('   Urgency:', urgency);
    console.log('   Total Amount:', totalAmount);
    console.log('   Selected Items:', selectedItems ? Object.keys(selectedItems).length : 0, 'categories');
    console.log('📋 ============================================');

    // Enhanced validation
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Partner name and phone are required'
      });
    }

    if (!customerName || !customerPhone || !customerAddress) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, phone, and address are required'
      });
    }

    if (!technicianName || !technicianPhone) {
      return res.status(400).json({
        success: false,
        message: 'Technician name and phone are required'
      });
    }

    if (!serviceType) {
      return res.status(400).json({
        success: false,
        message: 'Service type is required'
      });
    }

    // Create enhanced material quotation request
    const materialRequest = {
      type: 'material_quotation',
      // Partner details
      partnerName: name.trim(),
      partnerPhone: phone.trim(),
      partnerEmail: email?.trim() || '',
      // Customer details
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail?.trim() || '',
      customerAddress: customerAddress.trim(),
      // Technician details
      technicianName: technicianName.trim(),
      technicianPhone: technicianPhone.trim(),
      technicianId: technicianId?.trim() || '',
      // Service details
      serviceType: serviceType,
      urgency: urgency || 'normal',
      category: category || 'general',
      brandPreference: brandPreference?.trim() || '',
      requirements: requirements?.trim() || '',
      notes: notes?.trim() || '',
      selectedItems: selectedItems || {},
      totalAmount: totalAmount || 0,
      requestId: `MQ-${Date.now()}`,
      createdAt: new Date()
    };

    // Enhanced admin notification
    try {
      const urgencyText = urgency === 'emergency' ? '🚨 EMERGENCY' : urgency === 'urgent' ? '⚡ URGENT' : '📋 NORMAL';
      const brandText = brandPreference ? ` (Brand: ${brandPreference})` : '';
      const amountText = totalAmount ? ` - Est. ₹${totalAmount.toLocaleString('en-IN')}` : '';
      
      const adminNotificationResult = await sendAllAdminsNotification(
        `${urgencyText} Material Quotation Request`,
        `Partner: ${name} | Customer: ${customerName} (${customerPhone}) | Technician: ${technicianName} | Service: ${serviceType}${amountText}${brandText}`,
        urgency === 'emergency' ? 'urgent' : 'info'
      );
      
      if (adminNotificationResult && adminNotificationResult.success) {
        console.log(`[Notification] ✅ Enhanced material quotation notification sent to ${adminNotificationResult.sent || 0} admin(s)`);
      } else {
        console.error(`[Notification] ⚠️ Enhanced material quotation notification may have failed`);
      }
    } catch (adminNotifError) {
      console.error('[Notification] ❌ Failed to send admin notification for material quotation');
      console.error('[Notification] Error:', adminNotifError.message || adminNotifError);
    }

    // Save enhanced notification to database
    try {
      const admins = await Admin.find({});
      
      for (const admin of admins) {
        const notification = new Notification({
          userId: admin._id,
          userType: 'admin',
          title: `${urgency === 'emergency' ? '🚨 EMERGENCY' : urgency === 'urgent' ? '⚡ URGENT' : '📋'} Material Quotation Request`,
          message: `Partner: ${name} | Customer: ${customerName} | Technician: ${technicianName} | Service: ${serviceType}${amountText}`,
          type: 'material_quotation',
          data: JSON.stringify(materialRequest),
          skipFcm: true // Already sent via sendAllAdminsNotification
        });
        await notification.save();
      }
      console.log(`[Database] ✅ Enhanced material quotation request saved to admin notifications`);
    } catch (dbError) {
      console.error('[Database] Error saving enhanced material quotation request:', dbError);
    }

    // Send comprehensive notifications to all parties
    try {
      await sendMaterialQuotationNotifications('quotation_submitted', materialRequest);
      console.log('[Notifications] ✅ Comprehensive notifications sent to all parties');
    } catch (notifError) {
      console.error('[Notifications] Error sending comprehensive notifications:', notifError);
    }

    console.log('✅ Enhanced material quotation request processed successfully');
    console.log('📋 ============================================');

    res.status(201).json({
      success: true,
      message: `Material quotation request submitted successfully. ${urgency === 'emergency' ? 'Emergency request - Admin will contact within 2 hours.' : urgency === 'urgent' ? 'Urgent request - Admin will contact within 4 hours.' : 'Our team will contact you within 24 hours.'}`,
      data: {
        requestId: materialRequest.requestId,
        customerName: customerName,
        technicianName: technicianName,
        serviceType: serviceType,
        urgency: urgency,
        estimatedAmount: totalAmount,
        status: 'submitted'
      }
    });
  } catch (error) {
    console.error('❌ Error submitting enhanced material quotation request:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting material quotation request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Admin approve material quotation (Admin endpoint)
exports.adminApproveMaterialQuotation = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { approvedAmount, deliveryDate, notes } = req.body;

    console.log('🔍 ============================================');
    console.log('🔍 ADMIN APPROVING MATERIAL QUOTATION');
    console.log('🔍 ============================================');
    console.log('   Request ID:', requestId);
    console.log('   Approved Amount:', approvedAmount);
    console.log('   Delivery Date:', deliveryDate);
    console.log('🔍 ============================================');

    // Find the original notification/request
    const notification = await Notification.findOne({
      type: 'material_quotation',
      'data': { $regex: requestId }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Material quotation request not found'
      });
    }

    const originalData = JSON.parse(notification.data);

    // Create approval data
    const approvalData = {
      ...originalData,
      status: 'approved',
      approvedAmount: approvedAmount,
      deliveryDate: deliveryDate,
      adminNotes: notes,
      approvedAt: new Date(),
      approvedBy: req.admin._id
    };

    // Send notifications to all parties
    try {
      await sendMaterialQuotationNotifications('quotation_approved', approvalData);
      console.log('[Notifications] ✅ Approval notifications sent to all parties');
    } catch (notifError) {
      console.error('[Notifications] Error sending approval notifications:', notifError);
    }

    // Update the original notification
    notification.message = `✅ APPROVED - ${notification.message}`;
    await notification.save();

    console.log('✅ Material quotation approved successfully');

    res.status(200).json({
      success: true,
      message: 'Material quotation approved successfully. All parties have been notified.',
      data: {
        requestId: requestId,
        approvedAmount: approvedAmount,
        deliveryDate: deliveryDate,
        status: 'approved'
      }
    });
  } catch (error) {
    console.error('❌ Error approving material quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving material quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Admin mark materials as delivered (Admin endpoint)
exports.adminMarkMaterialsDelivered = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { deliveryNotes, deliveredBy } = req.body;

    console.log('🚚 ============================================');
    console.log('🚚 ADMIN MARKING MATERIALS AS DELIVERED');
    console.log('🚚 ============================================');
    console.log('   Request ID:', requestId);
    console.log('   Delivered By:', deliveredBy);
    console.log('🚚 ============================================');

    // Find the original notification/request
    const notification = await Notification.findOne({
      type: 'material_quotation',
      'data': { $regex: requestId }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Material quotation request not found'
      });
    }

    const originalData = JSON.parse(notification.data);

    // Create delivery data
    const deliveryData = {
      ...originalData,
      status: 'delivered',
      deliveryNotes: deliveryNotes,
      deliveredBy: deliveredBy,
      deliveredAt: new Date(),
      markedBy: req.admin._id
    };

    // Send notifications to all parties
    try {
      await sendMaterialQuotationNotifications('materials_delivered', deliveryData);
      console.log('[Notifications] ✅ Delivery notifications sent to all parties');
    } catch (notifError) {
      console.error('[Notifications] Error sending delivery notifications:', notifError);
    }

    // Update the original notification
    notification.message = `🚚 DELIVERED - ${notification.message}`;
    await notification.save();

    console.log('✅ Materials marked as delivered successfully');

    res.status(200).json({
      success: true,
      message: 'Materials marked as delivered successfully. All parties have been notified.',
      data: {
        requestId: requestId,
        deliveredBy: deliveredBy,
        deliveredAt: new Date(),
        status: 'delivered'
      }
    });
  } catch (error) {
    console.error('❌ Error marking materials as delivered:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking materials as delivered',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all material quotation requests (Admin endpoint)
exports.getAllMaterialQuotations = async (req, res) => {
  try {
    const { status, urgency, serviceType, page = 1, limit = 20 } = req.query;

    console.log('📋 Fetching material quotation requests...');

    // Build query
    const query = { type: 'material_quotation' };
    
    // Apply filters
    if (status) {
      query['data'] = { $regex: `"status":"${status}"` };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email');

    // Parse and format the data
    const formattedRequests = notifications.map(notification => {
      try {
        const data = JSON.parse(notification.data);
        return {
          _id: notification._id,
          requestId: data.requestId,
          partnerName: data.partnerName,
          partnerPhone: data.partnerPhone,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          technicianName: data.technicianName,
          technicianPhone: data.technicianPhone,
          serviceType: data.serviceType,
          urgency: data.urgency,
          totalAmount: data.totalAmount,
          status: data.status || 'pending',
          createdAt: notification.createdAt,
          title: notification.title,
          message: notification.message
        };
      } catch (parseError) {
        console.error('Error parsing notification data:', parseError);
        return null;
      }
    }).filter(Boolean);

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      count: formattedRequests.length,
      total: total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: formattedRequests
    });
  } catch (error) {
    console.error('❌ Error fetching material quotations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching material quotations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};