const Booking = require("../models/booking");
const User = require("../models/User");
const Partner = require("../models/PartnerModel");
const PopularService = require("../models/PopularService");
const Notification = require("../models/Notification");
const Review = require("../models/Review");
const Quotation = require("../models/Quotation");
const admin = require("firebase-admin");

/**
 * Create a booking for customer via AiSensy (No Authentication Required)
 * This API allows AiSensy to create bookings on behalf of customers
 */
exports.createCustomerBooking = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY CUSTOMER BOOKING REQUEST");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const {
      customerPhone,
      customerName,
      customerEmail,
      serviceName,
      subServiceId,
      scheduledDate,
      scheduledTime,
      location,
      amount,
      paymentMode = "cash",
      specialInstructions,
      lat,
      lng
    } = req.body;

    // Validate required fields
    if (!customerPhone || !customerName || !serviceName || !scheduledDate || !scheduledTime || !location?.address || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: customerPhone, customerName, serviceName, scheduledDate, scheduledTime, location.address, amount are required",
        received: {
          customerPhone: !!customerPhone,
          customerName: !!customerName,
          serviceName: !!serviceName,
          scheduledDate: !!scheduledDate,
          scheduledTime: !!scheduledTime,
          locationAddress: !!location?.address,
          amount: !!amount
        }
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    if (!phoneRegex.test(customerPhone.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format"
      });
    }

    // Validate date is in the future
    const bookingDate = new Date(scheduledDate);
    if (bookingDate < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({
        success: false,
        message: "Scheduled date must be today or in the future"
      });
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(scheduledTime)) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format. Use HH:mm format (e.g., 14:30)"
      });
    }

    // Find or create user
    let user = await User.findOne({ phone: customerPhone });
    
    if (!user) {
      console.log("   Creating new user for phone:", customerPhone);
      user = new User({
        name: customerName,
        phone: customerPhone,
        email: customerEmail || `${customerPhone.replace(/\D/g, '')}@aisensy.com`,
        isVerified: true, // Auto-verify AiSensy users
        createdVia: "aisensy"
      });
      await user.save();
      console.log("   New user created with ID:", user._id);
    } else {
      console.log("   Existing user found with ID:", user._id);
      // Update user name if different
      if (user.name !== customerName) {
        user.name = customerName;
        await user.save();
      }
    }

    // Find popular service
    let popularService = null;
    if (subServiceId) {
      // If subServiceId is provided, treat it as popularServiceId
      popularService = await PopularService.findById(subServiceId);
    } else {
      // Try to find popular service by name
      popularService = await PopularService.findOne({ 
        name: { $regex: new RegExp(serviceName, 'i') },
        isActive: true 
      });
    }

    if (!popularService) {
      return res.status(400).json({
        success: false,
        message: `Service '${serviceName}' not found. Please provide a valid serviceName or serviceId`,
        suggestion: "Use GET /api/aisensy/services to get available services"
      });
    }

    if (!popularService.isActive) {
      return res.status(400).json({
        success: false,
        message: `Service '${serviceName}' is currently inactive`
      });
    }

    console.log("   Found popular service:", popularService.name, "ID:", popularService._id);

    // Create booking
    const booking = new Booking({
      user: user._id,
      popularService: popularService._id, // Reference to PopularService
      serviceName: serviceName,
      customerDetails: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone
      },
      scheduledDate: bookingDate,
      scheduledTime: scheduledTime,
      location: {
        address: location.address,
        landmark: location.landmark || "",
        pincode: location.pincode || ""
      },
      amount: amount,
      totalAmount: amount,
      status: "pending",
      paymentMode: paymentMode,
      paymentStatus: "pending",
      specialInstructions: specialInstructions,
      lat: lat,
      lng: lng,
      createdVia: "aisensy"
    });

    await booking.save();

    // Populate booking for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate("popularService")
      .populate("user", "name phone email");

    console.log("   Booking created successfully with ID:", booking._id);

    // Send notifications to partners (non-blocking)
    try {
      await sendPartnerNotifications(populatedBooking, popularService);
    } catch (notificationError) {
      console.error("   Notification error (non-blocking):", notificationError.message);
    }

    console.log("🤖 ============================================");

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: {
        bookingId: booking._id,
        customerId: user._id,
        customerName: user.name,
        customerPhone: user.phone,
        serviceName: popularService.name,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        scheduledDate: scheduledDate,
        scheduledTime: scheduledTime,
        amount: amount,
        location: booking.location,
        createdAt: booking.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error in createCustomerBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Create a booking for partner via AiSensy (No Authentication Required)
 * This API allows AiSensy to create bookings and assign them directly to partners
 */
exports.createPartnerBooking = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY PARTNER BOOKING REQUEST");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const {
      partnerPhone,
      customerPhone,
      customerName,
      customerEmail,
      serviceName,
      subServiceId,
      scheduledDate,
      scheduledTime,
      location,
      amount,
      paymentMode = "cash",
      specialInstructions,
      lat,
      lng
    } = req.body;

    // Validate required fields
    if (!partnerPhone || !customerPhone || !customerName || !serviceName || !scheduledDate || !scheduledTime || !location?.address || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: partnerPhone, customerPhone, customerName, serviceName, scheduledDate, scheduledTime, location.address, amount are required",
        received: {
          partnerPhone: !!partnerPhone,
          customerPhone: !!customerPhone,
          customerName: !!customerName,
          serviceName: !!serviceName,
          scheduledDate: !!scheduledDate,
          scheduledTime: !!scheduledTime,
          locationAddress: !!location?.address,
          amount: !!amount
        }
      });
    }

    // Validate phone number formats
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    if (!phoneRegex.test(partnerPhone.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Invalid partner phone number format"
      });
    }
    if (!phoneRegex.test(customerPhone.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer phone number format"
      });
    }

    // Validate date and time
    const bookingDate = new Date(scheduledDate);
    if (bookingDate < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({
        success: false,
        message: "Scheduled date must be today or in the future"
      });
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(scheduledTime)) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format. Use HH:mm format (e.g., 14:30)"
      });
    }

    // Find partner
    const partner = await Partner.findOne({ phone: partnerPhone });
    if (!partner) {
      return res.status(400).json({
        success: false,
        message: `Partner with phone number ${partnerPhone} not found. Partner must be registered first.`
      });
    }

    if (partner.kyc?.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: `Partner with phone number ${partnerPhone} is not approved. KYC status: ${partner.kyc?.status || 'pending'}`
      });
    }

    console.log("   Found partner:", partner.profile?.name, "ID:", partner._id);

    // Find or create customer
    let user = await User.findOne({ phone: customerPhone });
    
    if (!user) {
      console.log("   Creating new customer for phone:", customerPhone);
      user = new User({
        name: customerName,
        phone: customerPhone,
        email: customerEmail || `${customerPhone.replace(/\D/g, '')}@aisensy.com`,
        isVerified: true,
        createdVia: "aisensy"
      });
      await user.save();
      console.log("   New customer created with ID:", user._id);
    } else {
      console.log("   Existing customer found with ID:", user._id);
      if (user.name !== customerName) {
        user.name = customerName;
        await user.save();
      }
    }

    // Find popular service
    let popularService = null;
    if (subServiceId) {
      // If subServiceId is provided, treat it as popularServiceId
      popularService = await PopularService.findById(subServiceId);
    } else {
      popularService = await PopularService.findOne({ 
        name: { $regex: new RegExp(serviceName, 'i') },
        isActive: true 
      });
    }

    if (!popularService) {
      return res.status(400).json({
        success: false,
        message: `Service '${serviceName}' not found. Please provide a valid serviceName or serviceId`,
        suggestion: "Use GET /api/aisensy/services to get available services"
      });
    }

    if (!popularService.isActive) {
      return res.status(400).json({
        success: false,
        message: `Service '${serviceName}' is currently inactive`
      });
    }

    console.log("   Found popular service:", popularService.name, "ID:", popularService._id);

    // Create booking with partner assigned
    const booking = new Booking({
      user: user._id,
      popularService: popularService._id, // Reference to PopularService
      partner: partner._id, // Assign partner directly
      serviceName: serviceName,
      customerDetails: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone
      },
      scheduledDate: bookingDate,
      scheduledTime: scheduledTime,
      location: {
        address: location.address,
        landmark: location.landmark || "",
        pincode: location.pincode || ""
      },
      amount: amount,
      totalAmount: amount,
      status: "accepted", // Set to accepted since partner is assigned
      paymentMode: paymentMode,
      paymentStatus: "pending",
      specialInstructions: specialInstructions,
      lat: lat,
      lng: lng,
      acceptedAt: new Date(),
      createdVia: "aisensy"
    });

    await booking.save();

    // The pre-save middleware will generate OTP automatically when status is 'accepted'
    const populatedBooking = await Booking.findById(booking._id)
      .populate("popularService")
      .populate("user", "name phone email")
      .populate("partner", "profile.name profile.phone phone");

    console.log("   Booking created and assigned successfully with ID:", booking._id);
    console.log("   Generated OTP:", populatedBooking.otp);

    // Send notifications (non-blocking)
    try {
      await sendBookingAssignedNotifications(populatedBooking, partner, user);
    } catch (notificationError) {
      console.error("   Notification error (non-blocking):", notificationError.message);
    }

    console.log("🤖 ============================================");

    res.status(201).json({
      success: true,
      message: "Booking created and assigned to partner successfully",
      data: {
        bookingId: booking._id,
        customerId: user._id,
        customerName: user.name,
        customerPhone: user.phone,
        partnerId: partner._id,
        partnerName: partner.profile?.name,
        partnerPhone: partner.phone,
        serviceName: subService.name,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        scheduledDate: scheduledDate,
        scheduledTime: scheduledTime,
        amount: amount,
        location: booking.location,
        otp: populatedBooking.otp,
        createdAt: booking.createdAt,
        acceptedAt: booking.acceptedAt
      }
    });

  } catch (error) {
    console.error("❌ Error in createPartnerBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error creating partner booking",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Get booking status (No Authentication Required)
 */
exports.getBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required"
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate("user", "name phone email")
      .populate("partner", "profile.name profile.phone phone")
      .populate("popularService", "name basePrice");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const response = {
      success: true,
      data: {
        bookingId: booking._id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        customerName: booking.user?.name,
        customerPhone: booking.user?.phone,
        serviceName: booking.serviceName || booking.popularService?.name,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        amount: booking.totalAmount || booking.amount,
        location: booking.location,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      }
    };

    // Add partner info if assigned
    if (booking.partner) {
      response.data.partnerName = booking.partner.profile?.name;
      response.data.partnerPhone = booking.partner.phone;
      response.data.acceptedAt = booking.acceptedAt;
    }

    // Add OTP if booking is accepted
    if (booking.status === 'accepted' && booking.otp) {
      response.data.otp = booking.otp;
      response.data.otpActive = booking.otpActive;
    }

    // Add completion info if completed
    if (booking.status === 'completed') {
      response.data.completedAt = booking.completedAt;
    }

    // Add cancellation info if cancelled
    if (booking.status === 'cancelled') {
      response.data.cancellationReason = booking.cancellationReason;
      response.data.cancellationTime = booking.cancellationTime;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error("❌ Error in getBookingStatus:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching booking status",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Get available services (No Authentication Required)
 */
exports.getAvailableServices = async (req, res) => {
  try {
    const services = await PopularService.find({ isActive: true })
      .select('name description basePrice price addOns')
      .sort({ order: 1, createdAt: -1 });

    const formattedServices = services.map(service => ({
      serviceId: service._id,
      serviceName: service.name,
      description: service.description,
      basePrice: service.basePrice,
      price: service.price,
      addOns: service.addOns.map(addOn => ({
        addOnId: addOn._id,
        addOnName: addOn.name,
        description: addOn.description,
        basePrice: addOn.basePrice,
        price: addOn.price
      }))
    }));

    res.status(200).json({
      success: true,
      data: formattedServices
    });

  } catch (error) {
    console.error("❌ Error in getAvailableServices:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching services",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

// Helper function to send partner notifications
const sendPartnerNotifications = async (booking, popularService) => {
  try {
    // Find partners - for PopularService, we'll need to find partners by service capability
    // Since PopularService doesn't have direct partner mapping, we'll notify all approved partners
    const partners = await Partner.find({ 
      'kyc.status': "approved" 
    });

    console.log(`   Found ${partners.length} approved partners for service: ${popularService.name}`);

    // Send notifications to all eligible partners
    await Promise.all(
      partners.map(async (partner) => {
        try {
          // Create notification
          const notification = new Notification({
            title: 'New Booking Alert (AiSensy)',
            userId: partner._id,
            message: `You have a new service booking for ${popularService.name} via AiSensy`,
            createdAt: new Date(),
            read: false,
          });
          await notification.save();

          // Send FCM notification if token exists
          if (partner.fcmtoken) {
            const message = {
              data: {
                type: 'new-job',
                bookingId: booking._id.toString(),
                userId: partner._id.toString(),
                title: 'New Job Alert (AiSensy)',
                body: `New booking for ${popularService.name} via AiSensy`,
                serviceName: popularService.name,
                customerName: booking.user?.name || 'Customer',
                amount: (booking.totalAmount || booking.amount).toString(),
                scheduledDate: booking.scheduledDate.toISOString().split('T')[0],
                scheduledTime: booking.scheduledTime,
                autoNavigate: 'true',
              },
              token: partner.fcmtoken,
              android: {
                priority: 'high',
                ttl: 60 * 60 * 24, // 24 hours
              },
              apns: {
                payload: {
                  aps: {
                    contentAvailable: true,
                    sound: 'notificationalert.mp3',
                    priority: 5,
                    badge: 1,
                  },
                },
              },
            };

            await admin.messaging().send(message);
            console.log(`   FCM sent to partner: ${partner._id}`);
          }
        } catch (error) {
          console.error(`   Error processing partner ${partner._id}:`, error.message);
        }
      })
    );

  } catch (error) {
    console.error('   Error in sendPartnerNotifications:', error);
    throw error;
  }
};

// Helper function to send booking assigned notifications
const sendBookingAssignedNotifications = async (booking, partner, user) => {
  try {
    // Notify customer
    if (user.fcmToken) {
      const customerMessage = {
        notification: {
          title: 'Booking Confirmed',
          body: `Your booking has been assigned to ${partner.profile?.name || 'a partner'}`,
        },
        data: {
          type: 'booking-assigned',
          bookingId: booking._id.toString(),
          partnerName: partner.profile?.name || 'Partner',
          partnerPhone: partner.phone,
          otp: booking.otp,
        },
        token: user.fcmToken,
      };

      await admin.messaging().send(customerMessage);
      console.log(`   Customer notification sent to: ${user._id}`);
    }

    // Notify partner
    if (partner.fcmtoken) {
      const partnerMessage = {
        notification: {
          title: 'Booking Assigned (AiSensy)',
          body: `You have been assigned a booking for ${booking.serviceName}`,
        },
        data: {
          type: 'booking-assigned',
          bookingId: booking._id.toString(),
          customerName: user.name,
          customerPhone: user.phone,
          serviceName: booking.serviceName,
          otp: booking.otp,
        },
        token: partner.fcmtoken,
      };

      await admin.messaging().send(partnerMessage);
      console.log(`   Partner notification sent to: ${partner._id}`);
    }

  } catch (error) {
    console.error('   Error in sendBookingAssignedNotifications:', error);
    throw error;
  }
};

/**
 * Cancel booking for customer via AiSensy (No Authentication Required)
 */
exports.cancelCustomerBooking = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY CANCEL CUSTOMER BOOKING");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const { bookingId, customerPhone, cancellationReason } = req.body;

    // Validate required fields
    if (!bookingId || !customerPhone || !cancellationReason) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookingId, customerPhone, cancellationReason are required"
      });
    }

    // Find booking and verify customer
    const booking = await Booking.findById(bookingId)
      .populate("user", "phone name")
      .populate("popularService", "name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Verify customer phone
    if (booking.user.phone !== customerPhone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone number does not match booking"
      });
    }

    // Check if booking can be cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled"
      });
    }

    if (["completed", "in_progress"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a completed or in-progress booking"
      });
    }

    // Check 2-hour cancellation policy
    const bookingTime = new Date(booking.createdAt);
    const currentTime = new Date();
    const timeDifference = currentTime - bookingTime;
    const twoHoursInMs = 2 * 60 * 60 * 1000;

    if (timeDifference > twoHoursInMs) {
      return res.status(400).json({
        success: false,
        message: "Cancellation is only allowed within 2 hours of booking creation"
      });
    }

    // Cancel booking
    booking.status = "cancelled";
    booking.cancellationReason = cancellationReason;
    booking.cancellationTime = new Date();
    await booking.save();

    console.log("   Booking cancelled successfully");
    console.log("🤖 ============================================");

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: {
        bookingId: booking._id,
        status: booking.status,
        cancellationReason: booking.cancellationReason,
        cancellationTime: booking.cancellationTime
      }
    });

  } catch (error) {
    console.error("❌ Error in cancelCustomerBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling booking",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Submit review for completed booking via AiSensy (No Authentication Required)
 */
exports.submitCustomerReview = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY SUBMIT CUSTOMER REVIEW");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const { bookingId, customerPhone, rating, comment } = req.body;

    // Validate required fields
    if (!bookingId || !customerPhone || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookingId, customerPhone, rating, comment are required"
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5"
      });
    }

    // Validate comment length
    if (comment.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Comment must be at least 10 characters long"
      });
    }

    // Find booking and verify customer
    const booking = await Booking.findById(bookingId)
      .populate("user", "phone name")
      .populate("popularService", "name")
      .populate("partner", "profile.name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Verify customer phone
    if (booking.user.phone !== customerPhone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone number does not match booking"
      });
    }

    // Check if booking is completed
    if (booking.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Reviews can only be submitted for completed bookings"
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      booking: bookingId,
      user: booking.user._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "Review has already been submitted for this booking"
      });
    }

    // Create review
    const review = new Review({
      user: booking.user._id,
      booking: bookingId,
      popularService: booking.popularService?._id,
      partner: booking.partner?._id,
      rating: parseInt(rating),
      comment: comment.trim(),
      status: 'pending', // Reviews need admin approval
      createdVia: "aisensy"
    });

    await review.save();

    console.log("   Review submitted successfully");
    console.log("🤖 ============================================");

    res.status(201).json({
      success: true,
      message: "Review submitted successfully! It will be published after moderation.",
      data: {
        reviewId: review._id,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        submittedAt: review.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error in submitCustomerReview:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting review",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Customer quotation action (accept/reject) via AiSensy (No Authentication Required)
 */
exports.customerQuotationAction = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY CUSTOMER QUOTATION ACTION");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const { quotationId, customerPhone, action, rejectionReason } = req.body;

    // Validate required fields
    if (!quotationId || !customerPhone || !action) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: quotationId, customerPhone, action are required"
      });
    }

    // Validate action
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be either 'accept' or 'reject'"
      });
    }

    // Validate rejection reason if rejecting
    if (action === "reject" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting quotation"
      });
    }

    // Find quotation and verify customer
    const quotation = await Quotation.findById(quotationId)
      .populate({
        path: "booking",
        populate: {
          path: "user",
          select: "phone name"
        }
      });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found"
      });
    }

    // Verify customer phone
    if (quotation.booking.user.phone !== customerPhone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone number does not match quotation"
      });
    }

    // Check if quotation is pending
    if (quotation.customerStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Quotation has already been ${quotation.customerStatus}`
      });
    }

    // Update quotation
    if (action === "accept") {
      quotation.customerStatus = "accepted";
      quotation.customerAcceptedAt = new Date();
    } else {
      quotation.customerStatus = "rejected";
      quotation.customerRejectedAt = new Date();
      quotation.customerRejectionReason = rejectionReason;
    }

    await quotation.save();

    console.log(`   Quotation ${action}ed successfully`);
    console.log("🤖 ============================================");

    res.status(200).json({
      success: true,
      message: `Quotation ${action}ed successfully`,
      data: {
        quotationId: quotation._id,
        status: quotation.customerStatus,
        action: action,
        actionDate: action === "accept" ? quotation.customerAcceptedAt : quotation.customerRejectedAt,
        rejectionReason: action === "reject" ? quotation.customerRejectionReason : undefined
      }
    });

  } catch (error) {
    console.error("❌ Error in customerQuotationAction:", error);
    res.status(500).json({
      success: false,
      message: "Error processing quotation action",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Partner accept booking via AiSensy (No Authentication Required)
 */
exports.partnerAcceptBooking = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY PARTNER ACCEPT BOOKING");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const { bookingId, partnerPhone } = req.body;

    // Validate required fields
    if (!bookingId || !partnerPhone) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookingId, partnerPhone are required"
      });
    }

    // Find partner
    const partner = await Partner.findOne({ phone: partnerPhone });
    if (!partner) {
      return res.status(400).json({
        success: false,
        message: `Partner with phone number ${partnerPhone} not found`
      });
    }

    if (partner.kyc?.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: `Partner is not approved. KYC status: ${partner.kyc?.status || 'pending'}`
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate("user", "name phone")
      .populate("popularService", "name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Check if booking can be accepted
    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Booking cannot be accepted. Current status: ${booking.status}`
      });
    }

    if (booking.partner) {
      return res.status(400).json({
        success: false,
        message: "Booking has already been assigned to another partner"
      });
    }

    // Accept booking
    booking.partner = partner._id;
    booking.status = "accepted";
    booking.acceptedAt = new Date();
    await booking.save();

    // The pre-save middleware will generate OTP automatically
    const updatedBooking = await Booking.findById(booking._id);

    console.log("   Booking accepted successfully");
    console.log("   Generated OTP:", updatedBooking.otp);
    console.log("🤖 ============================================");

    res.status(200).json({
      success: true,
      message: "Booking accepted successfully",
      data: {
        bookingId: booking._id,
        partnerId: partner._id,
        partnerName: partner.profile?.name,
        status: booking.status,
        acceptedAt: booking.acceptedAt,
        otp: updatedBooking.otp,
        customerName: booking.user.name,
        customerPhone: booking.user.phone,
        serviceName: booking.popularService?.name || booking.serviceName
      }
    });

  } catch (error) {
    console.error("❌ Error in partnerAcceptBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error accepting booking",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Partner reject booking via AiSensy (No Authentication Required)
 */
exports.partnerRejectBooking = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY PARTNER REJECT BOOKING");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const { bookingId, partnerPhone, rejectionReason } = req.body;

    // Validate required fields
    if (!bookingId || !partnerPhone || !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookingId, partnerPhone, rejectionReason are required"
      });
    }

    // Find partner
    const partner = await Partner.findOne({ phone: partnerPhone });
    if (!partner) {
      return res.status(400).json({
        success: false,
        message: `Partner with phone number ${partnerPhone} not found`
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate("user", "name phone")
      .populate("popularService", "name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Check if partner can reject this booking
    if (booking.partner && booking.partner.toString() !== partner._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You can only reject bookings assigned to you"
      });
    }

    if (["completed", "cancelled"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject booking with status: ${booking.status}`
      });
    }

    // Reject booking
    if (booking.partner) {
      // If booking was assigned to this partner, unassign and set back to pending
      booking.partner = null;
      booking.status = "pending";
      booking.acceptedAt = null;
      booking.otp = null;
      booking.otpActive = false;
    }

    // Add rejection record (you might want to create a separate model for this)
    booking.rejectionHistory = booking.rejectionHistory || [];
    booking.rejectionHistory.push({
      partner: partner._id,
      reason: rejectionReason,
      rejectedAt: new Date()
    });

    await booking.save();

    console.log("   Booking rejected successfully");
    console.log("🤖 ============================================");

    res.status(200).json({
      success: true,
      message: "Booking rejected successfully",
      data: {
        bookingId: booking._id,
        partnerId: partner._id,
        partnerName: partner.profile?.name,
        status: booking.status,
        rejectionReason: rejectionReason,
        rejectedAt: new Date()
      }
    });

  } catch (error) {
    console.error("❌ Error in partnerRejectBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting booking",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Partner complete booking via AiSensy (No Authentication Required)
 */
exports.partnerCompleteBooking = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY PARTNER COMPLETE BOOKING");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const { bookingId, partnerPhone, otp, remark } = req.body;

    // Validate required fields
    if (!bookingId || !partnerPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookingId, partnerPhone, otp are required"
      });
    }

    // Find partner
    const partner = await Partner.findOne({ phone: partnerPhone });
    if (!partner) {
      return res.status(400).json({
        success: false,
        message: `Partner with phone number ${partnerPhone} not found`
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate("user", "name phone")
      .populate("popularService", "name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Verify partner is assigned to this booking
    if (!booking.partner || booking.partner.toString() !== partner._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You are not assigned to this booking"
      });
    }

    // Check booking status
    if (booking.status !== "accepted" && booking.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete booking with status: ${booking.status}`
      });
    }

    // Verify OTP
    if (booking.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    if (!booking.otpActive) {
      return res.status(400).json({
        success: false,
        message: "OTP is not active"
      });
    }

    // Complete booking
    booking.status = "completed";
    booking.completedAt = new Date();
    booking.otpActive = false;
    if (remark) {
      booking.remark = remark;
    }

    await booking.save();

    console.log("   Booking completed successfully");
    console.log("🤖 ============================================");

    res.status(200).json({
      success: true,
      message: "Booking completed successfully",
      data: {
        bookingId: booking._id,
        partnerId: partner._id,
        partnerName: partner.profile?.name,
        status: booking.status,
        completedAt: booking.completedAt,
        remark: booking.remark,
        customerName: booking.user.name,
        serviceName: booking.popularService?.name || booking.serviceName
      }
    });

  } catch (error) {
    console.error("❌ Error in partnerCompleteBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error completing booking",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Partner create quotation via AiSensy (No Authentication Required)
 */
exports.partnerCreateQuotation = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY PARTNER CREATE QUOTATION");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const { bookingId, partnerPhone, items, totalAmount, notes } = req.body;

    // Validate required fields
    if (!bookingId || !partnerPhone || !items || !totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookingId, partnerPhone, items, totalAmount are required"
      });
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items must be a non-empty array"
      });
    }

    // Validate each item
    for (const item of items) {
      if (!item.description || !item.quantity || !item.unitPrice || !item.totalPrice) {
        return res.status(400).json({
          success: false,
          message: "Each item must have description, quantity, unitPrice, and totalPrice"
        });
      }
    }

    // Find partner
    const partner = await Partner.findOne({ phone: partnerPhone });
    if (!partner) {
      return res.status(400).json({
        success: false,
        message: `Partner with phone number ${partnerPhone} not found`
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId)
      .populate("user", "name phone")
      .populate("popularService", "name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Verify partner is assigned to this booking
    if (!booking.partner || booking.partner.toString() !== partner._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You are not assigned to this booking"
      });
    }

    // Check if quotation already exists
    const existingQuotation = await Quotation.findOne({
      booking: bookingId,
      partner: partner._id
    });

    if (existingQuotation) {
      return res.status(400).json({
        success: false,
        message: "Quotation already exists for this booking"
      });
    }

    // Create quotation
    const quotation = new Quotation({
      booking: bookingId,
      partner: partner._id,
      items: items,
      totalAmount: totalAmount,
      notes: notes || "",
      customerStatus: "pending",
      adminStatus: "pending",
      createdVia: "aisensy"
    });

    await quotation.save();

    console.log("   Quotation created successfully");
    console.log("🤖 ============================================");

    res.status(201).json({
      success: true,
      message: "Quotation created successfully",
      data: {
        quotationId: quotation._id,
        bookingId: booking._id,
        partnerId: partner._id,
        partnerName: partner.profile?.name,
        items: quotation.items,
        totalAmount: quotation.totalAmount,
        notes: quotation.notes,
        customerStatus: quotation.customerStatus,
        adminStatus: quotation.adminStatus,
        createdAt: quotation.createdAt
      }
    });

  } catch (error) {
    console.error("❌ Error in partnerCreateQuotation:", error);
    res.status(500).json({
      success: false,
      message: "Error creating quotation",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};