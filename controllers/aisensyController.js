const Booking = require("../models/booking");
const User = require("../models/User");
const Partner = require("../models/PartnerModel");
const PopularService = require("../models/PopularService");
const Notification = require("../models/Notification");
const Review = require("../models/Review");
const Quotation = require("../models/Quotation");
const admin = require("firebase-admin");

// Helper function to process add-ons and sub-services
const processAddOnsAndSubServices = (popularService, addOnNames) => {
  let selectedAddOns = [];
  let totalAddOnAmount = 0;
  
  if (addOnNames && addOnNames.trim()) {
    const addOnNamesList = addOnNames.split(',').map(name => name.trim());
    console.log("   Processing add-ons/sub-services:", addOnNamesList);
    
    for (const itemName of addOnNamesList) {
      let foundItem = false;
      
      // Search through all add-ons
      for (const addOn of popularService.addOns) {
        // First, check if it's a sub-service within this add-on
        if (addOn.subServices && addOn.subServices.length > 0) {
          const subService = addOn.subServices.find(sub => 
            sub.name.toLowerCase().includes(itemName.toLowerCase()) ||
            itemName.toLowerCase().includes(sub.name.toLowerCase())
          );
          
          if (subService) {
            // Extract price from string format (e.g., "₹150" -> 150)
            let subServicePrice = 0;
            if (subService.price) {
              const priceMatch = subService.price.match(/\d+/);
              subServicePrice = priceMatch ? parseInt(priceMatch[0]) : 0;
            }
            
            selectedAddOns.push({
              addOnId: addOn._id,
              subServiceId: subService._id,
              name: subService.name,
              description: subService.shortDescription || subService.description || '',
              basePrice: subServicePrice,
              price: subService.price,
              parentAddOn: addOn.name,
              type: 'subservice'
            });
            totalAddOnAmount += subServicePrice;
            console.log(`   Found sub-service: ${subService.name} in ${addOn.name} - ₹${subServicePrice}`);
            foundItem = true;
            break;
          }
        }
        
        // If not found as sub-service, check if it matches the add-on itself
        if (!foundItem && (
          addOn.name.toLowerCase().includes(itemName.toLowerCase()) ||
          itemName.toLowerCase().includes(addOn.name.toLowerCase())
        )) {
          selectedAddOns.push({
            addOnId: addOn._id,
            name: addOn.name,
            description: addOn.description,
            basePrice: addOn.basePrice,
            price: addOn.price,
            type: 'addon'
          });
          totalAddOnAmount += addOn.basePrice || 0;
          console.log(`   Found add-on: ${addOn.name} - ₹${addOn.basePrice}`);
          foundItem = true;
          break;
        }
      }
      
      if (!foundItem) {
        console.log(`   Item not found: ${itemName}`);
      }
    }
  }
  
  return { selectedAddOns, totalAddOnAmount };
};

