const PartnerService = require("../models/PartnerService");
const ServiceCategory = require("../models/ServiceCategory");
const Partner = require("../models/PartnerModel");
const Booking = require("../models/booking");
const PartnerProfile = require("../models/PartnerProfile");
const jwt = require("jsonwebtoken");
const SubService = require("../models/SubService");
const mongoose = require("mongoose");
const Product = require("../models/product");
const User = require("../models/User");
const Admin = require("../models/admin");
const NotificationModel = require("../models/Notification");
const PartnerWallet = require("../models/PartnerWallet");
const MGPlan = require("../models/MGPlan");
// Get all available services for partners
const admin = require('firebase-admin');
const { uploadFile2 } = require("../middleware/aws");
const DriverBooking = require("../models/DriverBooking");
const { sendOTP } = require("../utils/sendOTP");
const sendBookingAcceptanceNotifications = async (booking, user, subService, partner, admins) => {
  try {
    // User notification
    const userNotification = {
      title: 'Booking Accepted',
      message: `Your booking for ${subService.name} has been accepted by ${partner.name}!`,
      userId: user._id,
      type: 'booking_accepted',
      read: false,
      skipFcm: true, // Prevent post-save hook from sending FCM
    };

    // Save user notification to Notification collection
    // const userDoc = new Notification(userNotification);
    // await userDoc.save();

    // Send FCM to user if token exists
    if (user.fcmToken) {
      const userMessage = {
        notification: {
          title: userNotification.title,
          body: userNotification.message.length > 100
            ? userNotification.message.slice(0, 97) + '...'
            : userNotification.message,
        },
        data: {
          type: 'new-notification', // Align with FirebaseProvider
          userId: user._id.toString(),
          bookingId: booking._id.toString(),
          title: userNotification.title,
          message: userNotification.message.length > 100
            ? userNotification.message.slice(0, 97) + '...'
            : userNotification.message,
          timestamp: new Date().toISOString(),
        },
        token: user.fcmToken,
        android: {
          priority: 'high',
          ttl: 60 * 60 * 24,
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
            },
          },
          headers: {
            'apns-priority': '5',
          },
        },
      };

      // Validate payload size
      const userPayloadString = JSON.stringify(userMessage);
      const userPayloadSize = Buffer.byteLength(userPayloadString, 'utf8');
      if (userPayloadSize > 4096) {
        console.error(`User FCM payload too large: ${userPayloadSize} bytes`);
        userMessage.notification.body = userMessage.notification.body.slice(0, 50) + '...';
        userMessage.data.message = userMessage.data.message.slice(0, 50) + '...';
        const fallbackSize = Buffer.byteLength(JSON.stringify(userMessage), 'utf8');
        if (fallbackSize > 4096) {
          console.error(`User fallback payload still too large: ${fallbackSize} bytes`);
          throw new Error('User FCM payload exceeds size limit');
        }
      }

      console.log(`Sending FCM to user: ${user._id}`);
      await admin.messaging().send(userMessage);
      console.log(`FCM sent to user: ${user._id}`);
    } else {
      console.log(`No FCM token for user: ${user._id}`);
    }

    // Admin notifications
    const adminNotificationMessage = `Booking #${booking._id} for ${subService.name} has been accepted by partner ${partner.name}`;
    const adminNotification = {
      title: 'Booking Accepted',
      message: adminNotificationMessage,
      type: 'booking_accepted',
      read: false,
      skipFcm: true,
    };

    // Save admin notifications individually
    await Promise.all(
      admins.map(async (admin) => {
        try {
          const adminDoc = new Notification({
            ...adminNotification,
            userId: admin._id,
          });
          await adminDoc.save();
          console.log(`Admin notification saved for admin: ${admin._id}`);

          // Send FCM to admin if token exists
          if (admin.fcmToken) {
            const adminMessage = {
              notification: {
                title: adminNotification.title,
                body: adminNotification.message.length > 100
                  ? adminNotification.message.slice(0, 97) + '...'
                  : adminNotification.message,
              },
              data: {
                type: 'new-notification', // Align with FirebaseProvider
                userId: admin._id.toString(),
                bookingId: booking._id.toString(),
                title: adminNotification.title,
                message: adminNotification.message.length > 100
                  ? adminNotification.message.slice(0, 97) + '...'
                  : adminNotification.message,
                timestamp: new Date().toISOString(),
                partnerName: partner.name,
              },
              token: admin.fcmToken,
              android: {
                priority: 'high',
                ttl: 60 * 60 * 24,
              },
              apns: {
                payload: {
                  aps: {
                    contentAvailable: true,
                  },
                },
                headers: {
                  'apns-priority': '5',
                },
              },
            };

            // Validate payload size
            const adminPayloadString = JSON.stringify(adminMessage);
            const adminPayloadSize = Buffer.byteLength(adminPayloadString, 'utf8');
            if (adminPayloadSize > 4096) {
              console.error(`Admin FCM payload too large for ${admin._id}: ${adminPayloadSize} bytes`);
              adminMessage.notification.body = adminMessage.notification.body.slice(0, 50) + '...';
              adminMessage.data.message = adminMessage.data.message.slice(0, 50) + '...';
              const fallbackSize = Buffer.byteLength(JSON.stringify(adminMessage), 'utf8');
              if (fallbackSize > 4096) {
                console.error(`Admin fallback payload still too large: ${fallbackSize} bytes`);
                return;
              }
            }

            console.log(`Sending FCM to admin: ${admin._id}`);
            await admin.messaging().send(adminMessage);
            console.log(`FCM sent to admin: ${admin._id}`);
          } else {
            console.log(`No FCM token for admin: ${admin._id}`);
          }
        } catch (error) {
          console.error(`Error processing admin ${admin._id}:`, error.message);
        }
      }),
    );

    return true;
  } catch (error) {
    console.error('Booking acceptance notification error:', error);
    return { success: false, error: error.message };
  }
};

exports.getAvailableServices = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ status: "active" })
      .select("name description icon services")
      .where("services.status")
      .equals("active");

    res.json(categories);
  } catch (error) {
    console.error("Get Available Services Error:", error);
    res.status(500).json({ message: "Error fetching available services" });
  }
};

// Select services by partner
exports.selectService = async (req, res) => {
  try {
    const { categoryId, serviceId } = req.params;
    const { price, experience, certificates, availability } = req.body;

    // 1. Validate partner status
    if (
      req.partner.status !== "approved" ||
      req.partner.kycStatus !== "verified"
    ) {
      return res.status(403).json({
        success: false,
        message: "Complete profile approval and KYC verification first",
      });
    }

    // 2. Check for ongoing services
    const ongoingService = await PartnerService.findOne({
      partner: req.partner._id,
      status: {
        $in: ["active", "in_progress"],
      },
    });

    if (ongoingService) {
      return res.status(400).json({
        success: false,
        message:
          "Please complete your ongoing service before selecting a new one",
        currentService: {
          category: ongoingService.category,
          service: ongoingService.service,
          status: ongoingService.status,
        },
      });
    }

    // 3. Validate required fields
    if (!price || !experience) {
      return res.status(400).json({
        success: false,
        message: "Price and experience are required",
      });
    }

    // 4. Check if service exists
    const category = await ServiceCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const service = category.services.id(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // 5. Validate price against base price
    if (price < service.basePrice) {
      return res.status(400).json({
        success: false,
        message: `Price must be at least ${service.basePrice}`,
      });
    }

    // 6. Create new partner service
    const partnerService = new PartnerService({
      partner: req.partner._id,
      category: categoryId,
      service: serviceId,
      price,
      experience,
      certificates: certificates || [],
      status: "active", // Initial status
      availability: availability || {
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        timeSlots: [{ start: "09:00", end: "18:00" }],
      },
    });

    await partnerService.save();

    res.json({
      success: true,
      message: "Service selected successfully",
      service: partnerService,
    });
  } catch (error) {
    console.error("Select Service Error:", error);
    res.status(500).json({
      success: false,
      message: "Error selecting service",
    });
  }
};

// Get partner's selected services
exports.getMyServices = async (req, res) => {
  try {
    const services = await PartnerService.find({ partner: req.partner._id })
      .populate("category", "name description")
      .sort({ createdAt: -1 });

    res.json(services);
  } catch (error) {
    console.error("Get My Services Error:", error);
    res.status(500).json({ message: "Error fetching your services" });
  }
};

// Update partner service
exports.updateMyService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const updates = req.body;

    const service = await PartnerService.findOne({
      _id: serviceId,
      partner: req.partner._id,
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    // If price is being updated, validate against base price
    if (updates.price) {
      const category = await ServiceCategory.findById(service.category);
      const baseService = category.services.id(service.service);

      if (updates.price < baseService.basePrice) {
        return res.status(400).json({
          message: `Price cannot be less than base price of ${baseService.basePrice}`,
        });
      }
    }

    Object.assign(service, updates);
    await service.save();

    res.json({
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update Service Error:", error);
    res.status(500).json({ message: "Error updating service" });
  }
};

// Toggle service status (active/inactive)
exports.toggleServiceStatus = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const service = await PartnerService.findOne({
      _id: serviceId,
      partner: req.partner._id,
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    service.status = status;
    await service.save();

    res.json({
      message: `Service ${status === "active" ? "activated" : "deactivated"
        } successfully`,
      service,
    });
  } catch (error) {
    console.error("Toggle Service Status Error:", error);
    res.status(500).json({ message: "Error updating service status" });
  }
};

// Add a helper function to get partner's current service status
exports.getCurrentService = async (req, res) => {
  try {
    const currentService = await PartnerService.findOne({
      partner: req.partner._id,
      status: {
        $in: ["active", "in_progress"],
      },
    }).populate("category service");

    if (!currentService) {
      return res.json({
        success: true,
        message: "No active services found",
        canSelectNew: true,
      });
    }

    res.json({
      success: true,
      currentService,
      canSelectNew: false,
    });
  } catch (error) {
    console.error("Get Current Service Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching current service",
    });
  }
};

// Get service history
exports.getServiceHistory = async (req, res) => {
  try {
    const services = await PartnerService.find({
      partner: req.partner._id,
      status: { $in: ["completed", "cancelled"] },
    })
      .populate("category service")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Service History Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching service history",
    });
  }
};

