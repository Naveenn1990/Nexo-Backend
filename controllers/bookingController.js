const Booking = require("../models/booking");

const User = require("../models/User");
const Review = require("../models/Review");
// const mongoose = require("mongoose");
const SubService = require("../models/SubService");
const Admin = require("../models/admin");
const PartnerModel = require("../models/PartnerModel");
const Notification = require("../models/Notification");
const PartnerWallet = require("../models/PartnerWallet");
const admin = require("firebase-admin");
const Offer = require('../models/offer');
const Wallet = require("../models/Wallet");

const createNotification = async (serviceId, name, job) => {
  try {
    // Find partners with the given serviceId
    const partners = await PartnerModel.find({ service: serviceId, 'kyc.status': "approved" }).populate('service');
    console.log(`Found ${partners.length} partners for service: ${name}`);

    // Process each partner concurrently
    await Promise.all(
      partners.map(async (partner) => {
        try {
          const userIdString = partner._id.toString();
          const checkWallet = await PartnerWallet.findOne({ partner: partner._id });
          if (checkWallet?.balance > 499) {
            // Prepare minimal job data for FCM, including all fields needed by JobNotificationScreen
            const minimalJob = {
              _id: job._id?.toString() || '',
              serviceId: job.serviceId?.toString() || '',
              subService: {
                name: job.subService?.name || name || 'Unknown Service',
                description:
                  (job.subService?.description || '').slice(0, 100) || 'No description', // Truncate to save space
              },
              amount: job.amount?.toString() || '0',
              scheduledDate: job.scheduledDate
                ? new Date(job.scheduledDate).toISOString().split('T')[0]
                : '',
              scheduledTime: job.scheduledTime || '',
              location: {
                address: job.location?.address || 'Location not specified',
              },
              paymentStatus: job.paymentStatus || 'pending',
              user: {
                name: job.user?.name || 'Customer',
                phone: job.user?.phone || 'N/A',
              },
            };

            // Save notification to Firestore/MongoDB

            // console.log(`Notification saved for partner: ${userIdString}`);
            const notification = new Notification({
              title: 'New Booking Alert',
              userId: partner._id,
              message: `You have new service booking for ${name || job.subService?.name || 'service'}`,
              createdAt: new Date(),
              read: false,
            });
            await notification.save();
            // Send FCM notification if fcmtoken exists
            if (partner.fcmtoken) {
              const userMessage = {
                data: {
                  type: 'new-job',
                  job: JSON.stringify(minimalJob),
                  userId: userIdString,
                  title: 'New Job Alert',
                  body: `You have new service booking for ${name || job.subService?.name || 'service'}`,
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
              }

              // Validate payload size (4KB = 4096 bytes)
              const payloadString = JSON.stringify(userMessage);
              const payloadSize = Buffer.byteLength(payloadString, 'utf8');
              if (payloadSize > 4096) {
                console.error(
                  `Payload too large for partner ${userIdString}: ${payloadSize} bytes`,
                );
                // Fallback to minimal payload
                userMessage.data.job = JSON.stringify({
                  id: minimalJob.id,
                  serviceId: minimalJob.serviceId,
                  subService: { name: minimalJob.subService.name },
                });
                const fallbackSize = Buffer.byteLength(
                  JSON.stringify(userMessage),
                  'utf8',
                );
                if (fallbackSize > 4096) {
                  console.error(
                    `Fallback payload still too large for partner ${userIdString}: ${fallbackSize} bytes`,
                  );
                  return;
                }
              }

              console.log(`Sending FCM to partner: ${userIdString}`);
              await admin.messaging().send(userMessage);
              console.log(`FCM sent to partner: ${userIdString}`);
            } else {
              console.log(
                `No FCM token for partner: ${userIdString}, notification saved to DB`,
              );

            }

          } else {
            console.log(`Partner ${partner._id} does not have sufficient balance.`);
            const notification = new Notification({
              title: 'Insufficient Balance Alert',
              userId: partner._id,
              message: `Your wallet balance is insufficient to accept a new booking for ${name || job.subService?.name || 'the service'}. Please recharge your wallet. A minimum balance of ₹500 is required to proceed.`,
              createdAt: new Date(),
              read: false,
            });
            await notification.save();
          }

        } catch (error) {
          console.error(`Error processing partner ${partner._id}:`, error.message);
        }
      }),
    );

    console.log(`Notifications processed for service: ${name}`);
  } catch (error) {
    console.error('Error in createNotification:', error);
  }
};

const sendBookingNotifications = async (booking, userId, subService) => {
  try {
    const user = await User.findById(userId);
    const admins = await Admin.find({});

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const offer = await Offer.findById(booking.couponId);
    if (offer) {
      offer.applyOffer.push({ userId: user?._id });
      await offer.save();
    }

    // User notification
    const userNotification = {
      title: 'Booking Confirmed',
      message: `Your booking for ${subService.name} has been confirmed!`,
      userId: user._id,
      type: 'booking_confirmation',
      read: false,
      skipFcm: true, // Prevent post-save hook from sending FCM
    };

    // Save user notification to Notification collection
    // user.notifications.push({
    //   message: `Your booking for ${subService.name} has been confirmed!`,
    //   booking:booking._id,
    //   seen:false,
    //   date: Date.now()
    // });
    // await user.save();
    console.log(`User notification saved for user: ${user._id}`);

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
    const adminNotificationMessage = `New booking from ${user.name} for ${subService.name}`;
    const adminNotification = {
      title: 'New Booking',
      message: adminNotificationMessage,
      type: 'new_booking',
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
                userName: user.name,
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
    console.error('Booking notification error:', error);
    return { success: false, error: error.message };
  }
};

const sendCancellationNotifications = async (
  booking,
  user,
  subService,
  admins,
  cancellationReason,
) => {
  try {
    // User notification
    if (booking.partner) {
      const notification = new Notification({
        title: 'Cancelled Booking Alert',
        userId: booking.partner,
        message: `You job service is ${subService.name} cancelled .`,
        createdAt: new Date(),
        read: false,
      });
      await notification.save();
    }

    const userNotification = {
      title: 'Booking Cancelled',
      message: `Your booking for ${subService.name} has been cancelled. Reason: ${cancellationReason}`,
      userId: user._id,
      type: 'booking_cancellation',
      read: false,
      skipFcm: true, // Prevent post-save hook from sending FCM
    };

    // Save user notification
    const userDoc = new Notification(userNotification);
    await userDoc.save();
    console.log(`User notification saved for user: ${user._id}`);

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
          cancellationReason:
            cancellationReason.length > 50
              ? cancellationReason.slice(0, 47) + '...'
              : cancellationReason,
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
        userMessage.data.cancellationReason = userMessage.data.cancellationReason.slice(0, 20) + '...';
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
    const adminNotificationMessage = `Booking cancelled by ${user.name} for ${subService.name}. Reason: ${cancellationReason}`;
    const adminNotification = {
      title: 'Booking Cancelled',
      message: adminNotificationMessage,
      type: 'booking_cancellation',
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
                type: 'new-notification',
                userId: admin._id.toString(),
                bookingId: booking._id.toString(),
                title: adminNotification.title,
                message: adminNotification.message.length > 100
                  ? adminNotification.message.slice(0, 97) + '...'
                  : adminNotification.message,
                cancellationReason:
                  cancellationReason.length > 50
                    ? cancellationReason.slice(0, 47) + '...'
                    : cancellationReason,
                timestamp: new Date().toISOString(),
                userName: user.name,
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
              adminMessage.data.cancellationReason = adminMessage.data.cancellationReason.slice(0, 20) + '...';
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
    console.error('Cancellation notification error:', error);
    return { success: false, error: error.message };
  }
};




exports.createBooking = async (req, res) => {
  try {
    const {
      subServiceId,
      userId,
      paymentMode,
      amount,
      location,
      scheduledTime,
      scheduledDate,
      currentBooking,
      lat,
      lng,
      payamount,
      discount,
      couponId,
      usewallet
    } = req.body;

    // Validate required fields
    if (!subServiceId || !userId) {
      return res.status(400).json({
        success: false,
        message: "subServiceId and userId are required",
      });
    }

    const subService = await SubService.findById(subServiceId);
    if (!subService) {
      return res.status(404).json({
        success: false,
        message: "SubService not found",
      });
    }

    if (!subService.isActive) {
      return res.status(400).json({
        success: false,
        message: "SubService is currently inactive",
      });
    }

    // Create new booking
    const booking = new Booking({
      user: userId,
      subService: subServiceId,
      scheduledDate,
      scheduledTime,
      lat,
      lng,
      currentBooking,
      discount,
      payamount,
      location: {
        address: location?.address || "",
        landmark: location?.landmark || "",
        pincode: location?.pincode || "",
      },
      amount: amount || subService.price,
      status: "pending",
      paymentMode,
      couponId,
      usewallet,
    });

    await booking.save();

    if (usewallet) {
      const wallet = await Wallet.findOne({ userId: userId });
      if (wallet) {
        wallet.balance = wallet.balance - Number(usewallet);
        wallet.transactions.push({
          type: "Debit",
          amount: Number(usewallet),
          description: `Booking for ${subService.name} on ${scheduledDate} at ${scheduledTime} using wallet`,
          transactionId: booking._id
        })
        await wallet.save();
      }
    }
    // Populate booking details
    const populatedBooking = await Booking.findById(booking._id)
      .populate("subService")
      .populate("user");
    if (populatedBooking) {
      createNotification(
        populatedBooking.subService.service,
        subService.name,
        populatedBooking
      );
    }
    // Get user and admin details


    // Send notifications (non-blocking)
    sendBookingNotifications(populatedBooking, userId, subService)


    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking: populatedBooking,
    });
  } catch (error) {
    console.error("Error in createBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all bookings without pagination

exports.getAllBookings = async (req, res) => {
  try {
    // Get all bookings with populated service and category details
    const bookings = await Booking.find({ user: req.user._id })
      .populate("subService", "name description basePrice duration")
      .populate("subService", "name description price")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Error in getAllBookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};

// Get all bookings (with filters and pagination)
exports.getAllBookingsWithFilters = async (req, res) => {
  try {
    const {
      status,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
      sortBy = "scheduledDate",
      sortOrder = "desc",
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Add date range filter
    if (fromDate || toDate) {
      query.scheduledDate = {};
      if (fromDate) {
        query.scheduledDate.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.scheduledDate.$lte = new Date(toDate);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get bookings with pagination
    const bookings = await Booking.find(query)
      .populate({
        path: "service",
        populate: {
          path: "category",
          select: "name",
        },
      })
      .populate("user", "name email phone")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error in getAllBookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching all bookings",
      error: error.message,
    });
  }
};

// Get user's bookings
exports.getUserBookings = async (req, res) => {
  try {
    const { status } = req.query;
    console.log("Yessss");
    // Build query for user bookings
    const query = { user: req.user._id };
    if (status) {
      query.status = status;
    }

    // Fetch all bookings with full population
    const bookings = await Booking.find(query)
      .populate({
        path: "user", // Populate user details
        // select: 'name email phone profilePicture addresses' // Select specific fields
      })
      .populate({
        path: "subService",
        populate: {
          path: "service", // SubService -> Service
          populate: {
            path: "subCategory", // Service -> SubCategory
            populate: {
              path: "category", // SubCategory -> ServiceCategory
              select: "name",
            },
          },
        },
      })
      .populate({
        path: "partner", // Populate partner details
      })
      .populate({
        path: "cart.product", // Populate product details inside cart
      })
      .populate({
        path: "cart.addedByPartner", // Populate partner who added the product
        select: "profile.name profile.email", // Select specific fields
      })
      .sort({ createdAt: -1 })
      .lean(); // Convert to plain JS objects for better performance

    res.status(200).json({
      success: true,
      data: { bookings },
    });
  } catch (error) {
    console.error("Error in getUserBookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user bookings",
      error: error.message,
    });
  }
};

// Get booking details
exports.getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user._id,
    }).populate({
      path: "subService",
      populate: {
        path: "category",
        select: "name",
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Error in getBookingDetails:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching booking details",
      error: error.message,
    });
  }
};

// Update booking
exports.updateBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { scheduledDate, scheduledTime, location } = req.body;

    const booking = await Booking.findOne({
      _id: bookingId,
      // user: req.user._id,
    });
    // console.log("Booking found in DB:", booking);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (!["pending", "accepted"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot update booking that is in progress, completed, or cancelled",
      });
    }

    // Validate scheduled date is in the future
    if (scheduledDate) {
      const newBookingDate = new Date(scheduledDate);
      if (newBookingDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Scheduled date must be in the future",
        });
      }
      booking.scheduledDate = newBookingDate;
    }

    // Update fields if provided
    if (scheduledTime) booking.scheduledTime = scheduledTime;
    if (location) {
      if (!location.address || !location.pincode) {
        return res.status(400).json({
          success: false,
          message: "Address and pincode are required in location",
        });
      }
      booking.location = location;
    }

    await booking.save();

    // Correct population according to the hierarchy
    await booking.populate({
      path: "subService",
      populate: {
        path: "service",
        populate: {
          path: "subCategory",
          populate: {
            path: "category",
            select: "name",
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error in updateBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error updating booking",
      error: error.message,
    });
  }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    console.log("Cancel Booking - Request Params:", req.params);
    // console.log("Cancel Booking - Request Body:", req.body);

    const { bookingId } = req.params;
    const { cancellationReason, userId } = req.body;

    // Validate if userId and bookingId are provided
    if (!bookingId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and User ID are required",
      });
    }

    // Find the booking by ID and user
    const booking = await Booking.findOne({ _id: bookingId, user: userId })
      .populate("subService")
      .populate("user");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or does not belong to the user",
      });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
      });
    }

    if (["completed", "in_progress"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a completed or in-progress booking",
      });
    }

    // Update booking status
    booking.status = "cancelled";
    booking.cancellationReason = cancellationReason || "No reason provided";
    booking.cancellationTime = new Date();
    await booking.save();

    // Get admin details for notifications
    const admins = await Admin.find({});

    // Send cancellation notifications (non-blocking)
    sendCancellationNotifications(
      booking,
      booking.user,
      booking.subService,
      admins,
      booking.cancellationReason
    ).then((success) => {
      if (!success) {
        console.log("Cancellation notifications partially failed");
      }
    });

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Error in cancelBooking:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling booking",
      error: error.message,
    });
  }
};