/**
 * Create a booking for customer via AiSensy (No Authentication Required)
 * This API allows AiSensy to create bookings on behalf of customers
 * Handles string-only inputs and optional add-on services
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
      serviceId,
      addOnNames, // Comma-separated string of add-on names
      scheduledDate,
      scheduledTime,
      locationAddress, // Flattened from location.address
      locationLandmark, // Flattened from location.landmark
      locationPincode, // Flattened from location.pincode
      amount, // Will be string, need to convert
      paymentMode = "cash",
      specialInstructions,
      lat,
      lng
    } = req.body;

    // Validate required fields (removed amount from required fields)
    if (!customerPhone || !customerName || !serviceName || !scheduledDate || !scheduledTime || !locationAddress) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: customerPhone, customerName, serviceName, scheduledDate, scheduledTime, locationAddress are required",
        received: {
          customerPhone: !!customerPhone,
          customerName: !!customerName,
          serviceName: !!serviceName,
          scheduledDate: !!scheduledDate,
          scheduledTime: !!scheduledTime,
          locationAddress: !!locationAddress
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

    // Convert amount from string to number (if provided, otherwise will be calculated)
    let providedAmount = 0;
    if (amount) {
      providedAmount = parseFloat(amount);
      if (isNaN(providedAmount) || providedAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount. Must be a positive number or omit for auto-calculation"
        });
      }
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
    if (serviceId) {
      // If serviceId is provided as string
      popularService = await PopularService.findById(serviceId);
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

    // Process add-ons if provided
    let selectedAddOns = [];
    let totalAddOnAmount = 0;
    
    if (addOnNames && addOnNames.trim()) {
      const addOnNamesList = addOnNames.split(',').map(name => name.trim());
      console.log("   Processing add-ons:", addOnNamesList);
      
      for (const addOnName of addOnNamesList) {
        const addOn = popularService.addOns.find(addon => 
          addon.name.toLowerCase().includes(addOnName.toLowerCase()) ||
          addOnName.toLowerCase().includes(addon.name.toLowerCase())
        );
        
        if (addOn) {
          selectedAddOns.push({
            addOnId: addOn._id,
            name: addOn.name,
            description: addOn.description,
            basePrice: addOn.basePrice,
            price: addOn.price
          });
          totalAddOnAmount += addOn.basePrice || 0;
          console.log(`   Found add-on: ${addOn.name} - ₹${addOn.basePrice}`);
        } else {
          console.log(`   Add-on not found: ${addOnName}`);
        }
      }
    }

    // Calculate total amount (base service + add-ons)
    const baseServiceAmount = popularService.basePrice || numericAmount;
    const finalAmount = numericAmount; // Use the amount provided by AiSensy (should include add-ons)
    
    console.log("   Pricing breakdown:");
    console.log(`   - Base service: ₹${baseServiceAmount}`);
    console.log(`   - Add-ons total: ₹${totalAddOnAmount}`);
    console.log(`   - Final amount: ₹${finalAmount}`);

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
        address: locationAddress,
        landmark: locationLandmark || "",
        pincode: locationPincode || ""
      },
      amount: finalAmount,
      totalAmount: finalAmount,
      status: "pending",
      paymentMode: paymentMode,
      paymentStatus: "pending",
      specialInstructions: specialInstructions,
      lat: lat,
      lng: lng,
      selectedAddOns: selectedAddOns, // Store selected add-ons
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
        selectedAddOns: selectedAddOns,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        scheduledDate: scheduledDate,
        scheduledTime: scheduledTime,
        amount: finalAmount,
        location: {
          address: locationAddress,
          landmark: locationLandmark || "",
          pincode: locationPincode || ""
        },
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
 * Handles string-only inputs and optional add-on services
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
      serviceId,
      addOnNames, // Comma-separated string of add-on names
      scheduledDate,
      scheduledTime,
      locationAddress, // Flattened from location.address
      locationLandmark, // Flattened from location.landmark
      locationPincode, // Flattened from location.pincode
      amount, // Will be string, need to convert
      paymentMode = "cash",
      specialInstructions,
      lat,
      lng
    } = req.body;

    // Validate required fields
    if (!partnerPhone || !customerPhone || !customerName || !serviceName || !scheduledDate || !scheduledTime || !locationAddress || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: partnerPhone, customerPhone, customerName, serviceName, scheduledDate, scheduledTime, locationAddress, amount are required",
        received: {
          partnerPhone: !!partnerPhone,
          customerPhone: !!customerPhone,
          customerName: !!customerName,
          serviceName: !!serviceName,
          scheduledDate: !!scheduledDate,
          scheduledTime: !!scheduledTime,
          locationAddress: !!locationAddress,
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

    // Convert amount from string to number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount. Must be a positive number"
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
    if (serviceId) {
      // If serviceId is provided as string
      popularService = await PopularService.findById(serviceId);
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

    // Process add-ons if provided
    let selectedAddOns = [];
    let totalAddOnAmount = 0;
    
    if (addOnNames && addOnNames.trim()) {
      const addOnNamesList = addOnNames.split(',').map(name => name.trim());
      console.log("   Processing add-ons:", addOnNamesList);
      
      for (const addOnName of addOnNamesList) {
        const addOn = popularService.addOns.find(addon => 
          addon.name.toLowerCase().includes(addOnName.toLowerCase()) ||
          addOnName.toLowerCase().includes(addon.name.toLowerCase())
        );
        
        if (addOn) {
          selectedAddOns.push({
            addOnId: addOn._id,
            name: addOn.name,
            description: addOn.description,
            basePrice: addOn.basePrice,
            price: addOn.price
          });
          totalAddOnAmount += addOn.basePrice || 0;
          console.log(`   Found add-on: ${addOn.name} - ₹${addOn.basePrice}`);
        } else {
          console.log(`   Add-on not found: ${addOnName}`);
        }
      }
    }

    // Calculate total amount (base service + add-ons)
    const baseServiceAmount = popularService.basePrice || numericAmount;
    const finalAmount = numericAmount; // Use the amount provided by AiSensy (should include add-ons)
    
    console.log("   Pricing breakdown:");
    console.log(`   - Base service: ₹${baseServiceAmount}`);
    console.log(`   - Add-ons total: ₹${totalAddOnAmount}`);
    console.log(`   - Final amount: ₹${finalAmount}`);

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
        address: locationAddress,
        landmark: locationLandmark || "",
        pincode: locationPincode || ""
      },
      amount: finalAmount,
      totalAmount: finalAmount,
      status: "accepted", // Set to accepted since partner is assigned
      paymentMode: paymentMode,
      paymentStatus: "pending",
      specialInstructions: specialInstructions,
      lat: lat,
      lng: lng,
      selectedAddOns: selectedAddOns, // Store selected add-ons
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
        serviceName: popularService.name,
        selectedAddOns: selectedAddOns,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        scheduledDate: scheduledDate,
        scheduledTime: scheduledTime,
        amount: finalAmount,
        location: {
          address: locationAddress,
          landmark: locationLandmark || "",
          pincode: locationPincode || ""
        },
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

    // Convert rating from string to number and validate
    const numericRating = parseInt(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a number between 1 and 5"
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
      rating: numericRating, // Use converted numeric rating
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

    // Convert totalAmount from string to number
    const numericTotalAmount = parseFloat(totalAmount);
    if (isNaN(numericTotalAmount) || numericTotalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid totalAmount. Must be a positive number"
      });
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items must be a non-empty array"
      });
    }

    // Validate and convert each item's numeric fields from strings
    const processedItems = [];
    for (const item of items) {
      if (!item.description || !item.quantity || !item.unitPrice || !item.totalPrice) {
        return res.status(400).json({
          success: false,
          message: "Each item must have description, quantity, unitPrice, and totalPrice"
        });
      }

      // Convert string numbers to actual numbers
      const quantity = parseFloat(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const totalPrice = parseFloat(item.totalPrice);

      if (isNaN(quantity) || isNaN(unitPrice) || isNaN(totalPrice)) {
        return res.status(400).json({
          success: false,
          message: "Item quantity, unitPrice, and totalPrice must be valid numbers"
        });
      }

      processedItems.push({
        description: item.description,
        quantity: quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice
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
      items: processedItems, // Use processed items with converted numbers
      totalAmount: numericTotalAmount, // Use converted total amount
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

// Import PayU configuration and utilities from existing controller
const crypto = require('crypto');

// PayU Configuration
const PAYU_CONFIG = {
  key: process.env.PAYU_MERCHANT_KEY || 'YOUR_MERCHANT_KEY',
  salt: process.env.PAYU_MERCHANT_SALT || 'YOUR_MERCHANT_SALT',
  baseUrl: process.env.PAYU_BASE_URL || 'https://test.payu.in',
  skipHashVerification: process.env.PAYU_SKIP_HASH_VERIFICATION === 'true',
};

// Generate PayU hash
const generatePayUHash = (data) => {
  const { key, txnid, amount, productinfo, firstname, email, salt } = data;
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

// Verify PayU hash for response
const verifyPayUHash = (data) => {
  const { salt, status, key, txnid, amount, productinfo, firstname, email, hash } = data;
  const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const generatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
  return generatedHash === hash;
};

/**
 * AiSensy PayU Payment Integration (No Authentication Required)
 * This API allows AiSensy to initiate PayU payments for bookings
 */