// Update service status
exports.updateServiceStatus = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status } = req.body;

    const service = await PartnerService.findOne({
      _id: serviceId,
      partner: req.partner._id,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    service.status = status;
    await service.save();

    res.json({
      success: true,
      message: "Service status updated",
      service,
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating service status",
    });
  }
};

// Get matching bookings for partner
exports.getMatchingBookings = async (req, res) => {
  try {
    // Get partner's profile
    const profile = await Partner.findOne({ _id: req.partner._id })
      .populate('mgPlan')
      .populate({
        path: 'serviceHubs.services',
        select: 'name'
      });
    // console.log("Profile:", profile);

    if (!profile) {
      return res.status(400).json({
        success: false,
        message: "Partner profile not found",
      });
    }

    const wallet = await PartnerWallet.findOne({ partner: req.partner._id });
    if (!wallet) {
      return res.status(400).json({
        success: false,
        message: "Partner wallet not found",
      });
    }

    const plan = profile?.mgPlan;
    const minWalletBalance = plan?.minWalletBalance ?? DEFAULT_MIN_WALLET_BALANCE;

    if (wallet.balance < minWalletBalance) {
      profile.leadAcceptancePaused = true;
      await profile.save();
      return res.status(400).json({
        success: false,
        message: `Wallet balance low. Maintain at least ₹${minWalletBalance} to receive leads.`,
        walletBalance: wallet.balance,
        minWalletBalance,
        leadAcceptancePaused: true
      });
    }

    let driveBookings = []

    if (profile.drive || profile.tempoTraveller) {
      driveBookings = await DriverBooking.find({})
    }

    // Get partner's selected category, sub-category, and services
    const { category, subcategory, service } = profile;

    const serviceIds = new Set(
      (Array.isArray(service) ? service : [])
        .map((id) => id && id.toString())
        .filter(Boolean)
    );
    const hubPinCodes = new Set();

    if (Array.isArray(profile.serviceHubs) && profile.serviceHubs.length) {
      profile.serviceHubs.forEach((hub) => {
        (hub.pinCodes || []).forEach((pin) => {
          if (pin) hubPinCodes.add(pin.toString().trim());
        });
        (hub.services || []).forEach((srv) => {
          const sid = srv?._id ? srv._id.toString() : srv?.toString();
          if (sid) serviceIds.add(sid);
        });
      });
    }

    if (!category || !subcategory || serviceIds.size === 0) {
      return res.status(400).json({
        success: false,
        message: "Partner category, sub-category, or services not set",
      });
    }

    // console.log("Partner Category:", category);
    // console.log("Partner Sub-Category:", subcategory);
    // console.log("Partner Services:", service);

    // Find sub-services that belong to the partner's selected services
    const subServices = await SubService.find({
      service: { $in: Array.from(serviceIds) },
    }).select("_id service").sort({ updatedAt: -1 })

    if (!subServices || subServices.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No sub-services found for the selected services",
      });
    }

    const subServiceIds = subServices.map((subService) => subService._id);
    // console.log("Eligible Sub-Services:", subServiceIds);

    // Find bookings where sub-service matches the partner's selected service
    const bookingQuery = {
      subService: { $in: subServiceIds },
      status: { $in: ["pending"] },
    };

    if (hubPinCodes.size > 0) {
      bookingQuery["location.pincode"] = { $in: Array.from(hubPinCodes) };
    }

    const bookings = await Booking.find(bookingQuery)
      .populate({
        path: "service",
        populate: {
          path: "subCategory",
          model: "SubCategory",
          populate: {
            path: "category",
            model: "ServiceCategory",
            select: "name", // Ensure the category name is fetched

          },
        },
      })
      .populate({
        path: "user",
        select: "name phone email", // Ensure user details are fetched
      })
      .populate({
        path: "subService",
        select: "name price duration description acceptCharges minimumAmount", // Ensure sub-service details are fetched
      })
      .populate({
        path: "service",
        select: "name", // Ensure service name is fetched
      })
      .populate({
        path: "subCategory",
        model: "SubCategory",
        select: "name", // Ensure subcategory name is fetched
      })
      .select("-__v")
      .sort({ updatedAt: -1 })
    // .sort({ scheduledDate: 1, scheduledTime: 1 });

    // console.log("Found Bookings Count:", bookings.length);

    // Format the response
    const formattedBookings = bookings.map((booking) => {
      const bookingPin = (booking.location?.pincode || '').toString().trim();
      const profilePin = (profile.profile?.pincode || '').toString().trim();
      const hubMatch = hubPinCodes.size > 0 ? hubPinCodes.has(bookingPin) : true;
      const profileMatch = profilePin ? bookingPin === profilePin : true;

      return {
        bookingId: booking._id,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        amount: booking.amount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        location: booking.location,
        user: {
          name: booking.user?.name || "N/A",
          phone: booking.user?.phone || "N/A",
          email: booking.user?.email || "N/A",
        },
        subService: {
          name: booking.subService?.name || "N/A",
          price: booking.subService?.price || 0,
          duration: booking.subService?.duration || "N/A",
          description: booking.subService?.description || "N/A",
          acceptCharges: booking.subService?.acceptCharges || 0,
        },
        service: {
          name: booking.service?.name || "N/A",
        },
        category: {
          name: booking.category?.name || "N/A",
        },
        subCategory: {
          name: booking.subCategory?.name || "N/A",
        },
        driveBookings,
        pinCodeMatch: hubMatch && profileMatch
      };
    });

    res.json({
      success: true,
      count: formattedBookings.length,
      partnerDetails: {
        category,
        subcategory,
        service,
        serviceHubs: profile.serviceHubs || [],
        walletBalance: wallet.balance,
        minWalletBalance,
        leadAcceptancePaused: profile.leadAcceptancePaused,
        mgPlan: plan ? {
          name: plan.name,
          leadFee: plan.leadFee,
          minWalletBalance: plan.minWalletBalance
        } : null
      },
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("Get Matching Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching matching bookings",
      error: error.message,
    });
  }
};

const DEFAULT_LEAD_FEE = 50;
const DEFAULT_MIN_WALLET_BALANCE = 20;

