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
      addOnNames, // Comma-separated string of add-on/sub-service names
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
    if (!customerPhone || !customerName || !serviceName || !scheduledDate || !scheduledTime || !locationAddress || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: customerPhone, customerName, serviceName, scheduledDate, scheduledTime, locationAddress, amount are required",
        received: {
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

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\+]?[1-9][\d]{3,14}$/;
    if (!phoneRegex.test(customerPhone.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format"
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

    // Process add-ons and sub-services
    const { selectedAddOns, totalAddOnAmount } = processAddOnsAndSubServices(popularService, addOnNames);

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
      selectedAddOns: selectedAddOns, // Store selected add-ons and sub-services
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

module.exports = { processAddOnsAndSubServices };