exports.aisensyInitiatePayment = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY PAYU PAYMENT INITIATION");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const {
      bookingId,
      customerPhone,
      customerName,
      customerEmail,
      amount, // String amount from AiSensy
      productInfo = "Service Booking Payment"
    } = req.body;

    // Validate required fields
    if (!bookingId || !customerPhone || !customerName || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bookingId, customerPhone, customerName, amount are required"
      });
    }

    // Convert amount from string to number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount. Must be a positive number"
      });
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    if (!phoneRegex.test(customerPhone.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format"
      });
    }

    // Find and validate booking
    const booking = await Booking.findById(bookingId)
      .populate("user", "name phone email")
      .populate("popularService", "name");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Verify customer phone matches booking
    if (booking.user.phone !== customerPhone) {
      return res.status(400).json({
        success: false,
        message: "Customer phone number does not match booking"
      });
    }

    // Check if booking can be paid for
    if (booking.paymentStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been completed for this booking"
      });
    }

    if (["cancelled"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot make payment for cancelled booking"
      });
    }

    // Generate unique transaction ID
    const txnid = `AISENSY_${bookingId}_${Date.now()}`;

    // Use customer email or generate one if not provided
    const email = customerEmail || booking.user.email || `${customerPhone.replace(/\D/g, '')}@aisensy.com`;

    // Prepare PayU payment data
    const paymentData = {
      key: PAYU_CONFIG.key,
      txnid,
      amount: numericAmount.toString(),
      productinfo: `${productInfo} - ${booking.popularService?.name || booking.serviceName}`,
      firstname: customerName,
      email,
      phone: customerPhone,
      surl: `${process.env.BASE_URL || 'https://nexo.works'}/api/aisensy/payu/payment-success`,
      furl: `${process.env.BASE_URL || 'https://nexo.works'}/api/aisensy/payu/payment-failure`,
      salt: PAYU_CONFIG.salt,
    };

    // Generate PayU hash
    const hash = generatePayUHash(paymentData);

    // Update booking with transaction details
    booking.txnid = txnid;
    booking.paymentDetails = {
      gateway: 'payu',
      txnid: txnid,
      amount: numericAmount,
      initiatedAt: new Date(),
      initiatedVia: 'aisensy'
    };
    await booking.save();

    console.log("   Payment initiated successfully");
    console.log("   Transaction ID:", txnid);
    console.log("   Amount:", numericAmount);
    console.log("🤖 ============================================");

    // Return PayU payment data
    res.status(200).json({
      success: true,
      message: "Payment initiated successfully",
      data: {
        txnid: txnid,
        bookingId: booking._id,
        amount: numericAmount,
        payuData: {
          action: `${PAYU_CONFIG.baseUrl}/_payment`,
          params: {
            ...paymentData,
            hash
          }
        },
        // For AiSensy integration - direct payment URL
        paymentUrl: `${PAYU_CONFIG.baseUrl}/_payment?${new URLSearchParams({
          ...paymentData,
          hash
        }).toString()}`
      }
    });

  } catch (error) {
    console.error("❌ Error in aisensyInitiatePayment:", error);
    res.status(500).json({
      success: false,
      message: "Error initiating payment",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * AiSensy PayU Payment Success Handler (No Authentication Required)
 */
exports.aisensyPaymentSuccess = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY PAYU PAYMENT SUCCESS CALLBACK");
    console.log("🤖 ============================================");
    console.log("   Payment Data:", JSON.stringify(req.body, null, 2));

    const paymentData = req.body;
    const { txnid, mihpayid, status, amount } = paymentData;

    // Verify hash (skip if configured for testing)
    if (!PAYU_CONFIG.skipHashVerification) {
      const isValid = verifyPayUHash({
        ...paymentData,
        salt: PAYU_CONFIG.salt
      });

      if (!isValid) {
        console.error('❌ Invalid payment hash - Hash verification failed');
        return res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment-result?status=failed&reason=invalid_hash&source=aisensy`);
      }
      
      console.log('✅ Hash verification passed');
    }

    // Find booking by transaction ID
    const booking = await Booking.findOne({ txnid: txnid })
      .populate("user", "name phone email")
      .populate("popularService", "name");

    if (!booking) {
      console.error('❌ Booking not found for transaction ID:', txnid);
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment-result?status=failed&reason=booking_not_found&source=aisensy`);
    }

    // Update booking payment status
    if (status === 'success') {
      booking.paymentStatus = 'completed';
      booking.paymentMode = 'online';
      booking.paymentDetails = {
        ...booking.paymentDetails,
        gateway: 'payu',
        payuPaymentId: mihpayid,
        txnid: txnid,
        amount: parseFloat(amount),
        completedAt: new Date(),
        status: 'success'
      };
      
      // If booking is pending, move it to confirmed
      if (booking.status === 'pending') {
        booking.status = 'confirmed';
      }
    } else {
      booking.paymentStatus = 'failed';
      booking.paymentDetails = {
        ...booking.paymentDetails,
        status: 'failed',
        failedAt: new Date(),
        failureReason: 'Payment failed at gateway'
      };
    }

    await booking.save();

    console.log("   Payment status updated for booking:", booking._id);
    console.log("   Payment Status:", booking.paymentStatus);
    console.log("🤖 ============================================");

    // Redirect to payment result page
    const redirectUrl = `${process.env.FRONTEND_URL || 'https://nexo.works'}/payment-result?status=${status}&txnid=${txnid}&payid=${mihpayid}&bookingId=${booking._id}&source=aisensy`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ AiSensy payment success handler error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment-result?status=failed&reason=server_error&source=aisensy`);
  }
};

/**
 * AiSensy PayU Payment Failure Handler (No Authentication Required)
 */
exports.aisensyPaymentFailure = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY PAYU PAYMENT FAILURE CALLBACK");
    console.log("🤖 ============================================");
    console.log("   Payment Data:", JSON.stringify(req.body, null, 2));

    const paymentData = req.body;
    const { txnid, status, amount } = paymentData;

    // Find booking by transaction ID
    const booking = await Booking.findOne({ txnid: txnid });

    if (booking) {
      // Update booking payment status
      booking.paymentStatus = 'failed';
      booking.paymentDetails = {
        ...booking.paymentDetails,
        status: 'failed',
        failedAt: new Date(),
        failureReason: 'Payment failed at gateway'
      };
      await booking.save();
      
      console.log("   Payment failure recorded for booking:", booking._id);
    }

    console.log("🤖 ============================================");

    // Redirect to payment result page
    const redirectUrl = `${process.env.FRONTEND_URL || 'https://nexo.works'}/payment-result?status=failed&txnid=${txnid}&bookingId=${booking?._id}&source=aisensy`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ AiSensy payment failure handler error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'https://nexo.works'}/payment-result?status=failed&reason=server_error&source=aisensy`);
  }
};