async function deductWallet(updatedBooking, partnerDoc, leadFee, minBalance) {
  try {
    let wallet = await PartnerWallet.findOne({ partner: partnerDoc._id });
    if (!wallet) {
      wallet = await PartnerWallet.create({
        partner: partnerDoc._id,
        balance: 0,
        transactions: []
      });
    }

    const deductionAmount = leadFee ?? DEFAULT_LEAD_FEE;
    wallet.balance = wallet.balance - deductionAmount;
    if (wallet.balance < 0) {
      wallet.balance = Math.round(wallet.balance * 100) / 100;
    }

    wallet.transactions.push({
      type: "debit",
      amount: deductionAmount,
      description: `Lead acceptance fee for ${updatedBooking.subService?.name || 'service'}`,
      reference: updatedBooking._id?.toString() || '',
      balance: wallet.balance
    });
    await wallet.save();

    // 🆕 CREATE PAYMENT TRANSACTION RECORD FOR LEAD FEE
    try {
      const { PaymentTransaction } = require('../models/RegisterFee');
      const timestamp = Date.now();
      
      await PaymentTransaction.create({
        partnerId: partnerDoc._id.toString(),
        amount: deductionAmount,
        status: 'success',
        paymentMethod: 'wallet',
        transactionId: `LEAD-${partnerDoc._id}-${timestamp}`,
        feeType: 'lead_fee',
        description: `Lead acceptance fee - ${updatedBooking.subService?.name || 'service'} - Booking: ${updatedBooking._id}`,
        source: 'partner',
        metadata: {
          source: 'partner',
          partnerName: partnerDoc.profile?.name || 'Unknown',
          partnerPhone: partnerDoc.phone,
          partnerEmail: partnerDoc.profile?.email,
          bookingId: updatedBooking._id?.toString(),
          serviceName: updatedBooking.subService?.name,
          walletBalanceAfter: wallet.balance,
          leadFeeDeduction: true
        }
      });
      
      console.log(`✅ Lead fee transaction recorded: ₹${deductionAmount} for partner ${partnerDoc._id}`);
    } catch (txnError) {
      console.error('❌ Error recording lead fee transaction:', txnError);
      // Don't fail the main operation if transaction recording fails
    }

    if (wallet.balance < minBalance) {
      partnerDoc.leadAcceptancePaused = true;
    } else {
      partnerDoc.leadAcceptancePaused = false;
    }

    if (updatedBooking.subService) {
      updatedBooking.subService.acceptCharges = deductionAmount;
    }

    await NotificationModel.create({
      userId: partnerDoc._id,
      title: "Accepted Booking",
      message: `Lead acceptance fee of ₹${deductionAmount} has been deducted. Current wallet balance: ₹${wallet.balance}.`
    });
  } catch (error) {
    console.error("Wallet deduction error:", error);
  }
}
//accept booking
exports.acceptBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { partnerId } = req.body;

    if (!bookingId || !partnerId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and Partner ID are required",
      });
    }

    console.log("Partner ID:", partnerId);
    console.log("Booking ID:", bookingId);

    // Validate partner existence
    const partner = await Partner.findById(partnerId).populate('mgPlan');
    if (!partner) {
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    }

    // Validate booking existence
    const booking = await Booking.findById(bookingId)
      .populate('user')
      .populate('subService');

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // console.log("Current Booking Status:", booking.status);

    // Check if booking is already accepted or canceled
    if (["accepted", "cancelled"].includes(booking.status) || booking.partner) {
      return res.status(400).json({
        success: false,
        message: "This booking has already been accepted or cancelled",
      });
    }

    let planDetails = null;
    if (partner.mgPlan && partner.mgPlan._id) {
      planDetails = partner.mgPlan;
    } else if (partner.mgPlan) {
      planDetails = await MGPlan.findById(partner.mgPlan);
    }

    if (!planDetails) {
      planDetails = await MGPlan.findOne({ isDefault: true, isActive: true });
      if (!planDetails) {
        planDetails = await MGPlan.findOne({ name: 'Silver', isActive: true });
      }
      if (planDetails) {
        partner.mgPlan = planDetails._id;
        partner.mgPlanLeadQuota = planDetails.leads;
        partner.mgPlanLeadsUsed = partner.mgPlanLeadsUsed || 0;
        partner.mgPlanSubscribedAt = partner.mgPlanSubscribedAt || new Date();
        partner.mgPlanExpiresAt = partner.mgPlanExpiresAt || new Date(new Date().setMonth(new Date().getMonth() + 1));
        if (!Array.isArray(partner.mgPlanHistory) || !partner.mgPlanHistory.length) {
          partner.mgPlanHistory = [{
            plan: planDetails._id,
            planName: planDetails.name,
            price: planDetails.price,
            leadsGuaranteed: planDetails.leads,
            commissionRate: planDetails.commission,
            leadFee: planDetails.leadFee,
            subscribedAt: partner.mgPlanSubscribedAt,
            expiresAt: partner.mgPlanExpiresAt,
            leadsConsumed: partner.mgPlanLeadsUsed || 0,
            refundStatus: 'pending',
            refundNotes: planDetails.refundPolicy
          }];
          partner.markModified('mgPlanHistory');
        }
      }
    }

    const leadFee = planDetails?.leadFee ?? DEFAULT_LEAD_FEE;
    const minWalletBalance = planDetails?.minWalletBalance ?? DEFAULT_MIN_WALLET_BALANCE;
    const leadsGuaranteed = planDetails?.leads ?? 0;
    const leadsUsed = partner.mgPlanLeadsUsed ?? 0;

    // Ensure MG plan quota and expiry
    const now = new Date();
    if (partner.mgPlanExpiresAt && now > partner.mgPlanExpiresAt) {
      partner.leadAcceptancePaused = true;
      await partner.save();
      return res.status(403).json({
        success: false,
        message: 'MG plan period has expired. Renew your plan to continue accepting leads.'
      });
    }

    if (leadsGuaranteed > 0 && leadsUsed >= leadsGuaranteed) {
      partner.leadAcceptancePaused = true;
      await partner.save();
      return res.status(403).json({
        success: false,
        message: 'Lead quota exhausted for the current MG plan. Upgrade or renew your plan to continue accepting leads.'
      });
    }

    let wallet = await PartnerWallet.findOne({ partner: partnerId });
    const walletBalance = wallet?.balance ?? 0;
    if (walletBalance < leadFee) {
      const requiredTopUp = Math.max((minWalletBalance + leadFee) - walletBalance, minWalletBalance);
      partner.leadAcceptancePaused = true;
      await partner.save();
      return res.status(402).json({
        success: false,
        message: `Your wallet balance is ₹${walletBalance}. Recharge to continue accepting leads.`,
        walletBalance,
        requiredTopUp,
        suggestedTopUps: [500, 1000],
        minWalletBalance,
        leadFee
      });
    }

    // Update Booking: Assign partner and change status to 'accepted'
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        partner: partnerId,
        status: "accepted",
        acceptedAt: new Date(),
      },
      { new: true }
    )
      .populate({
        path: "partner",
      })
      .populate({
        path: "user",
      })
      .populate({
        path: "subService",
      })
      .populate({
        path: "service",
      });

    // Update Partner: Add booking to bookings array
    await Partner.findByIdAndUpdate(
      partnerId,
      { $addToSet: { bookings: bookingId } },
      { new: true }
    );

    // Get admin details for notifications
    const admins = await Admin.find({});
    // console.log("updatedBooking : " , updatedBooking)
    // Send notifications (non-blocking)
    sendBookingAcceptanceNotifications(
      updatedBooking,
      updatedBooking.user,
      updatedBooking.subService,
      updatedBooking.partner,
      admins
    );

    // Additional notification using notification service - Ensure admin gets notified
    try {
      const { sendAllAdminsNotification } = require("../services/notificationService");
      await sendAllAdminsNotification(
        'Booking Accepted by Partner',
        `Partner ${updatedBooking.partner?.profile?.name || updatedBooking.partner?.phone || 'Unknown'} has accepted booking #${bookingId} for ${updatedBooking.subService?.name || 'Service'}.`,
        'info',
        '/android-chrome-192x192.png'
      );
      console.log('[Notification] Admin notification sent for booking acceptance');
    } catch (adminNotifError) {
      console.error('[Notification] Failed to send admin notification for acceptance:', adminNotifError);
    }

    Booking.generateMissingOTPs()


    // Deduct wallet with MG plan rules
    await deductWallet(updatedBooking, partner, leadFee, minWalletBalance);

    // Update MG plan usage
    if (planDetails) {
      partner.mgPlanLeadsUsed = (partner.mgPlanLeadsUsed || 0) + 1;
      partner.mgPlanLeadQuota = planDetails.leads;
      const history = Array.isArray(partner.mgPlanHistory) ? partner.mgPlanHistory : [];
      if (history.length) {
        const latestEntry = history[history.length - 1];
        const currentPlanId = planDetails._id?.toString();
        if (!latestEntry.plan || latestEntry.plan.toString() === currentPlanId) {
          latestEntry.leadsConsumed = (latestEntry.leadsConsumed || 0) + 1;
        } else {
          const matchedEntry = history.find((entry) => entry.plan && entry.plan.toString() === currentPlanId);
          if (matchedEntry) {
            matchedEntry.leadsConsumed = (matchedEntry.leadsConsumed || 0) + 1;
          }
        }
        partner.markModified('mgPlanHistory');
      }
    }

    await partner.save();

    res.status(200).json({
      success: true,
      message: "Booking accepted successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("Error accepting booking:", error);
    res.status(500).json({
      success: false,
      message: "Error accepting booking",
      error: error.message,
    });
  }
};

exports.getBookingBybookid = async (req, res) => {
  try {
    let bookingId = req.params.bookingId;
    let booking = await Booking.findById(bookingId).populate("user subService").populate({ path: "cart.product" });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Booking found",
      data: booking,
    });
  } catch (error) {
    console.log(error);
  }
};

// Get completed bookings
// Get completed bookings
// Get completed bookings
// exports.getCompletedBookings = async (req, res) => {
//   try {
//     const completedBookings = await Booking.find({
//       partner: req.partner._id,
//       status: "completed",
//     })
//       .populate({
//         path: "user",
//         select: "profilePhoto",
//       })
//       .populate({
//         path: "subService",
//         select: "photo",
//       })
//       .populate({
//         path: "partner",
//         select: "profilePicture",
//       })
//       .sort({ completedAt: -1 });

//     if (!completedBookings.length) {
//       return res.status(200).json({
//         success: true,
//         message: "No completed bookings found",
//         data: [],
//       });
//     }

//     // Extract only filenames from photos and videos
//     const formattedBookings = completedBookings.map((booking) => ({
//       photoUrls: booking.photos?.map((photo) => photo.split("\\").pop()) || [],
//       videoUrls: booking.videos?.map((video) => video.split("\\").pop()) || [],
//     }));

//     res.status(200).json({
//       success: true,
//       message: "Completed bookings fetched successfully",
//       data: formattedBookings,
//     });
//   } catch (error) {
//     console.error("Error fetching completed bookings:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching completed bookings",
//       error: error.message,
//     });
//   }
// };

// Get rejected bookings
// Get rejected bookings for the logged-in partner

