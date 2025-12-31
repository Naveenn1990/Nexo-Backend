const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const Booking = require('../models/booking');
const User = require('../models/User');
const Partner = require('../models/PartnerModel');
const Admin = require('../models/admin');
const Notification = require('../models/Notification');
const Counter = require('../models/Counter');
const { sendPartnerNotification, sendAdminNotification, sendAllAdminsNotification } = require('../services/notificationService');
const { sendMaterialQuotationNotifications } = require('../services/materialNotificationService');
const firebaseAdmin = require('../config/firebase');

// Initialize counter if it doesn't exist
const initializeQuotationCounter = async () => {
  try {
    await Counter.findOneAndUpdate(
      { _id: 'quotation' },
      { $setOnInsert: { sequence: 0 } },
      { upsert: true, new: true }
    );
    console.log('[Counter] Quotation counter initialized');
  } catch (error) {
    console.error('[Counter] Error initializing quotation counter:', error);
  }
};

// Initialize counter on module load
initializeQuotationCounter();

// Create quotation (Partner)
exports.createQuotation = async (req, res) => {
  try {
    console.log('[Quotation] ========================================');
    console.log('[Quotation] CREATE QUOTATION REQUEST');
    console.log('[Quotation] ========================================');
    console.log('[Quotation] Booking ID:', req.params.bookingId);
    console.log('[Quotation] Partner ID:', req.partner?._id);
    console.log('[Quotation] Partner object:', req.partner ? 'exists' : 'missing');
    console.log('[Quotation] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[Quotation] ========================================');

    // Check if partner is authenticated
    if (!req.partner || !req.partner._id) {
      console.log('[Quotation] ❌ Partner not authenticated');
      return res.status(401).json({
        success: false,
        message: 'Partner authentication required'
      });
    }

    const { bookingId } = req.params;
    const { items, subtotal, tax, discount, totalAmount, description, validTill, notes } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log('[Quotation] ❌ Validation failed: No items provided');
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Validate totalAmount
    const numericTotalAmount = Number(totalAmount);
    if (!numericTotalAmount || isNaN(numericTotalAmount) || numericTotalAmount <= 0) {
      console.log('[Quotation] ❌ Validation failed: Invalid total amount:', totalAmount, 'converted to:', numericTotalAmount);
      return res.status(400).json({
        success: false,
        message: 'Total amount must be a valid number greater than 0'
      });
    }

    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      console.log('[Quotation] ❌ Validation failed: Invalid booking ID format:', bookingId);
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Find booking and populate partner details
    console.log('[Quotation] Finding booking...');
    const booking = await Booking.findById(bookingId)
      .populate('user')
      .populate({
        path: 'partner',
        select: 'profile phone partnerType'
      });

    if (!booking) {
      console.log('[Quotation] ❌ Booking not found:', bookingId);
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    console.log('[Quotation] ✅ Booking found:', booking._id);
    console.log('[Quotation] Booking status:', booking.status);
    console.log('[Quotation] Booking partner:', booking.partner?._id);
    console.log('[Quotation] Partner type:', booking.partner?.partnerType);
    console.log('[Quotation] Request partner:', req.partner._id);

    // Verify partner owns this booking
    if (!booking.partner || booking.partner._id.toString() !== req.partner._id.toString()) {
      console.log('[Quotation] ❌ Authorization failed: Partner mismatch');
      console.log('[Quotation] Booking partner ID:', booking.partner?._id);
      console.log('[Quotation] Request partner ID:', req.partner._id);
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to create quotation for this booking'
      });
    }

    // Check if booking is in valid status
    console.log('[Quotation] Checking booking status:', booking.status);
    console.log('[Quotation] Valid statuses:', ['accepted', 'in_progress']);
    
    if (!['accepted', 'in_progress'].includes(booking.status)) {
      console.log('[Quotation] ❌ Invalid booking status:', booking.status);
      return res.status(400).json({
        success: false,
        message: `Quotation can only be created for accepted or in-progress bookings. Current status: ${booking.status}`
      });
    }

    console.log('[Quotation] ✅ Booking status is valid');

    // Validate validTill date
    console.log('[Quotation] Validating validTill date:', validTill);
    console.log('[Quotation] validTill type:', typeof validTill);
    
    if (!validTill) {
      console.log('[Quotation] ❌ validTill is missing');
      return res.status(400).json({
        success: false,
        message: 'Valid till date is required'
      });
    }
    
    const validTillDate = new Date(validTill);
    const now = new Date();
    
    console.log('[Quotation] Parsed validTill date:', validTillDate);
    console.log('[Quotation] Current date:', now);
    console.log('[Quotation] Is valid date:', !isNaN(validTillDate.getTime()));
    console.log('[Quotation] Is future date:', validTillDate > now);
    
    if (isNaN(validTillDate.getTime())) {
      console.log('[Quotation] ❌ Invalid date format:', validTill);
      return res.status(400).json({
        success: false,
        message: 'Valid till date must be a valid date'
      });
    }
    
    if (validTillDate <= now) {
      console.log('[Quotation] ❌ Date is not in future:', validTill);
      return res.status(400).json({
        success: false,
        message: 'Valid till date must be in the future'
      });
    }

    console.log('[Quotation] ✅ ValidTill date is valid');

    // Calculate totals from items
    const calculatedSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const calculatedTotal = calculatedSubtotal + (tax || 0) - (discount || 0);

    console.log('[Quotation] Creating quotation object...');
    console.log('[Quotation] Items count:', items.length);
    console.log('[Quotation] Items data:', JSON.stringify(items, null, 2));
    console.log('[Quotation] Calculated subtotal:', calculatedSubtotal);
    console.log('[Quotation] Total amount:', totalAmount);

    // Validate items before creating quotation
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`[Quotation] Validating item ${i + 1}:`, JSON.stringify(item, null, 2));
      
      if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
        console.log(`[Quotation] ❌ Item ${i + 1} has invalid name:`, item.name);
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1} must have a valid name`
        });
      }
      
      const quantity = Number(item.quantity);
      if (!quantity || isNaN(quantity) || quantity <= 0) {
        console.log(`[Quotation] ❌ Item ${i + 1} has invalid quantity:`, item.quantity, 'converted to:', quantity);
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1} must have a valid quantity greater than 0`
        });
      }
      
      const unitPrice = Number(item.unitPrice);
      if (!unitPrice || isNaN(unitPrice) || unitPrice <= 0) {
        console.log(`[Quotation] ❌ Item ${i + 1} has invalid unit price:`, item.unitPrice, 'converted to:', unitPrice);
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1} must have a valid unit price greater than 0`
        });
      }
      
      const total = Number(item.total);
      if (!total || isNaN(total) || total <= 0) {
        console.log(`[Quotation] ❌ Item ${i + 1} has invalid total:`, item.total, 'converted to:', total);
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1} must have a valid total greater than 0`
        });
      }

      // Ensure the item has the correct data types for saving
      console.log(`[Quotation] Processing item ${i + 1} materialId:`, item.materialId, 'type:', typeof item.materialId);
      
      // Handle materialId - only set if it's a valid ObjectId, otherwise null
      let processedMaterialId = null;
      if (item.materialId) {
        if (mongoose.Types.ObjectId.isValid(item.materialId)) {
          processedMaterialId = item.materialId;
          console.log(`[Quotation] Item ${i + 1} has valid materialId:`, processedMaterialId);
        } else {
          console.log(`[Quotation] Item ${i + 1} has invalid materialId, setting to null:`, item.materialId);
        }
      }
      
      items[i] = {
        name: String(item.name).trim(),
        description: String(item.description || '').trim(),
        quantity: quantity,
        unitPrice: unitPrice,
        total: total,
        materialId: processedMaterialId,
        category: String(item.category || '').trim(),
        isManual: processedMaterialId ? false : true
      };
    }

    // Determine initial partner status based on partner type
    let initialPartnerStatus = 'not_required'; // Default for individual partners
    if (booking.partner?.partnerType === 'franchise') {
      initialPartnerStatus = 'pending'; // Franchise partners need to approve first
    }

    console.log('[Quotation] Partner type:', booking.partner?.partnerType);
    console.log('[Quotation] Initial partner status:', initialPartnerStatus);

    // Create quotation
    const quotationData = {
      booking: bookingId,
      user: booking.user._id,
      partner: req.partner._id,
      items: items, // Items are already validated and formatted above
      subtotal: Number(subtotal) || calculatedSubtotal,
      tax: Number(tax) || 0,
      discount: Number(discount) || 0,
      totalAmount: Number(totalAmount) || calculatedTotal,
      description: String(description || '').trim(),
      validTill: validTillDate,
      notes: String(notes || '').trim(),
      customerStatus: 'pending',
      partnerStatus: initialPartnerStatus,
      adminStatus: 'not_required', // Admin approval not needed
      status: 'pending'
    };

    console.log('[Quotation] Creating quotation with data:', JSON.stringify(quotationData, null, 2));
    
    // Validate quotation data before creating the model
    if (!quotationData.booking || !mongoose.Types.ObjectId.isValid(quotationData.booking)) {
      console.log('[Quotation] ❌ Invalid booking ID for quotation');
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }
    
    if (!quotationData.user || !mongoose.Types.ObjectId.isValid(quotationData.user)) {
      console.log('[Quotation] ❌ Invalid user ID for quotation');
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    if (!quotationData.partner || !mongoose.Types.ObjectId.isValid(quotationData.partner)) {
      console.log('[Quotation] ❌ Invalid partner ID for quotation');
      return res.status(400).json({
        success: false,
        message: 'Invalid partner ID'
      });
    }
    
    const quotation = new Quotation(quotationData);

    console.log('[Quotation] Saving quotation...');
    try {
      await quotation.save();
      console.log(`[Quotation] ✅ Quotation saved with number: ${quotation.quotationNumber}`);
    } catch (saveError) {
      console.error('[Quotation] ❌ Error saving quotation:', saveError);
      console.error('[Quotation] Save error name:', saveError.name);
      console.error('[Quotation] Save error message:', saveError.message);
      
      if (saveError.errors) {
        console.error('[Quotation] Validation errors:');
        Object.keys(saveError.errors).forEach(key => {
          console.error(`  - ${key}: ${saveError.errors[key].message}`);
        });
      }
      
      if (saveError.stack) {
        console.error('[Quotation] Save error stack:', saveError.stack);
      }
      
      // Check if it's a validation error
      if (saveError.name === 'ValidationError') {
        const validationErrors = Object.values(saveError.errors).map(err => err.message);
        console.error('[Quotation] Validation errors:', validationErrors);
        return res.status(400).json({
          success: false,
          message: 'Validation error: ' + validationErrors.join(', '),
          errors: validationErrors,
          details: saveError.errors
        });
      }
      
      // Check if it's a duplicate key error
      if (saveError.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate quotation number. Please try again.'
        });
      }
      
      throw saveError; // Re-throw if it's not a handled error
    }

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
    console.error('[Quotation] ❌❌❌ CRITICAL ERROR creating quotation:', error);
    console.error('[Quotation] Error message:', error.message);
    console.error('[Quotation] Error stack:', error.stack);
    console.error('[Quotation] Request params:', req.params);
    console.error('[Quotation] Request body:', JSON.stringify(req.body, null, 2));
    console.error('[Quotation] Partner ID:', req.partner?._id);
    
    res.status(500).json({
      success: false,
      message: 'Error creating quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// Partner accept quotation (for franchise partners)
exports.partnerAcceptQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;

    console.log('[Quotation] ========================================');
    console.log('[Quotation] PARTNER ACCEPT QUOTATION REQUEST');
    console.log('[Quotation] ========================================');
    console.log('[Quotation] Quotation ID:', quotationId);
    console.log('[Quotation] Partner ID:', req.partner?._id);
    console.log('[Quotation] ========================================');

    // Check if partner is authenticated
    if (!req.partner || !req.partner._id) {
      console.log('[Quotation] ❌ Partner not authenticated');
      return res.status(401).json({
        success: false,
        message: 'Partner authentication required'
      });
    }

    // Validate quotation ID format
    if (!mongoose.Types.ObjectId.isValid(quotationId)) {
      console.log('[Quotation] ❌ Invalid quotation ID format:', quotationId);
      return res.status(400).json({
        success: false,
        message: 'Invalid quotation ID format'
      });
    }

    // Find quotation
    const quotation = await Quotation.findById(quotationId)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone partnerType');

    if (!quotation) {
      console.log('[Quotation] ❌ Quotation not found:', quotationId);
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    console.log('[Quotation] ✅ Quotation found:', quotation._id);
    console.log('[Quotation] Partner status:', quotation.partnerStatus);
    console.log('[Quotation] Partner type:', quotation.partner?.partnerType);

    // Verify partner owns this quotation
    if (!quotation.partner || quotation.partner._id.toString() !== req.partner._id.toString()) {
      console.log('[Quotation] ❌ Authorization failed: Partner mismatch');
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this quotation'
      });
    }

    // Check if partner approval is required
    if (quotation.partnerStatus !== 'pending') {
      console.log('[Quotation] ❌ Partner has already responded');
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

    // Update partner status
    quotation.partnerStatus = 'accepted';
    quotation.partnerResponseAt = new Date();
    await quotation.save();

    // Populate for response
    const updatedQuotation = await Quotation.findById(quotation._id)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone partnerType')
      .populate('adminReviewedBy', 'name email');

    console.log('[Quotation] ✅ Partner approved quotation successfully');

    res.status(200).json({
      success: true,
      message: 'Quotation approved successfully. Waiting for admin approval.',
      data: updatedQuotation
    });
  } catch (error) {
    console.error('[Quotation] ❌ Error approving quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Partner reject quotation (for franchise partners)
exports.partnerRejectQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const { rejectionReason } = req.body;

    console.log('[Quotation] ========================================');
    console.log('[Quotation] PARTNER REJECT QUOTATION REQUEST');
    console.log('[Quotation] ========================================');
    console.log('[Quotation] Quotation ID:', quotationId);
    console.log('[Quotation] Partner ID:', req.partner?._id);
    console.log('[Quotation] ========================================');

    // Check if partner is authenticated
    if (!req.partner || !req.partner._id) {
      console.log('[Quotation] ❌ Partner not authenticated');
      return res.status(401).json({
        success: false,
        message: 'Partner authentication required'
      });
    }

    // Validate quotation ID format
    if (!mongoose.Types.ObjectId.isValid(quotationId)) {
      console.log('[Quotation] ❌ Invalid quotation ID format:', quotationId);
      return res.status(400).json({
        success: false,
        message: 'Invalid quotation ID format'
      });
    }

    // Find quotation
    const quotation = await Quotation.findById(quotationId)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone partnerType');

    if (!quotation) {
      console.log('[Quotation] ❌ Quotation not found:', quotationId);
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Verify partner owns this quotation
    if (!quotation.partner || quotation.partner._id.toString() !== req.partner._id.toString()) {
      console.log('[Quotation] ❌ Authorization failed: Partner mismatch');
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this quotation'
      });
    }

    // Check if partner approval is required
    if (quotation.partnerStatus !== 'pending') {
      console.log('[Quotation] ❌ Partner has already responded');
      return res.status(400).json({
        success: false,
        message: 'You have already responded to this quotation'
      });
    }

    // Update partner status
    quotation.partnerStatus = 'rejected';
    quotation.partnerRejectionReason = rejectionReason || '';
    quotation.partnerResponseAt = new Date();
    await quotation.save();

    // Populate for response
    const updatedQuotation = await Quotation.findById(quotation._id)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone partnerType')
      .populate('adminReviewedBy', 'name email');

    console.log('[Quotation] ✅ Partner rejected quotation successfully');

    res.status(200).json({
      success: true,
      message: 'Quotation rejected successfully',
      data: updatedQuotation
    });
  } catch (error) {
    console.error('[Quotation] ❌ Error rejecting quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Admin accept quotation (modified to check partner approval for franchise partners)
exports.adminAcceptQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const adminId = req.admin._id;

    // Find quotation
    const quotation = await Quotation.findById(quotationId)
      .populate('booking')
      .populate('partner', 'profile.name phone partnerType')
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

    // Check if partner approval is required and pending (for franchise partners)
    if (quotation.partner?.partnerType === 'franchise' && quotation.partnerStatus === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This quotation requires partner approval first. Please wait for the franchise partner to approve.'
      });
    }

    // Check if partner rejected the quotation
    if (quotation.partnerStatus === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'This quotation has been rejected by the partner and cannot be approved by admin.'
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
    const { status, customerStatus, partnerStatus, adminStatus } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (customerStatus) filter.customerStatus = customerStatus;
    if (partnerStatus) filter.partnerStatus = partnerStatus;
    if (adminStatus) filter.adminStatus = adminStatus;

    const quotations = await Quotation.find(filter)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone partnerType')
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

// Delete quotation (Partner only - if not accepted)
exports.deleteQuotation = async (req, res) => {
  try {
    const { quotationId } = req.params;

    console.log('[Quotation] ========================================');
    console.log('[Quotation] DELETE QUOTATION REQUEST');
    console.log('[Quotation] ========================================');
    console.log('[Quotation] Quotation ID:', quotationId);
    console.log('[Quotation] Partner ID:', req.partner?._id);
    console.log('[Quotation] ========================================');

    // Check if partner is authenticated
    if (!req.partner || !req.partner._id) {
      console.log('[Quotation] ❌ Partner not authenticated');
      return res.status(401).json({
        success: false,
        message: 'Partner authentication required'
      });
    }

    // Validate quotation ID format
    if (!mongoose.Types.ObjectId.isValid(quotationId)) {
      console.log('[Quotation] ❌ Invalid quotation ID format:', quotationId);
      return res.status(400).json({
        success: false,
        message: 'Invalid quotation ID format'
      });
    }

    // Find quotation
    const quotation = await Quotation.findById(quotationId)
      .populate('booking')
      .populate('user', 'name email phone')
      .populate('partner', 'profile.name phone');

    if (!quotation) {
      console.log('[Quotation] ❌ Quotation not found:', quotationId);
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    console.log('[Quotation] ✅ Quotation found:', quotation._id);
    console.log('[Quotation] Quotation partner:', quotation.partner?._id);
    console.log('[Quotation] Request partner:', req.partner._id);
    console.log('[Quotation] Customer status:', quotation.customerStatus);
    console.log('[Quotation] Admin status:', quotation.adminStatus);

    // Verify partner owns this quotation
    if (!quotation.partner || quotation.partner._id.toString() !== req.partner._id.toString()) {
      console.log('[Quotation] ❌ Authorization failed: Partner mismatch');
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this quotation'
      });
    }

    // Check if quotation can be deleted (only if customer status is pending)
    if (quotation.customerStatus !== 'pending') {
      console.log('[Quotation] ❌ Cannot delete: Quotation has been responded to by customer');
      return res.status(400).json({
        success: false,
        message: 'Cannot delete quotation that has been accepted or rejected by customer'
      });
    }

    // Delete the quotation
    await Quotation.findByIdAndDelete(quotationId);

    console.log('[Quotation] ✅ Quotation deleted successfully');

    res.status(200).json({
      success: true,
      message: 'Quotation deleted successfully'
    });
  } catch (error) {
    console.error('[Quotation] ❌ Error deleting quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting quotation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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