/**
 * Check AiSensy payment status (No Authentication Required)
 */
exports.aisensyCheckPaymentStatus = async (req, res) => {
  try {
    const { txnid, bookingId } = req.params;

    if (!txnid && !bookingId) {
      return res.status(400).json({
        success: false,
        message: "Either transaction ID or booking ID is required"
      });
    }

    // Find booking by transaction ID or booking ID
    let booking;
    if (txnid) {
      booking = await Booking.findOne({ txnid: txnid })
        .populate("user", "name phone")
        .populate("popularService", "name");
    } else {
      booking = await Booking.findById(bookingId)
        .populate("user", "name phone")
        .populate("popularService", "name");
    }

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
        txnid: booking.txnid,
        paymentStatus: booking.paymentStatus,
        paymentMode: booking.paymentMode,
        amount: booking.totalAmount || booking.amount,
        customerName: booking.user?.name,
        customerPhone: booking.user?.phone,
        serviceName: booking.popularService?.name || booking.serviceName,
        paymentDetails: booking.paymentDetails
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error("❌ Error in aisensyCheckPaymentStatus:", error);
    res.status(500).json({
      success: false,
      message: "Error checking payment status",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Simplified AiSensy Booking API - Minimal Request Data (No Authentication Required)
 * This API requires only essential fields and auto-fills the rest with smart defaults
 */
exports.createSimpleBooking = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY SIMPLE BOOKING REQUEST");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const {
      phone,        // Only phone is required
      name,         // Optional - will use "Customer" if not provided
      service,      // Optional - will use first available service if not provided
      amount        // Optional - will use service base price if not provided
    } = req.body;

    // Validate only essential field
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: phone is required",
        example: {
          phone: "+919876543210",
          name: "John Doe (optional)",
          service: "AC Repair (optional)",
          amount: "500 (optional)"
        }
      });
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    if (!phoneRegex.test(phone.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format. Use format: +919876543210"
      });
    }

    // Auto-fill defaults
    const customerName = name || "Customer";
    const customerEmail = `${phone.replace(/\D/g, '')}@aisensy.com`;
    
    // Get default service if not provided
    let selectedService = null;
    if (service) {
      selectedService = await PopularService.findOne({ 
        name: { $regex: new RegExp(service, 'i') },
        isActive: true 
      });
    }
    
    // If no service found or not provided, get first available service
    if (!selectedService) {
      selectedService = await PopularService.findOne({ isActive: true }).sort({ order: 1 });
    }

    if (!selectedService) {
      return res.status(500).json({
        success: false,
        message: "No services available. Please contact support."
      });
    }

    // Auto-calculate amount
    const serviceAmount = amount ? parseFloat(amount) : selectedService.basePrice || 500;
    if (isNaN(serviceAmount) || serviceAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount. Must be a positive number"
      });
    }

    // Auto-generate booking details with smart defaults
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduledDate = tomorrow.toISOString().split('T')[0]; // Tomorrow's date
    const scheduledTime = "10:00"; // Default morning time
    
    // Find or create user
    let user = await User.findOne({ phone: phone });
    
    if (!user) {
      console.log("   Creating new user for phone:", phone);
      user = new User({
        name: customerName,
        phone: phone,
        email: customerEmail,
        isVerified: true,
        createdVia: "aisensy"
      });
      await user.save();
      console.log("   New user created with ID:", user._id);
    } else {
      console.log("   Existing user found with ID:", user._id);
      // Update user name if provided and different
      if (name && user.name !== customerName) {
        user.name = customerName;
        await user.save();
      }
    }

    console.log("   Using service:", selectedService.name, "ID:", selectedService._id);

    // Create booking with minimal required data
    const booking = new Booking({
      user: user._id,
      popularService: selectedService._id,
      serviceName: selectedService.name,
      customerDetails: {
        name: customerName,
        email: customerEmail,
        phone: phone
      },
      scheduledDate: tomorrow,
      scheduledTime: scheduledTime,
      location: {
        address: "Address to be confirmed", // Default placeholder
        landmark: "",
        pincode: ""
      },
      amount: serviceAmount,
      totalAmount: serviceAmount,
      status: "pending",
      paymentMode: "cash",
      paymentStatus: "pending",
      specialInstructions: "Booking created via AiSensy - details to be confirmed",
      selectedAddOns: [], // No add-ons in simple booking
      createdVia: "aisensy-simple"
    });

    await booking.save();

    // Populate booking for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate("popularService")
      .populate("user", "name phone email");

    console.log("   Simple booking created successfully with ID:", booking._id);

    // Send notifications to partners (non-blocking)
    try {
      await sendPartnerNotifications(populatedBooking, selectedService);
    } catch (notificationError) {
      console.error("   Notification error (non-blocking):", notificationError.message);
    }

    console.log("🤖 ============================================");

    res.status(201).json({
      success: true,
      message: "Simple booking created successfully! Customer will be contacted to confirm details.",
      data: {
        bookingId: booking._id,
        customerId: user._id,
        customerName: user.name,
        customerPhone: user.phone,
        serviceName: selectedService.name,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        scheduledDate: scheduledDate,
        scheduledTime: scheduledTime,
        amount: serviceAmount,
        location: booking.location,
        createdAt: booking.createdAt,
        note: "This is a simplified booking. Customer will be contacted to confirm address and other details."
      }
    });

  } catch (error) {
    console.error("❌ Error in createSimpleBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error creating simple booking",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Ultra-Minimal AiSensy Booking API - Phone Only (No Authentication Required)
 * This API requires ONLY phone number and auto-fills everything else
 */
exports.createMinimalBooking = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY MINIMAL BOOKING REQUEST");
    console.log("🤖 ============================================");
    console.log("   Request Body:", JSON.stringify(req.body, null, 2));

    const { phone } = req.body;

    // Validate only phone number
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Only phone number is required",
        example: {
          phone: "+919876543210"
        }
      });
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    if (!phoneRegex.test(phone.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format. Use format: +919876543210"
      });
    }

    // Get first available service
    const selectedService = await PopularService.findOne({ isActive: true }).sort({ order: 1 });

    if (!selectedService) {
      return res.status(500).json({
        success: false,
        message: "No services available. Please contact support."
      });
    }

    // Auto-generate all details
    const customerName = "Customer";
    const customerEmail = `${phone.replace(/\D/g, '')}@aisensy.com`;
    const serviceAmount = selectedService.basePrice || 500;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduledDate = tomorrow.toISOString().split('T')[0];
    const scheduledTime = "10:00";
    
    // Find or create user
    let user = await User.findOne({ phone: phone });
    
    if (!user) {
      user = new User({
        name: customerName,
        phone: phone,
        email: customerEmail,
        isVerified: true,
        createdVia: "aisensy"
      });
      await user.save();
      console.log("   New user created with ID:", user._id);
    } else {
      console.log("   Existing user found with ID:", user._id);
    }

    // Create minimal booking
    const booking = new Booking({
      user: user._id,
      popularService: selectedService._id,
      serviceName: selectedService.name,
      customerDetails: {
        name: customerName,
        email: customerEmail,
        phone: phone
      },
      scheduledDate: tomorrow,
      scheduledTime: scheduledTime,
      location: {
        address: "Address to be confirmed",
        landmark: "",
        pincode: ""
      },
      amount: serviceAmount,
      totalAmount: serviceAmount,
      status: "pending",
      paymentMode: "cash",
      paymentStatus: "pending",
      specialInstructions: "Minimal booking via AiSensy - all details to be confirmed by customer service",
      selectedAddOns: [],
      createdVia: "aisensy-minimal"
    });

    await booking.save();

    console.log("   Minimal booking created successfully with ID:", booking._id);

    // Send notifications (non-blocking)
    try {
      await sendPartnerNotifications(booking, selectedService);
    } catch (notificationError) {
      console.error("   Notification error (non-blocking):", notificationError.message);
    }

    console.log("🤖 ============================================");

    res.status(201).json({
      success: true,
      message: "Booking created! Our team will contact you shortly to confirm details.",
      data: {
        bookingId: booking._id,
        customerPhone: phone,
        serviceName: selectedService.name,
        scheduledDate: scheduledDate,
        scheduledTime: scheduledTime,
        amount: serviceAmount,
        status: "pending",
        message: "Customer service will call to confirm address and service details"
      }
    });

  } catch (error) {
    console.error("❌ Error in createMinimalBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error creating minimal booking",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};
/**
 * Get all bookings by mobile number (No Authentication Required)
 */
exports.getBookingsByPhone = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY GET BOOKINGS BY PHONE");
    console.log("🤖 ============================================");
    console.log("   Request Params:", JSON.stringify(req.params, null, 2));

    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    if (!phoneRegex.test(phone.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format"
      });
    }

    // Find user by phone
    const user = await User.findOne({ phone: phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this phone number",
        data: {
          phone: phone,
          bookings: []
        }
      });
    }

    // Get all bookings for this user
    const bookings = await Booking.find({ user: user._id })
      .populate("popularService", "name basePrice")
      .populate("partner", "profile.name profile.phone phone")
      .sort({ createdAt: -1 }); // Latest first

    // Format bookings for response
    const formattedBookings = bookings.map(booking => ({
      bookingId: booking._id,
      serviceName: booking.popularService?.name || booking.serviceName,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      amount: booking.totalAmount || booking.amount,
      location: booking.location,
      selectedAddOns: booking.selectedAddOns || [],
      partnerInfo: booking.partner ? {
        name: booking.partner.profile?.name,
        phone: booking.partner.phone
      } : null,
      otp: booking.status === 'accepted' ? booking.otp : null,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      createdVia: booking.createdVia
    }));

    console.log(`   Found ${formattedBookings.length} bookings for phone: ${phone}`);
    console.log("🤖 ============================================");

    res.status(200).json({
      success: true,
      data: {
        customerPhone: phone,
        customerName: user.name,
        totalBookings: formattedBookings.length,
        bookings: formattedBookings
      }
    });

  } catch (error) {
    console.error("❌ Error in getBookingsByPhone:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Get all available customer actions (No Authentication Required)
 */
exports.getCustomerActions = async (req, res) => {
  try {
    const customerActions = [
      {
        action: "create-booking",
        method: "POST",
        endpoint: "/api/aisensy/customer/create-booking",
        description: "Create a new booking with full details",
        requiredFields: ["customerPhone", "customerName", "serviceName", "scheduledDate", "scheduledTime", "locationAddress", "amount"],
        optionalFields: ["customerEmail", "serviceId", "addOnNames", "locationLandmark", "locationPincode", "paymentMode", "specialInstructions", "lat", "lng"]
      },
      {
        action: "simple-booking",
        method: "POST", 
        endpoint: "/api/aisensy/simple-booking",
        description: "Create booking with minimal data (auto-fills missing details)",
        requiredFields: ["phone"],
        optionalFields: ["name", "service", "amount"]
      },
      {
        action: "minimal-booking",
        method: "POST",
        endpoint: "/api/aisensy/minimal-booking", 
        description: "Create booking with phone only (everything auto-filled)",
        requiredFields: ["phone"],
        optionalFields: []
      },
      {
        action: "cancel-booking",
        method: "PUT",
        endpoint: "/api/aisensy/customer/cancel-booking",
        description: "Cancel a booking (within 2 hours of creation)",
        requiredFields: ["bookingId", "customerPhone", "cancellationReason"],
        optionalFields: []
      },
      {
        action: "submit-review",
        method: "POST",
        endpoint: "/api/aisensy/customer/submit-review",
        description: "Submit review for completed booking",
        requiredFields: ["bookingId", "customerPhone", "rating", "comment"],
        optionalFields: []
      },
      {
        action: "quotation-action",
        method: "PUT",
        endpoint: "/api/aisensy/customer/quotation-action",
        description: "Accept or reject partner quotation",
        requiredFields: ["quotationId", "customerPhone", "action"],
        optionalFields: ["rejectionReason"]
      },
      {
        action: "initiate-payment",
        method: "POST",
        endpoint: "/api/aisensy/payu/initiate-payment",
        description: "Initiate PayU payment for booking",
        requiredFields: ["bookingId", "customerPhone", "customerName", "amount"],
        optionalFields: ["customerEmail", "productInfo"]
      },
      {
        action: "get-bookings",
        method: "GET",
        endpoint: "/api/aisensy/customer/bookings/{phone}",
        description: "Get all bookings by phone number",
        requiredFields: ["phone"],
        optionalFields: []
      },
      {
        action: "get-booking-status",
        method: "GET",
        endpoint: "/api/aisensy/booking/{bookingId}/status",
        description: "Get specific booking status",
        requiredFields: ["bookingId"],
        optionalFields: []
      },
      {
        action: "check-payment-status",
        method: "GET",
        endpoint: "/api/aisensy/payu/payment-status/{txnid}",
        description: "Check payment status by transaction ID",
        requiredFields: ["txnid"],
        optionalFields: []
      }
    ];

    res.status(200).json({
      success: true,
      message: "Available customer actions",
      data: {
        totalActions: customerActions.length,
        actions: customerActions
      }
    });

  } catch (error) {
    console.error("❌ Error in getCustomerActions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching customer actions",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Get all available partner actions (No Authentication Required)
 */
exports.getPartnerActions = async (req, res) => {
  try {
    const partnerActions = [
      {
        action: "create-partner-booking",
        method: "POST",
        endpoint: "/api/aisensy/partner/create-booking",
        description: "Create booking and assign directly to partner",
        requiredFields: ["partnerPhone", "customerPhone", "customerName", "serviceName", "scheduledDate", "scheduledTime", "locationAddress", "amount"],
        optionalFields: ["customerEmail", "serviceId", "addOnNames", "locationLandmark", "locationPincode", "paymentMode", "specialInstructions", "lat", "lng"]
      },
      {
        action: "accept-booking",
        method: "PUT",
        endpoint: "/api/aisensy/partner/accept-booking",
        description: "Accept a pending booking",
        requiredFields: ["bookingId", "partnerPhone"],
        optionalFields: []
      },
      {
        action: "reject-booking",
        method: "PUT",
        endpoint: "/api/aisensy/partner/reject-booking",
        description: "Reject a booking assignment",
        requiredFields: ["bookingId", "partnerPhone", "rejectionReason"],
        optionalFields: []
      },
      {
        action: "complete-booking",
        method: "PUT",
        endpoint: "/api/aisensy/partner/complete-booking",
        description: "Complete booking using customer OTP",
        requiredFields: ["bookingId", "partnerPhone", "otp"],
        optionalFields: ["remark"]
      },
      {
        action: "create-quotation",
        method: "POST",
        endpoint: "/api/aisensy/partner/create-quotation",
        description: "Create quotation for additional work",
        requiredFields: ["bookingId", "partnerPhone", "items", "totalAmount"],
        optionalFields: ["notes"]
      },
      {
        action: "get-partner-bookings",
        method: "GET",
        endpoint: "/api/aisensy/partner/bookings/{partnerPhone}",
        description: "Get all bookings assigned to partner",
        requiredFields: ["partnerPhone"],
        optionalFields: []
      }
    ];

    res.status(200).json({
      success: true,
      message: "Available partner actions",
      data: {
        totalActions: partnerActions.length,
        actions: partnerActions
      }
    });

  } catch (error) {
    console.error("❌ Error in getPartnerActions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching partner actions",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Get all bookings assigned to a partner (No Authentication Required)
 */
exports.getPartnerBookings = async (req, res) => {
  try {
    console.log("🤖 ============================================");
    console.log("🤖 AISENSY GET PARTNER BOOKINGS");
    console.log("🤖 ============================================");
    console.log("   Request Params:", JSON.stringify(req.params, null, 2));

    const { partnerPhone } = req.params;

    if (!partnerPhone) {
      return res.status(400).json({
        success: false,
        message: "Partner phone number is required"
      });
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    if (!phoneRegex.test(partnerPhone.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format"
      });
    }

    // Find partner by phone
    const partner = await Partner.findOne({ phone: partnerPhone });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "No partner found with this phone number",
        data: {
          partnerPhone: partnerPhone,
          bookings: []
        }
      });
    }

    // Get all bookings assigned to this partner
    const bookings = await Booking.find({ partner: partner._id })
      .populate("popularService", "name basePrice")
      .populate("user", "name phone email")
      .sort({ createdAt: -1 }); // Latest first

    // Format bookings for response
    const formattedBookings = bookings.map(booking => ({
      bookingId: booking._id,
      serviceName: booking.popularService?.name || booking.serviceName,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      amount: booking.totalAmount || booking.amount,
      location: booking.location,
      selectedAddOns: booking.selectedAddOns || [],
      customerInfo: {
        name: booking.user?.name,
        phone: booking.user?.phone,
        email: booking.user?.email
      },
      otp: booking.status === 'accepted' ? booking.otp : null,
      acceptedAt: booking.acceptedAt,
      completedAt: booking.completedAt,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      createdVia: booking.createdVia
    }));

    console.log(`   Found ${formattedBookings.length} bookings for partner: ${partnerPhone}`);
    console.log("🤖 ============================================");

    res.status(200).json({
      success: true,
      data: {
        partnerPhone: partnerPhone,
        partnerName: partner.profile?.name,
        totalBookings: formattedBookings.length,
        bookings: formattedBookings
      }
    });

  } catch (error) {
    console.error("❌ Error in getPartnerBookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching partner bookings",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

/**
 * Get all available actions (both customer and partner) (No Authentication Required)
 */
exports.getAllActions = async (req, res) => {
  try {
    const allActions = {
      customer: [
        {
          action: "create-booking",
          method: "POST",
          endpoint: "/api/aisensy/customer/create-booking",
          description: "Create a new booking with full details",
          category: "booking"
        },
        {
          action: "simple-booking", 
          method: "POST",
          endpoint: "/api/aisensy/simple-booking",
          description: "Create booking with minimal data",
          category: "booking"
        },
        {
          action: "minimal-booking",
          method: "POST", 
          endpoint: "/api/aisensy/minimal-booking",
          description: "Create booking with phone only",
          category: "booking"
        },
        {
          action: "cancel-booking",
          method: "PUT",
          endpoint: "/api/aisensy/customer/cancel-booking", 
          description: "Cancel a booking",
          category: "booking"
        },
        {
          action: "submit-review",
          method: "POST",
          endpoint: "/api/aisensy/customer/submit-review",
          description: "Submit review for completed booking",
          category: "review"
        },
        {
          action: "quotation-action",
          method: "PUT",
          endpoint: "/api/aisensy/customer/quotation-action",
          description: "Accept or reject partner quotation",
          category: "quotation"
        },
        {
          action: "initiate-payment",
          method: "POST",
          endpoint: "/api/aisensy/payu/initiate-payment",
          description: "Initiate PayU payment",
          category: "payment"
        },
        {
          action: "get-bookings",
          method: "GET",
          endpoint: "/api/aisensy/customer/bookings/{phone}",
          description: "Get all customer bookings",
          category: "information"
        }
      ],
      partner: [
        {
          action: "create-partner-booking",
          method: "POST",
          endpoint: "/api/aisensy/partner/create-booking",
          description: "Create and assign booking to partner",
          category: "booking"
        },
        {
          action: "accept-booking",
          method: "PUT", 
          endpoint: "/api/aisensy/partner/accept-booking",
          description: "Accept a pending booking",
          category: "booking"
        },
        {
          action: "reject-booking",
          method: "PUT",
          endpoint: "/api/aisensy/partner/reject-booking", 
          description: "Reject a booking assignment",
          category: "booking"
        },
        {
          action: "complete-booking",
          method: "PUT",
          endpoint: "/api/aisensy/partner/complete-booking",
          description: "Complete booking with OTP",
          category: "booking"
        },
        {
          action: "create-quotation",
          method: "POST",
          endpoint: "/api/aisensy/partner/create-quotation",
          description: "Create quotation for additional work",
          category: "quotation"
        },
        {
          action: "get-partner-bookings",
          method: "GET",
          endpoint: "/api/aisensy/partner/bookings/{partnerPhone}",
          description: "Get all partner bookings",
          category: "information"
        }
      ],
      general: [
        {
          action: "get-services",
          method: "GET",
          endpoint: "/api/aisensy/services",
          description: "Get all available services",
          category: "information"
        },
        {
          action: "get-booking-status",
          method: "GET",
          endpoint: "/api/aisensy/booking/{bookingId}/status",
          description: "Get booking status by ID",
          category: "information"
        },
        {
          action: "check-payment-status",
          method: "GET", 
          endpoint: "/api/aisensy/payu/payment-status/{txnid}",
          description: "Check payment status",
          category: "payment"
        }
      ]
    };

    const totalActions = allActions.customer.length + allActions.partner.length + allActions.general.length;

    res.status(200).json({
      success: true,
      message: "All available AiSensy API actions",
      data: {
        totalActions: totalActions,
        customerActions: allActions.customer.length,
        partnerActions: allActions.partner.length,
        generalActions: allActions.general.length,
        actions: allActions
      }
    });

  } catch (error) {
    console.error("❌ Error in getAllActions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching all actions",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};