// Reject booking
// Reject booking
exports.rejectBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { partnerId } = req.body;

    if (!bookingId || !partnerId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and Partner ID are required",
      });
    }

    console.log("Partner ID:", partnerId);
    console.log("Booking ID:", bookingId);

    // Validate partner existence
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    }

    // Validate booking existence
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // console.log("Current Booking Status:", booking.status);

    // Check if booking is already accepted, rejected, or canceled
    if (["accepted", "cancelled", "rejected"].includes(booking.status)) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot reject this booking" });
    }

    // Update Booking: Change status to 'rejected' and assign the partner
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { status: "rejected", partner: partnerId }, // Added 'partner' field here
      { new: true }
    )
      .populate("subService")
      .populate("user")
      .populate("partner");

    // Send notification to partner
    await NotificationModel.create({
      userId: partnerId,
      title: "Rejected Booking",
      message: `Your booking for ${updatedBooking.subService.name} has been Rejected!`,
    });

    // Send admin notification
    try {
      const { sendAllAdminsNotification } = require("../services/notificationService");
      await sendAllAdminsNotification(
        'Booking Rejected by Partner',
        `Partner ${updatedBooking.partner?.profile?.name || updatedBooking.partner?.phone || 'Unknown'} rejected booking #${bookingId} for ${updatedBooking.subService?.name || 'Service'}`,
        'info'
      );
      console.log('[Notification] Admin notification sent for booking rejection');
    } catch (adminNotifError) {
      console.error('[Notification] Failed to send admin notification for rejection:', adminNotifError);
    }

    res.status(200).json({
      success: true,
      message: "Booking rejected successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("Error rejecting booking:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting booking",
      error: error.message,
    });
  }
};

// Complete booking - Partner uploads photos and videos before marking the job as completed
// Complete booking - Partner uploads photos and videos before marking the job as completed

const sendBookingCompletionNotifications = async (booking, user, subService, partner, admins) => {
  try {
    const { sendPartnerNotification, sendAllAdminsNotification } = require("../services/notificationService");
    
    // User notification
    const userNotification = {
      message: `Your booking for ${subService.name} has been completed by ${partner.profile?.name || partner.name || 'Partner'}. Please provide your feedback!`,
      booking: booking._id,
      seen: false,
      date: new Date(),
      type: 'booking_completed'
    };

    // Add notification to user
    user.notifications.push(userNotification);
    await user.save();

    // Send FCM to user if token exists
    if (user.fcmToken) {
      const userMessage = {
        notification: {
          title: 'Booking Completed',
          body: userNotification.message
        },
        data: {
          bookingId: booking._id.toString(),
          type: 'booking_completed',
          title: 'Booking Completed',
          body: userNotification.message,
          timestamp: new Date().toISOString(),
          partnerName: partner.profile?.name || partner.name || 'Partner',
          action: 'rate_booking'
        },
        token: user.fcmToken,
        android: {
          priority: 'high',
          ttl: 60 * 60 * 24 * 3 // 3 days retention
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
              mutableContent: 1
            }
          },
          headers: {
            'apns-priority': '5'
          }
        }
      };

      await admin.messaging().send(userMessage);
    }

    // Notify partner using notification service
    try {
      await sendPartnerNotification(
        partner._id,
        'Job Completed Successfully',
        `You have successfully completed booking for ${subService.name}. Payment will be processed shortly.`,
        'job_completed'
      );
      console.log('[Notification] Partner notification sent for job completion');
    } catch (partnerNotifError) {
      console.error('[Notification] Failed to send partner notification:', partnerNotifError);
    }

    // Notify all admins using notification service
    try {
      await sendAllAdminsNotification(
        'Job Completed by Partner',
        `Partner ${partner.profile?.name || partner.name || 'Unknown'} completed booking #${booking.bookingId || booking._id.toString().slice(-8)} for ${subService.name}`,
        'info'
      );
      console.log('[Notification] Admin notifications sent for job completion');
    } catch (adminNotifError) {
      console.error('[Notification] Failed to send admin notifications:', adminNotifError);
    }

    return true;
  } catch (error) {
    console.error('Booking completion notification error:', error);
    return false;
  }
};


exports.completeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("check", req.body);
    const files = req.files;
    const { payamout, paymentMode, teamMember, remark } = req.body;


    // Process file uploads
    const photos = files.photos
      ? await Promise.all(files.photos.map(async (file) => await uploadFile2(file, "Job")))
      : [];
    const videos = files.videos
      ? await Promise.all(files.videos.map(async (file) => await uploadFile2(file, "Job")))
      : [];
    if (files.afterVideo) {
      const videoA = await Promise.all(files.afterVideo.map(async (file) => await uploadFile2(file, "Job")))

      videos.push(videoA[0]);
    }

    // Find and update the booking with populated data
    const booking = await Booking.findByIdAndUpdate(
      id,
      {
        status: "completed",
        paymentStatus: "completed",
        photos,
        videos,
        completedAt: new Date(),
        ...(teamMember && { teamMember }), // Add teamMember if provided
        ...(remark && { remark }), // Add remark if provided
      },
      { new: true }
    )
      .populate({
        path: "user",
      })
      .populate({
        path: "subService",
      })
      .populate({
        path: "partner",
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }
    if (payamout && payamout != 0) {
      booking.payamount = booking.payamount + Number(payamout);
      booking.paymentMode = paymentMode;
    }

    if (paymentMode === "cash" && payamout) {
      const partnerWallet = await PartnerWallet.findOne({ partner: booking.partner._id });
      if (!partnerWallet) {
        return res.status(404).json({
          success: false,
          message: "Partner wallet not found",
        });
      }
      partnerWallet.balance = partnerWallet.balance - Number(payamout);
      partnerWallet.transactions.push({
        amount: payamout,
        type: "debit",
        description: `Payment for booking ${booking.subService.name} completed${teamMember ? ` by team member` : ''}`,
        reference: booking._id,
        balance: partnerWallet.balance,
        booking: booking._id,
        ...(teamMember && { teamMember }), // Add teamMember if provided
      })
      await partnerWallet.save();
    }


    booking.paymentStatus = "completed";
    await booking.save();

    // Get admin details for notifications
    const admins = await Admin.find({}).select('fcmToken');

    // Send completion notifications (non-blocking but with better error handling)
    sendBookingCompletionNotifications(
      booking,
      booking.user,
      booking.subService,
      booking.partner,
      admins
    ).then(success => {
      if (success) {
        console.log('[Notification] Completion notifications sent successfully');
      } else {
        console.error('[Notification] Completion notifications failed');
      }
    }).catch(error => {
      console.error('[Notification] Error in completion notifications:', error);
    });

    // Also send direct admin notification to ensure it's sent
    try {
      const { sendAllAdminsNotification } = require("../services/notificationService");
      await sendAllAdminsNotification(
        'Job Completed by Partner',
        `Partner ${booking.partner?.profile?.name || booking.partner?.name || 'Unknown'} completed booking #${booking.bookingId || booking._id.toString().slice(-8)} for ${booking.subService?.name || 'service'}`,
        'info'
      );
      console.log('[Notification] Direct admin notification sent for job completion');
    } catch (directNotifError) {
      console.error('[Notification] Direct admin notification failed:', directNotifError);
    }

    res.status(200).json({
      success: true,
      message: "Booking completed successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error completing booking:", error);
    res.status(500).json({
      success: false,
      message: "Error completing booking",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get completed bookings
exports.getCompletedBookings = async (req, res) => {
  try {
    // Find completed bookings for the partner
    const completedBookings = await Booking.find({
      partner: req.partner._id,
      status: "completed",
    })
      .populate("user", "name email phone") // Populate user details
      .populate("service", "name") // Populate service details
      .populate("subService", "name") // Populate subService details
      .populate("teamMember", "name phone role") // Populate team member details
      .select("-__v") // Exclude version key
      .sort({ updatedAt: -1 }); // Sort by completion date, newest first

    if (!completedBookings.length) {
      return res.status(200).json({
        success: true,
        message: "No completed bookings found",
        bookings: [],
      });
    }

    // Format response with additional booking details
    const formattedBookings = completedBookings.map((booking) => ({
      _id: booking._id,
      user: booking.user,
      service: booking.service,
      subService: booking.subService,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      location: booking.location,
      amount: booking.amount,
      paymentMode: booking.paymentMode,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      completedAt: booking.completedAt,
      photoUrls: booking.photos?.map((photo) => photo.split("\\").pop()) || [],
      videoUrls: booking.videos?.map((video) => video.split("\\").pop()) || [],
    }));

    res.status(200).json({
      success: true,
      message: "Completed bookings fetched successfully",
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("Error fetching completed bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching completed bookings",
      error: error.message || "Unknown error",
    });
  }
};

// Get pending bookings
exports.getPendingBookings = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1]; // Get the token from the header
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode the token
    const partnerId = decoded._id; // Extract partner ID from the decoded token

    const pendingBookings = await Booking.find({
      partnerId: partnerId,
      status: "pending",
    }).sort({ updatedAt: -1 });

    if (!pendingBookings.length) {
      return res.status(404).json({ message: "No pending bookings found" });
    }

    res.status(200).json({
      message: "Pending bookings fetched successfully",
      bookings: pendingBookings,
    });
  } catch (error) {
    console.error("Error fetching pending bookings:", error);
    res.status(500).json({
      message: "Error fetching pending bookings",
      error: error.message || "Unknown error",
    });
  }
};

// Get rejected bookings
// Get rejected bookings for the logged-in partner
exports.getRejectedBookings = async (req, res) => {
  try {
    // Find rejected bookings for the partner
    const rejectedBookings = await Booking.find({
      partner: req.partner._id, // Using req.partner._id instead of decoded token
      status: "rejected",
    })
      .populate("service", "name") // Populate service details
      .populate("subService", "name") // Populate subService details
      .populate("user")
      .select("-__v") // Exclude version key
      .sort({ updatedAt: -1 }); // Sort by rejected date, newest first

    if (!rejectedBookings.length) {
      return res.status(200).json({
        success: true,
        message: "No rejected bookings found",
        bookings: [],
      });
    }
    // console.log("rejectedBookings : ", rejectedBookings);
    res.status(200).json({
      success: true,
      message: "Rejected bookings fetched successfully",
      bookings: rejectedBookings,
    });
  } catch (error) {
    console.error("Error fetching rejected bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching rejected bookings",
      error: error.message || "Unknown error",
    });
  }
};

// Pause a booking
// exports.pauseBooking = async (req, res) => {
//   console.log(
//     "now i am going to pause the booking ................................................"
//   );

//   try {
//     const { bookingId } = req.params;
//     const { nextScheduledDate, nextScheduledTime, pauseReason } = req.body;
//     console.log(
//       " nextScheduledDate, nextScheduledTime, pauseReason",
//       nextScheduledDate,
//       nextScheduledTime,
//       pauseReason
//     );
//     // Find the booking and verify it belongs to this partner
//     const booking = await Booking.findOne({
//       _id: bookingId,
//       partner: req.partner._id,
//       status: { $in: ["accepted", "in_progress"] },
//     });

//     if (!booking) {
//       return res.status(404).json({
//         success: false,
//         message: "Booking not found or cannot be paused",
//       });
//     }

//     // Update the booking status and pause details
//     booking.status = "paused";
//     booking.pauseDetails = {
//       nextScheduledDate: new Date(nextScheduledDate),
//       nextScheduledTime,
//       pauseReason,
//       pausedAt: new Date(),
//     };
//     console.log("booking", booking);
//     await booking.save();

//     res.status(200).json({
//       success: true,
//       message: "Booking paused successfully",
//       data: booking,
//     });
//   } catch (error) {
//     console.error("Error pausing booking:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error pausing booking",
//       error: error.message,
//     });
//   }
// };

const sendBookingPauseNotifications = async (booking, user, subService, partner, admins, pauseDetails) => {
  try {
    const { sendPartnerNotification, sendAllAdminsNotification } = require("../services/notificationService");
    // Validate required parameters
    if (!booking || !user || !subService || !partner || !pauseDetails) {
      console.error('Missing required parameters for booking pause notification');
      return false;
    }

    // Ensure notifications arrays exist
    if (!user.notifications) {
      user.notifications = [];
    }
    if (!partner.notifications) {
      partner.notifications = [];
    }

    // User notification
    const userNotification = {
      message: `Your booking for ${subService.name} has been paused. Reason: ${pauseDetails.pauseReason}. Will resume on ${pauseDetails.nextScheduledDate}`,
      booking: booking._id,
      seen: false,
      date: new Date(),
      type: 'booking_paused'
    };

    // Add notification to user
    user.notifications.push(userNotification);
    await user.save();

    // Send FCM to user if token exists
    if (user.fcmToken) {
      const userMessage = {
        notification: {
          title: 'Booking Paused',
          body: userNotification.message
        },
        data: {
          bookingId: booking._id.toString(),
          type: 'booking_paused',
          title: 'Booking Paused',
          body: userNotification.message,
          timestamp: new Date().toISOString(),
          resumeDate: pauseDetails.nextScheduledDate.toISOString(),
          pauseReason: pauseDetails.pauseReason
        },
        token: user.fcmToken,
        android: {
          priority: 'high',
          ttl: 60 * 60 * 24 * 7 // 1 week retention for paused bookings
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true
            }
          },
          headers: {
            'apns-priority': '5'
          }
        }
      };

      await admin.messaging().send(userMessage);
    }

    // Notify partner using notification service
    try {
      await sendPartnerNotification(
        partner._id,
        'Job Paused',
        `You have paused booking for ${subService.name}. Reason: ${pauseDetails.pauseReason}. Will resume on ${new Date(pauseDetails.nextScheduledDate).toLocaleDateString()} at ${pauseDetails.nextScheduledTime}`,
        'job_paused'
      );
      console.log('[Notification] Partner notification sent for job pause');
    } catch (partnerNotifError) {
      console.error('[Notification] Failed to send partner notification:', partnerNotifError);
    }

    // Notify all admins using notification service
    try {
      await sendAllAdminsNotification(
        'Job Paused by Partner',
        `Partner ${partner.profile?.name || partner.name || 'Unknown'} paused booking #${booking.bookingId || booking._id.toString().slice(-8)} for ${subService.name}. Reason: ${pauseDetails.pauseReason}. Will resume on ${new Date(pauseDetails.nextScheduledDate).toLocaleDateString()} at ${pauseDetails.nextScheduledTime}`,
        'info'
      );
      console.log('[Notification] Admin notifications sent for job pause');
    } catch (adminNotifError) {
      console.error('[Notification] Failed to send admin notifications:', adminNotifError);
    }

    return true;
  } catch (error) {
    console.error('Booking pause notification error:', error);
    console.error('Parameters received:', {
      booking: booking ? 'exists' : 'undefined',
      user: user ? 'exists' : 'undefined',
      subService: subService ? 'exists' : 'undefined',
      partner: partner ? 'exists' : 'undefined',
      admins: admins ? 'exists' : 'undefined',
      pauseDetails: pauseDetails ? 'exists' : 'undefined'
    });
    return false;
  }
};