// Add review
exports.addReview = async (req, res) => {
  try {
    const { rating, comment, type } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating is required and must be between 1 and 5",
      });
    }

    // Create a new review instance
    const review = new Review({
      user: req.user._id,
      booking: req.params.bookingId, // Include the booking ID from the URL
      rating,
      comment,
      type: type || "booking",
    });

    await review.save();

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error in addReview:", error);
    res.status(500).json({
      success: false,
      message: "Error adding review",
      error: error.message,
    });
  }
};

// Get all bookings for a user
exports.getAllUserBookings = async (req, res) => {
  try {
    // console.log("Request Parameters:", req.params);
    // console.log("User ID:", req.user._id);
    const bookings = await Booking.find({ user: req.user._id })
      .populate({
        path: "subService",
        populate: {
          path: "category",
          select: "name",
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching all user bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};

// Get a specific booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.bookingId,
    })
      .populate("service", "name description basePrice duration")
      .populate("category", "name description");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Error in getBookingById:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching booking",
      error: error.message,
    });
  }
};

// Get bookings by status
exports.getBookingsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Validate status
    const validStatuses = [
      "pending",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(", "),
      });
    }

    const query = {
      user: req.user._id,
      status: status,
    };

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    // Get bookings
    const bookings = await Booking.find(query)
      .populate("service", "name description basePrice duration")
      .populate("category", "name description")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
        },
      },
    });
  } catch (error) {
    console.error("Error in getBookingsByStatus:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};

// Removed getCategories function as it has been moved to userServiceController.js

// Get all reviews
exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("user") // Fetch all user details
      .populate("subService"); // Fetch all subService details
    // console.log(reviews);
    const ApprovedReviews = reviews.filter(
      (review) => review.status === "approved"
    );
    res.status(200).json(ApprovedReviews);
  } catch (error) {
    res.status(500).json({ message: "Error fetching reviews", error });
  }
};