exports.pauseBooking = async (req, res) => {
  console.log("Pausing the booking...");

  try {
    const { bookingId } = req.params;
    let { nextScheduledDate, nextScheduledTime, pauseReason } = req.body;

    console.log("Received:", {
      nextScheduledDate,
      nextScheduledTime,
      pauseReason,
      bookingId
    });

    // Validate inputs
    if (!nextScheduledDate || isNaN(new Date(nextScheduledDate).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid nextScheduledDate provided.",
      });
    }

    if (!nextScheduledTime) {
      return res.status(400).json({
        success: false,
        message: "Invalid nextScheduledTime provided.",
      });
    }

    // Find booking with populated data
    const booking = await Booking.findOne({
      _id: bookingId,
      status: { $in: ["accepted", "in_progress", "paused"] },
    })
      .populate('user')
      .populate('subService')
      .populate('partner');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or cannot be paused",
      });
    }

    // Prepare pause details
    const pauseDetails = {
      nextScheduledDate: new Date(nextScheduledDate),
      nextScheduledTime,
      pauseReason: pauseReason || "Not specified",
      pausedAt: new Date()
    };

    // Update booking
    booking.status = "paused";
    booking.pauseDetails = pauseDetails;
    await booking.save();

    // Get admin details for notifications
    const admins = await Admin.find({});

    // Send notifications (non-blocking but with better error handling)
    sendBookingPauseNotifications(
      booking,
      booking.user,
      booking.subService,
      booking.partner,
      admins,
      pauseDetails
    ).then(success => {
      if (success) {
        console.log('[Notification] Pause notifications sent successfully');
      } else {
        console.error('[Notification] Pause notifications failed');
      }
    }).catch(error => {
      console.error('[Notification] Error in pause notifications:', error);
    });

    // Also send direct admin notification to ensure it's sent
    try {
      const { sendAllAdminsNotification } = require("../services/notificationService");
      await sendAllAdminsNotification(
        'Job Paused by Partner',
        `Partner ${booking.partner?.profile?.name || booking.partner?.name || 'Unknown'} paused booking #${booking.bookingId || booking._id.toString().slice(-8)} for ${booking.subService?.name || 'service'}. Reason: ${pauseReason || 'Not specified'}. Will resume on ${new Date(nextScheduledDate).toLocaleDateString()} at ${nextScheduledTime}`,
        'info'
      );
      console.log('[Notification] Direct admin notification sent for job pause');
    } catch (directNotifError) {
      console.error('[Notification] Direct admin notification failed:', directNotifError);
    }

    res.status(200).json({
      success: true,
      message: "Booking paused successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error pausing booking:", error);
    res.status(500).json({
      success: false,
      message: "Error pausing booking",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get all paused bookings for a partner
exports.getPausedBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      partner: req.partner._id,
      status: "paused",
    })
      .populate("user", "name email phone")
      .populate("service", "name")
      .populate("subService", "name")
      .sort({
        "pauseDetails.nextScheduledDate": 1,
        "pauseDetails.nextScheduledTime": 1,
      });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching paused bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching paused bookings",
      error: error.message,
    });
  }
};

// Resume a paused booking
exports.resumeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Find the booking and verify it belongs to this partner and is paused
    const booking = await Booking.findOne({
      _id: bookingId,
      partner: req.partner._id,
      status: "paused",
    })
      .populate('user')
      .populate('subService')
      .populate('partner');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Paused booking not found",
      });
    }

    // Get the scheduled date and time from pauseDetails
    const { nextScheduledDate, nextScheduledTime } = booking.pauseDetails;

    // Update the booking
    booking.status = "in_progress";
    booking.scheduledDate = nextScheduledDate;
    booking.scheduledTime = nextScheduledTime;
    booking.pauseDetails = undefined; // Clear pause details

    await booking.save();

    // Send notifications to admin and partner
    try {
      const { sendPartnerNotification, sendAllAdminsNotification } = require("../services/notificationService");
      
      // Notify partner
      try {
        await sendPartnerNotification(
          booking.partner._id,
          'Job Resumed',
          `Job for ${booking.subService?.name || 'service'} has been resumed. Scheduled for ${new Date(nextScheduledDate).toLocaleDateString()} at ${nextScheduledTime}`,
          'job_resumed'
        );
        console.log('[Notification] Partner notification sent for job resume');
      } catch (partnerNotifError) {
        console.error('[Notification] Failed to send partner notification:', partnerNotifError);
      }

      // Notify all admins
      try {
        await sendAllAdminsNotification(
          'Job Resumed by Partner',
          `Partner ${booking.partner?.profile?.name || booking.partner?.phone || 'Unknown'} resumed job for ${booking.subService?.name || 'service'}. Booking ID: ${booking.bookingId || booking._id.toString().slice(-8)}`,
          'info'
        );
        console.log('[Notification] Admin notifications sent for job resume');
      } catch (adminNotifError) {
        console.error('[Notification] Failed to send admin notifications:', adminNotifError);
      }
    } catch (notifError) {
      console.error('[Notification] General notification error:', notifError);
      // Don't fail the request if notifications fail
    }

    res.status(200).json({
      success: true,
      message: "Booking resumed successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error resuming booking:", error);
    res.status(500).json({
      success: false,
      message: "Error resuming booking",
      error: error.message,
    });
  }
};

// Get accepted bookings for a specific partner
exports.getPartnerBookings = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const TeamMember = require("../models/TeamMember");

    // Get all team member IDs for this partner
    const teamMembers = await TeamMember.find({ partner: partnerId, status: "active" }).select("_id");
    const teamMemberIds = teamMembers.map(tm => tm._id);

    // Fetch bookings where partner = partnerId OR teamMember is in teamMemberIds
    const bookings = await Booking.find({
      $or: [
        { partner: partnerId, status: "accepted" },
        { teamMember: { $in: teamMemberIds }, status: "accepted" }
      ]
    })
      .populate({
        path: "user",
        select: "name email phone profilePicture address",
      })
      .populate({
        path: "subService",
        select: "name price photo description duration",
      })
      .populate({
        path: "service",
        select: "name description",
      })
      .populate({
        path: "partner",
        select:
          "name email phone profilePicture address experience qualification profile",
      })
      .populate({
        path: "teamMember",
        select: "name phone role",
      })
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      message: "Partner bookings retrieved successfully",
      data: bookings,
    });
  } catch (error) {
    console.error("Error getting partner bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error getting partner bookings",
      error: error.message,
    });
  }
};

// ✅ Get all products by category (For partners)
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params; // Extract category IDs from URL
    
    // Validate category parameter
    if (!category) {
      return res.status(400).json({ 
        success: false,
        message: "Category ID is required" 
      });
    }

    // Handle comma-separated category IDs
    const categoryIds = category.split(',').map(id => {
      const trimmedId = id.trim();
      // Validate if it's a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(trimmedId)) {
        throw new Error(`Invalid category ID: ${trimmedId}`);
      }
      return new mongoose.Types.ObjectId(trimmedId);
    });

    console.log("Received categoryIds:", categoryIds);

    // Fetch products that match any of the category IDs & have stock available
    const products = await Product.find({
      category: { $in: categoryIds },
      stock: { $gt: 0 },
    });

    console.log(`Found ${products.length} products for categories:`, categoryIds);

    // Return success response even if no products found
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
      message: products.length === 0 ? "No products found for this category" : "Products fetched successfully"
    });

  } catch (error) {
    console.error("Error fetching products by category:", error);
    
    // Handle specific error types
    if (error.message.includes('Invalid category ID')) {
      return res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Error fetching products", 
      error: error.message 
    });
  }
};

// add to cart (Products)
// Add Product to Cart (General Cart or Booking Cart)
exports.addToCart = async (req, res) => {
  try {
    const { bookingId, productId, quantity, change } = req.body;
    const partnerId = req.partner.id; // Assuming partner authentication is handled

    // Validate Partner
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Validate Product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // If bookingId is provided, add to booking cart (existing functionality)
    if (bookingId) {
      // Validate Booking (Ensure it belongs to this partner & is accepted)
      let booking = await Booking.findOne({
        _id: bookingId,
        partner: partnerId, // Ensure booking belongs to this partner
      });

      if (!booking) {
        return res.status(400).json({ message: "Invalid or unaccepted booking" });
      }

      // Initialize cart if empty
      if (!booking.cart) {
        booking.cart = [];
      }

      const finalQuantity = change || quantity || 1;

      // Check if product already exists in cart
      const existingItemIndex = booking.cart.findIndex(
        (item) => item.product.toString() === productId
      );

      if (existingItemIndex !== -1) {
        // Update quantity
        booking.cart[existingItemIndex].quantity = finalQuantity;
        booking.cart[existingItemIndex].approved = false;
        // Remove item if quantity is 0 or negative
        if (booking.cart[existingItemIndex].quantity <= 0) {
          booking.cart.splice(existingItemIndex, 1);
        }
      } else if (finalQuantity > 0) {
        // Add new product to cart
        booking.cart.push({
          product: productId,
          quantity: finalQuantity,
          approved: false,
          addedByPartner: partnerId, // Store partner details
        });
      }

      // Save the updated booking with the modified cart
      booking = await booking.save();

      return res.status(200).json({
        success: true,
        message: "Cart updated successfully",
        cart: booking.cart,
      });
    } else {
      // General cart functionality (without booking)
      // Initialize partner cart if it doesn't exist
      if (!partner.cart) {
        partner.cart = [];
      }

      const finalQuantity = quantity || 1;

      // Check if product already exists in partner's cart
      const existingItemIndex = partner.cart.findIndex(
        (item) => item.product.toString() === productId
      );

      if (existingItemIndex !== -1) {
        // Update quantity
        partner.cart[existingItemIndex].quantity = finalQuantity;
        // Remove item if quantity is 0 or negative
        if (partner.cart[existingItemIndex].quantity <= 0) {
          partner.cart.splice(existingItemIndex, 1);
        }
      } else if (finalQuantity > 0) {
        // Add new product to cart
        partner.cart.push({
          product: productId,
          quantity: finalQuantity,
          addedAt: new Date(),
        });
      }

      // Save the updated partner with the modified cart
      await partner.save();

      // Populate product details for response
      await partner.populate('cart.product');

      return res.status(200).json({
        success: true,
        message: "Product added to cart successfully",
        cart: partner.cart,
      });
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    return res
      .status(500)
      .json({ message: "Error updating cart", error: error.message });
  }
};

exports.removeCart = async (req, res) => {
  try {
    let { bookid, cartId } = req.body;
    let booking = await Booking.findByIdAndUpdate(bookid, { $pull: { cart: { _id: cartId } } }, { new: true });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    // let cart=booking.cart.id(cartId);
    // cart.remove();

    return res.status(200).json({ message: "Cart item removed successfully", cart: booking.cart });
  } catch (error) {
    console.log(error);

  }
}

// Get Partner's Cart
exports.getCart = async (req, res) => {
  try {
    const partnerId = req.partner.id;
    
    const partner = await Partner.findById(partnerId)
      .populate({
        path: 'cart.product',
        select: 'name description price stock unit category'
      });
    
    if (!partner) {
      return res.status(404).json({ 
        success: false, 
        message: "Partner not found" 
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cart retrieved successfully",
      cart: partner.cart || [],
      cartCount: partner.cart ? partner.cart.length : 0
    });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({ 
      success: false,
      message: "Error retrieving cart", 
      error: error.message 
    });
  }
};

// Remove item from Partner's Cart
exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const partnerId = req.partner.id;

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ 
        success: false, 
        message: "Partner not found" 
      });
    }

    // Remove the product from cart
    partner.cart = partner.cart.filter(
      item => item.product.toString() !== productId
    );

    await partner.save();

    // Populate product details for response
    await partner.populate('cart.product');

    return res.status(200).json({
      success: true,
      message: "Product removed from cart successfully",
      cart: partner.cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    return res.status(500).json({ 
      success: false,
      message: "Error removing product from cart", 
      error: error.message 
    });
  }
};

// Clear Partner's Cart
exports.clearCart = async (req, res) => {
  try {
    const partnerId = req.partner.id;

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ 
        success: false, 
        message: "Partner not found" 
      });
    }

    partner.cart = [];
    await partner.save();

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
      cart: []
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({ 
      success: false,
      message: "Error clearing cart", 
      error: error.message 
    });
  }
};

// Place Order for Spare Parts
exports.placeOrder = async (req, res) => {
  try {
    const partnerId = req.partner.id;
    const { deliveryAddress, notes } = req.body;

    // Validate partner
    const partner = await Partner.findById(partnerId)
      .populate('cart.product');
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found"
      });
    }

    // Check if cart is not empty
    if (!partner.cart || partner.cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty. Add products before placing order."
      });
    }

    // Validate delivery address
    if (!deliveryAddress || !deliveryAddress.name || !deliveryAddress.phone || !deliveryAddress.addressLine1 || !deliveryAddress.pincode) {
      return res.status(400).json({
        success: false,
        message: "Complete delivery address is required (name, phone, address, pincode)"
      });
    }

    // Prepare order items from cart
    const orderItems = partner.cart.map(cartItem => {
      const product = cartItem.product;
      const quantity = cartItem.quantity;
      const price = product.price;
      const total = price * quantity;

      return {
        product: product._id,
        quantity,
        price,
        total
      };
    });

    // Calculate order totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    const tax = Math.round(subtotal * 0.18); // 18% GST
    const shippingCharges = subtotal > 1000 ? 0 : 50; // Free shipping above ₹1000
    const totalAmount = subtotal + tax + shippingCharges;

    // Create order
    const SparePartOrder = require('../models/SparePartOrder');
    const order = new SparePartOrder({
      partner: partnerId,
      items: orderItems,
      subtotal,
      tax,
      shippingCharges,
      totalAmount,
      delivery: {
        address: deliveryAddress
      },
      notes: {
        customer: notes || ''
      },
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        updatedBy: 'partner',
        remarks: 'Order placed by partner'
      }]
    });

    await order.save();

    // Clear partner's cart after successful order placement
    partner.cart = [];
    await partner.save();

    // Populate order with product details for response
    await order.populate('items.product', 'name description price unit');
    await order.populate('partner', 'profile.name profile.email phone');

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: {
        orderId: order.orderId,
        _id: order._id,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        shippingCharges: order.shippingCharges,
        totalAmount: order.totalAmount,
        status: order.status,
        payment: order.payment,
        delivery: order.delivery,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('Place order error:', error);
    return res.status(500).json({
      success: false,
      message: "Error placing order",
      error: error.message
    });
  }
};

// Initiate Payment for Spare Parts Order
exports.initiateOrderPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const partnerId = req.partner.id;

    // Find the order
    const SparePartOrder = require('../models/SparePartOrder');
    const order = await SparePartOrder.findOne({
      _id: orderId,
      partner: partnerId
    }).populate('partner', 'profile.name profile.email phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if order is in pending status
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Order is not in pending status"
      });
    }

    // Check if payment is already completed
    if (order.payment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Payment already completed for this order"
      });
    }

    // Generate unique transaction ID
    const txnid = `SPO${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // PayU Configuration
    const PAYU_CONFIG = {
      key: process.env.PAYU_MERCHANT_KEY || 'YOUR_MERCHANT_KEY',
      salt: process.env.PAYU_MERCHANT_SALT || 'YOUR_MERCHANT_SALT',
      baseUrl: process.env.PAYU_BASE_URL || 'https://test.payu.in',
    };

    // Generate PayU hash
    const generatePayUHash = (data) => {
      const { key, txnid, amount, productinfo, firstname, email, salt } = data;
      const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
      return require('crypto').createHash('sha512').update(hashString).digest('hex');
    };

    // Prepare payment data
    const paymentData = {
      key: PAYU_CONFIG.key,
      txnid,
      amount: order.totalAmount.toString(),
      productinfo: `Spare Parts Order - ${order.orderId}`,
      firstname: order.partner.profile?.name || 'Partner',
      email: order.partner.profile?.email || 'partner@nexo.com',
      phone: order.partner.phone,
      surl: `${process.env.BASE_URL || 'http://localhost:9088'}/api/partner/order-payment-success`,
      furl: `${process.env.BASE_URL || 'http://localhost:9088'}/api/partner/order-payment-failure`,
      salt: PAYU_CONFIG.salt,
    };

    // Generate hash
    const hash = generatePayUHash(paymentData);

    // Update order with transaction details
    order.payment.transactionId = txnid;
    order.payment.status = 'processing';
    await order.save();

    return res.json({
      success: true,
      message: "Payment initiated successfully",
      data: {
        ...paymentData,
        hash,
        action: `${PAYU_CONFIG.baseUrl}/_payment`,
        orderId: order._id,
        orderNumber: order.orderId
      }
    });

  } catch (error) {
    console.error('Initiate order payment error:', error);
    return res.status(500).json({
      success: false,
      message: "Error initiating payment",
      error: error.message
    });
  }
};

// Get Partner's Orders
exports.getOrders = async (req, res) => {
  try {
    const partnerId = req.partner.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { partner: partnerId };
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    const SparePartOrder = require('../models/SparePartOrder');
    
    // Get orders with pagination
    const orders = await SparePartOrder.find(query)
      .populate('items.product', 'name description price unit')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalOrders = await SparePartOrder.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    return res.json({
      success: true,
      message: "Orders retrieved successfully",
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving orders",
      error: error.message
    });
  }
};

// Get Order Details
exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const partnerId = req.partner.id;

    const SparePartOrder = require('../models/SparePartOrder');
    const order = await SparePartOrder.findOne({
      _id: orderId,
      partner: partnerId
    })
      .populate('items.product', 'name description price unit category')
      .populate('partner', 'profile.name profile.email phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    return res.json({
      success: true,
      message: "Order details retrieved successfully",
      data: order
    });

  } catch (error) {
    console.error('Get order details error:', error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving order details",
      error: error.message
    });
  }
};

// Handle Order Payment Success
exports.orderPaymentSuccess = async (req, res) => {
  try {
    const paymentData = req.body;
    const { txnid, mihpayid, status, amount } = paymentData;
    
    console.log('🌐 Order Payment Success Callback:');
    console.log('   Transaction ID:', txnid);
    console.log('   PayU Payment ID:', mihpayid);
    console.log('   Status:', status);
    console.log('   Amount:', amount);

    // Find order by transaction ID
    const SparePartOrder = require('../models/SparePartOrder');
    const order = await SparePartOrder.findOne({
      'payment.transactionId': txnid
    });

    if (!order) {
      console.error('❌ Order not found with transaction ID:', txnid);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/partner/dashboard/spare-parts?payment=failed&reason=order_not_found`);
    }

    // Update order payment status
    if (status === 'success') {
      order.payment.status = 'completed';
      order.payment.payuPaymentId = mihpayid;
      order.payment.paymentDate = new Date();
      order.status = 'confirmed';
      
      // Add to status history
      order.statusHistory.push({
        status: 'confirmed',
        timestamp: new Date(),
        updatedBy: 'system',
        remarks: 'Payment completed successfully'
      });
      
      console.log('✅ Order payment completed:', order.orderId);
    } else {
      order.payment.status = 'failed';
      console.log('❌ Order payment failed:', order.orderId);
    }

    await order.save();

    // Redirect based on status
    if (status === 'success') {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/partner/dashboard/spare-parts?payment=success&orderId=${order.orderId}&txnid=${txnid}`);
    } else {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/partner/dashboard/spare-parts?payment=failed&reason=payment_failed&orderId=${order.orderId}`);
    }

  } catch (error) {
    console.error('❌ Order payment callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/partner/dashboard/spare-parts?payment=failed&reason=server_error`);
  }
};

// Handle Order Payment Failure
exports.orderPaymentFailure = exports.orderPaymentSuccess;

exports.AddManulProductCart = async (req, res) => {
  try {
    const { bookingId, name, price, amount, description, quantity } = req.body;
    const partnerId = req.partner.id; // Assuming partner authentication is handled

    if (!bookingId || !name || !amount || !description) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const checkBooking = await Booking.findById(bookingId);
    if (!checkBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const carts = checkBooking.cart || [];
    if (name && price && amount && description) {

      const newCartItem = {
        name,
        price,
        amount,
        description,
        quantity: 1, // Default quantity for manual products
        approved: false, // Set approved to false by default
        addedByPartner: partnerId, // Store partner details
      };

      if (req.files && req.files.length > 0) {
        let arr = req.files;
        let i;
        for (i = 0; i < arr?.length; i++) {
          if (arr[i].fieldname == "image") {
            newCartItem.image = await uploadFile2(arr[i], "products");
          }
        }
      }
      if (quantity && quantity > 0) {
        newCartItem.quantity = Number(quantity); // Set quantity if provided
      }
      carts.push(newCartItem);
    }

    // Update the booking with the new cart item
    if (carts.length > 0) {
      checkBooking.cart = carts;
    }
    const updatedBooking = await checkBooking.save();
    return res.status(200).json({
      message: "Manual product added to cart successfully",
      cart: updatedBooking.cart,
    });
  } catch (error) {
    console.error("Error adding manual product to cart:", error);
    return res.status(500).json({ message: "Error adding product to cart", error: error.message });
  }
}

// Get all bookings (including team member bookings)
exports.allpartnerBookings = async (req, res) => {
  try {
    if (!req.partner || !req.partner.id) {
      return res.status(400).json({ message: "Invalid partner credentials" });
    }

    const partnerId = req.partner.id;
    const TeamMember = require("../models/TeamMember");

    // Get all team member IDs for this partner
    const teamMembers = await TeamMember.find({ partner: partnerId, status: "active" }).select("_id");
    const teamMemberIds = teamMembers.map(tm => tm._id);

    // Fetch bookings where partner = partnerId OR teamMember is in teamMemberIds
    const allBookings = await Booking.find({
      $or: [
        { partner: partnerId },
        { teamMember: { $in: teamMemberIds } }
      ]
    })
      .populate({ path: "service", select: "name description" })
      .populate({ path: "subService", select: "name description price" })
      .populate({ path: "category", select: "name" })
      .populate({ path: "user", select: "name email phone profilePicture" })
      .populate({ path: "teamMember", select: "name phone role" })
      .populate({ path: "partner", select: "profile.name phone" })
      .sort({ updatedAt: -1 })
      .lean();

    if (!allBookings || allBookings.length === 0) {
      return res.status(200).json({
        message: "No bookings found for this partner",
        bookings: {},
        counts: {
          completedOutOfTotal: "0 out of 0",
          pendingOutOfTotal: "0 out of 0",
        },
      });
    }

    // Define booking status categories
    const statuses = [
      "accepted",
      "completed",
      "in_progress",
      "rejected",
      "paused",
    ];
    const bookingsByStatus = Object.fromEntries(
      statuses.map((status) => [status, []])
    );

    // Categorize bookings by status
    allBookings.forEach((booking) => {
      const status = booking.status || "pending"; // Default to "pending" if missing

      if (statuses.includes(status)) {
        bookingsByStatus[status].push(booking);
      }
    });

    // Direct DB query to verify completed bookings (including team members)
    const completedBookingsCount = await Booking.countDocuments({
      $or: [
        { partner: partnerId, status: "completed" },
        { teamMember: { $in: teamMemberIds }, status: "completed" }
      ]
    });

    // Total bookings count
    const totalBookings = allBookings.length;
    const completedCount = bookingsByStatus.completed.length;
    const pendingCount = totalBookings - completedCount; // Everything except "completed" is pending

    return res.status(200).json({
      message: "Partner bookings retrieved successfully",
      bookings: bookingsByStatus,
      counts: {
        completedOutOfTotal: `${completedCount} out of ${totalBookings}`,
        pendingOutOfTotal: `${pendingCount} out of ${totalBookings}`,
      },
    });
  } catch (error) {
    console.error("Error fetching partner bookings:", error);
    return res
      .status(500)
      .json({ message: "Error fetching bookings", error: error.message });
  }
};

exports.getUserReviews = async (req, res) => {
  try {
    const partner = await Partner.findById(req.partner._id)
      .populate({
        path: "reviews.user",
        // select: "name _id", // Fetch only name and _id from User model
      })
      .populate({
        path: "reviews.booking",
        // select: "status _id", // Fetch only status and _id from Booking model
      });

    if (!partner) {
      return res
        .status(404)
        .json({ success: false, message: "Partner not found." });
    }

    res.json({ success: true, reviews: partner.reviews });
  } catch (error) {
    console.error("Error fetching partner reviews:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

// Review partner
exports.reviewUser = async (req, res) => {
  try {
    const { bookingId, userId, rating, comment, video } = req.body;
    const partnerId = req.partner._id;

    // Check if the booking exists and belongs to the partner
    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId,
      partner: partnerId,
      status: "completed",
    });

    if (!booking) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking or booking not completed.",
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Check if the user has already reviewed this partner
    const existingReview = user.reviews.find(
      (review) => review.partner?.toString() === partnerId?.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a review for this partner.",
      });
    }

    // Create review object
    const review = {
      user: userId,
      booking: bookingId,
      rating,
      comment,
      video: video || null, // Optional video field
      createdAt: new Date(),

    };
    if (video) {
      booking.review.comment = comment;
      booking.review.rating = rating;
      booking.review.video = video || null; // Optional video field
      booking.review.createdAt = new Date();
    }


    // Push review into the user's reviews array
    user.reviews.push(review);
    await user.save();
    await booking.save();

    res.status(201).json({
      success: true,
      message: "Review submitted successfully!",
      review,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

exports.reviewVideo = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const partnerId = req.partner._id;
    // Check if the booking exists and belongs to the partner
    const booking = await Booking.findOne({
      _id: bookingId,
    });
    if (!booking) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking or booking not completed.",
      });
    }
    // Add video to booking
    let reviewV = ""
    if (req.files && req.files.length > 0) {
      let arr = req.files;
      let i;
      for (i = 0; i < arr?.length; i++) {
        if (arr[i].fieldname == "video") {
          const video = await uploadFile2(arr[i], "job");
          booking.videos.push(video);
          booking.review.video = video; // Add video to review object
          reviewV = video;
          const wallet = await PartnerWallet.findOne({ partner: partnerId });
          if (wallet) {
            wallet.balance += (booking.reviewPrice || 50); // Add 10 to partner's wallet for video review
            wallet.transactions.push({
              transactionId: `WARE0${Date.now()}`,
              amount: booking.reviewPrice || 50,
              type: "credit",
              balance: wallet.balance,
              date: new Date(),
              description: `Video review added for booking`,
            });
            await wallet.save();
          }
        }
      }
    }



    await booking.save();
    return res.status(201).json({
      success: true,
      message: "Video added successfully!",
      videoUrl: reviewV,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

exports.topUpPartnerWallet = async (req, res) => {
  try {
    const { partnerId, amount, type } = req.body;

    // Validate input
    if (!partnerId || !amount || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find or create partner wallet
    let wallet = await PartnerWallet.findOne({ partnerId });
    if (!wallet) {
      wallet = new PartnerWallet({ partnerId, balance: 0, transactions: [] });
    }

    // Check for sufficient balance on debit
    if (type === "Debit" && wallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Create new transaction
    const newTransaction = {
      transactionId: uuidv4(),
      amount,
      type,
      date: new Date(),
    };

    // Update wallet balance and transactions
    wallet.transactions.push(newTransaction);
    wallet.balance += type === "Credit" ? amount : -amount;

    // Save wallet
    await wallet.save();

    res.status(201).json({ message: "Transaction successful", wallet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getwalletbypartner = async (req, res) => {
  try {
    let id = req.params.id;
    let wallet = await PartnerWallet.findOne({ partnerId: id });
    if (!wallet) {
      return res
        .status(200)
        .json({ success: { balance: 0, transactions: [] } });
    } else {
      return res.status(200).json({ success: wallet });
    }
  } catch (error) {
    console.log(error);
  }
};


exports.sendOtpWithNotification = async (req, res) => {
  try {
    const { bookid } = req.body;
    // Find the partner by phone number
    const booking = await Booking.findById(bookid).populate('user').populate('subService');
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const user = booking.user; // Assuming booking has a user field that references the User model
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
    if (!user.fcmToken) {
      await sendOTP(user.phone, otp);
      booking.otp = otp; // Save OTP to booking
      await booking.save();
      return res.status(200).json({ message: "OTP sent successfully" });
    }
    // Send OTP via SMS (assuming you have a function sendSms)

    const userNotification = {
      title: 'Service Otp Verification',
      message: `Your OTP is ${otp} for service ${booking?.subService?.name}. Please do not share it with anyone.`, // Fixed typo: namw -> name
      userId: user._id,
      type: 'new_notification',
      read: false,
      skipFcm: true, // Prevent post-save hook from sending FCM
    };

    // Create notification for the user
    try {
      if (user.fcmToken) {
        const userMessage = {
          notification: {
            title: userNotification.title, // ✅ Fixed: Use .title instead of entire object
            body: userNotification.message.length > 100
              ? userNotification.message.slice(0, 97) + '...'
              : userNotification.message,
          },
          data: {
            type: 'new-notification', // Align with FirebaseProvider
            userId: user._id.toString(),
            bookingId: booking._id.toString(),
            title: userNotification.title,
            message: userNotification.message.length > 100
              ? userNotification.message.slice(0, 97) + '...'
              : userNotification.message,
            timestamp: new Date().toISOString(),
          },
          token: user.fcmToken,
          android: {
            priority: 'high',
            ttl: 60 * 60 * 24,
          },
          apns: {
            payload: {
              aps: {
                contentAvailable: true,
              },
            },
            headers: {
              'apns-priority': '5',
            },
          },
        };

        // Validate payload size
        const userPayloadString = JSON.stringify(userMessage);
        const userPayloadSize = Buffer.byteLength(userPayloadString, 'utf8');
        if (userPayloadSize > 4096) {
          console.error(`User FCM payload too large: ${userPayloadSize} bytes`);
          userMessage.notification.body = userMessage.notification.body.slice(0, 50) + '...';
          userMessage.data.message = userMessage.data.message.slice(0, 50) + '...';
          const fallbackSize = Buffer.byteLength(JSON.stringify(userMessage), 'utf8');
          if (fallbackSize > 4096) {
            console.error(`User fallback payload still too large: ${fallbackSize} bytes`);
            throw new Error('User FCM payload exceeds size limit');
          }
        }

        console.log(`Sending FCM to user: ${user._id}`);
        await admin.messaging().send(userMessage);
        console.log(`FCM sent to user: ${user._id}`);
      } else {
        console.log(`No FCM token for user: ${user._id}`);
      }
    } catch (error) {
      sendOTP(user.phone, otp);
    }


    booking.otp = otp; // Save OTP to booking
    await booking.save();

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Error sending OTP", error: error.message });
  }
}



exports.verifyOtpbooking = async (req, res) => {
  try {
    const { bookid, otp } = req.body;

    // Find the booking by ID
    const booking = await Booking.findById(bookid);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }



    // Check if the OTP matches
    if ((booking.otp) !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Clear the OTP after successful verification
    // booking.otp = undefined;
    await booking.save();

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Error verifying OTP", error: error.message });
  }
}

exports.sendSmsOtp = async (req, res) => {
  try {
    const { bookid } = req.body;
    // Find the partner by phone number
    const booking = await Booking.findById(bookid).populate('user').populate('subService');
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const user = booking.user; // Assuming booking has a user field that references the User model
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP

    await sendOTP(user.phone, otp);
    booking.otp = otp; // Save OTP to booking
    await booking.save();
    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending SMS OTP:", error);
    res.status(500).json({ message: "Error sending SMS OTP", error: error.message });
  }
}
