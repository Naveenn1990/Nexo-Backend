const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/database");
const path = require("path");
const multer = require("multer");
const morgan = require("morgan");
const fs = require("fs");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
require("dotenv").config();
const bodyParser = require("body-parser");
const socketIo = require("socket.io");
const http = require("http");
const axios = require("axios");
const Booking = require("./models/booking");
// const Notification = require("./models/Notification");


const app = express();

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));


// Middleware
app.use(morgan("dev"));

app.use(
  cors()
);



const upload = multer()
app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    let chat = await Booking.findById(req.body.bookingId);
    if (!chat) {
      return res.status(404).json({ error: "Booking not found." });
    }

    let imageUrl = ""
    if (req.file) {
      imageUrl = await uploadFile2(req.file, "chat");
    }

    const imageMessage = {
      event: "chat image",
      data: {
        bookingId: req.body.bookingId,
        senderId: req.body.senderId,
        image: imageUrl,
      },
    };

    chat.chat.push(imageMessage);
    await chat.save();

    // Emit the event
    io.emit("receive message", { bookingId: chat._id, messages: chat.chat });

    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Error saving chat image:", error);
    res.status(500).json({ error: "Server error occurred." });
  }
});

const userSockets = {};

const adminSockets = {};

const User = require('./models/User');
const Partner = require("./models/PartnerModel");
// Notification.injectIO(io);
const calls = new Map();
const rides = new Map(); // Format: { rideId: { driverId, userId, status } }

const initiateCall = async (req, res) => {
  try {
    // console.log("req.body", req.body)
    const { callerId, receiverId, callId, isUser, offer, user } = req.body;

    // Validate caller and receiver
    const partner = isUser
      ? await User.findById(receiverId)
      : await Partner.findById(receiverId);
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }
const fcmToken = isUser ? partner.fcmToken : partner.fcmtoken;
    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'User currently offline...' });
    }
    // Store call state
    calls.set(callId, { callerId, receiverId, status: 'pending', offer });

const message = {
      token: fcmToken,
      notification: {
        title: 'Incoming Call',
        body: `Call from ${user.name}`,
      },
      data: {
        callId: callId.toString(),
        callerId: callerId.toString(),
        receiverId: receiverId.toString(),
        type: 'call',
        user: JSON.stringify(user),
        offer: JSON.stringify(offer),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'call-channel', // Ensure this channel exists in Android app
          sound: 'ringtone',
          priority: 'high',
        },
      },
      apns: {
        headers: {
          'apns-priority': '10', // High priority for iOS
        },
        payload: {
          aps: {
            alert: {
              title: 'Incoming Call',
              body: `Call from ${user.name}`,
            },
            sound: 'default', // Use default sound to avoid file issues
            contentAvailable: true, // For background notifications
            mutableContent: true, // For notification service extensions (if used)
            badge: 1, // Optional: Set badge count
          },
        },
      },
    };
    await admin.messaging().send(message);
    console.log('Notification sent to receiver:', receiverId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Register the only API
app.post('/api/initiate-call', initiateCall);

io.on("connection", (socket) => {
  console.log("User/Admin connected:", socket.id);
 
  // Handle text and image messages
  socket.on("chat message", async (message) => {
    console.log("Message received:", message);
    try {
      let chat = await Booking.findById(message?.data?.bookingId);
      if (!chat) {
        return socket.emit("error", "Booking not found.");
      }
      message.data.timestamp = new Date().toISOString()

      chat.chat.push(message);
      await chat.save();

      // Emit event to the sender
      socket.emit("message received", {
        bookingId: chat._id,
        message: message.data,
      });

      // Broadcast to all clients
      io.emit("receive message", {
        bookingId: chat._id,
        messages: chat.chat,
      });
    } catch (error) {
      console.error("Error saving chat message:", error);
      socket.emit("error", "Server error occurred.");
    }
  });

  // Handle image upload
  socket.on("chat image", async (data, callback) => {
    console.log("data :", data);
    try {
      upload.single("image")(data.req, data.res, async (err) => {
        if (err) {
          return callback({ error: err.message });
        }

        let chat = await Booking.findById(data.bookingId);
        if (!chat) {
          return callback({ error: "Booking not found." });
        }

        let imageUrl = ""
        if (req.file) {
          imageUrl = await uploadFile2(req.file, "chat");
        }
        const imageMessage = {
          event: "chat image",
          data: {
            bookingId: data.bookingId,
            senderId: data.senderId,
            image: imageUrl,
            timestamp: new Date().toISOString(),
          },
        };

        console.log("imageMessage :", imageMessage);

        chat.chat.push(imageMessage);
        await chat.save();

        // Send image message to sender and other clients
        socket.emit("message received", imageMessage);
        io.emit("receive message", {
          bookingId: chat._id,
          messages: chat.chat,
        });
        callback({ success: true, imageUrl });
      });
    } catch (error) {
      console.error("Error saving chat image:", error);
      callback({ error: "Server error occurred." });
    }
  });

  // Handle retrieving messages
  socket.on("receive message", async (data) => {
    // console.log("Fetching messages for booking ID:", data.data?.bookingId);
    try {
      let chat = await Booking.findById(data.data?.bookingId);
      if (!chat) {
        return socket.emit("error", "No chat found for this booking ID.");
      }
      socket.emit("receive message", {
        bookingId: chat._id,
        messages: chat.chat,
      });
    } catch (error) {
      console.error("Error retrieving chat messages:", error);
      socket.emit("error", "Error retrieving chat messages.");
    }
  });

  socket.on('register', ({ userId, isUser }) => {
    try {
      if (!userId) {
        throw new Error('Invalid userId');
      }
      socket.userId = userId;
      socket.isUser = isUser;
      socket.join(userId);
      console.log(`User ${userId} registered with socket ${socket.id}, rooms:`, socket.rooms);
      socket.emit('registration');
    } catch (error) {
      console.error(`Error registering user ${userId}:`, error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('call_answer', async ({ callId, senderId, receiverId, answer }) => {
    try {
      const call = calls.get(callId);
      if (!call || call.status !== 'pending') {
        console.warn(`Call answer ignored for callId ${callId}: Invalid or non-pending call`);
        return;
      }

      call.status = 'active';
      calls.set(callId, call);

      // Verify receiver is in the room
      const receiverSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.userId === receiverId && s.rooms.has(receiverId)
      );
      if (!receiverSocket) {
        throw new Error('Receiver not connected');
      }

      io.to(receiverId).emit('call_answer', {
        callId,
        senderId,
        receiverId,
        answer,
      });
      console.log(`Answer sent to caller ${receiverId} for call ${callId}`);
    } catch (error) {
      console.error(`Error sending answer for call ${callId}:`, error.message);
      io.to(senderId).to(receiverId).emit('error', { message: error.message });
    }
  });

  socket.on('ice_candidate', async ({ callId, senderId, receiverId, candidate }) => {
    try {
      const call = calls.get(callId);
      if (!call) {
        console.warn(`ICE candidate ignored for callId ${callId}: Call not found`);
        return;
      }

      const receiverSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.userId === receiverId && s.rooms.has(receiverId)
      );
      if (!receiverSocket) {
        throw new Error('Receiver not connected');
      }

      io.to(receiverId).emit('ice_candidate', {
        callId,
        senderId,
        receiverId,
        candidate,
      });
      console.log(`ICE candidate sent to ${receiverId} for call ${callId}`);
    } catch (error) {
      console.error(`Error sending ICE candidate for call ${callId}:`, error.message);
      io.to(senderId).to(receiverId).emit('error', { message: error.message });
    }
  });

  socket.on('call_ended', async ({ callId, senderId, receiverId }) => {
    try {
      const call = calls.get(callId);
      if (!call) {
        console.warn(`Call end ignored for callId ${callId}: Call not found`);
        return;
      }

      call.status = 'ended';
      calls.set(callId, call);

      io.to(receiverId).emit('call_ended', {
        callId,
        senderId,
        receiverId,
      });
      console.log(`Call ended notification sent to ${receiverId} for call ${callId}`);

      calls.delete(callId);
      console.log(`Call ${callId} removed from calls Map`);
    } catch (error) {
      console.error(`Error ending call ${callId}:`, error.message);
      io.to(senderId).to(receiverId).emit('error', { message: error.message });
    }
  });

  socket.on('call_rejected', async ({ callId, senderId, receiverId }) => {
    try {
      const call = calls.get(callId);
      if (!call) {
        console.warn(`Call rejection ignored for callId ${callId}: Call not found`);
        return;
      }

      call.status = 'rejected';
      calls.set(callId, call);

      io.to(receiverId).emit('call_rejected', {
        callId,
        senderId,
        receiverId,
      });
      console.log(`Call rejection notification sent to ${receiverId} for call ${callId}`);

      calls.delete(callId);
      console.log(`Call ${callId} removed from calls Map`);
    } catch (error) {
      console.error(`Error rejecting call ${callId}:`, error.message);
      io.to(senderId).to(receiverId).emit('error', { message: error.message });
    }
  });

  socket.on('cleanup', ({ callId, userId }) => {
    try {
      if (calls.has(callId)) {
        const call = calls.get(callId);
        io.to(call.callerId).to(call.receiverId).emit('call_ended', {
          callId,
          senderId: userId,
          receiverId: call.callerId === userId ? call.receiverId : call.callerId,
        });
        calls.delete(callId);
        console.log(`Cleaned up call ${callId} for user ${userId}`);
      } else {
        console.log(`Cleanup ignored for call ${callId}: Call not found`);
      }
    } catch (error) {
      console.error(`Error cleaning up call ${callId}:`, error.message);
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('start_ride', async ({ rideId, driverId, userId }) => {
    try {
      if (!rideId || !driverId || !userId) {
        throw new Error('Invalid ride details');
      }
      socket.join(driverId);
      // Store ride details
      rides.set(rideId, {
        driverId,
        userId,
        status: 'active',
      });

      // Notify user that ride has started
      io.to(userId).emit('ride_started', {
        rideId,
        driverId,
        message: 'Ride has started. Driver location tracking enabled.',
      });

      await Booking.findByIdAndUpdate(rideId, { rideStart: true });
      console.log(`Ride ${rideId} started. Driver: ${driverId}, User: ${userId}`);
    } catch (error) {
      console.error(`Error starting ride ${rideId}:`, error.message);
      socket.emit('error', { message: error.message });
    }
  });

  // New: Driver sends location updates
  socket.on('driver_location', async ({ rideId, latitude, longitude }) => {
    try {
      const ride = rides.get(rideId);
      if (!ride || ride.status !== 'active') {
        console.warn(`Location update ignored for rideId ${rideId}: Invalid or non-active ride`);
        return;
      }

      // Verify driver is the one sending the update
      if (ride.userId === ride.driverId) {
        throw new Error('Unauthorized location update ' + ride.userId +
          " " + ride.driverId
        );
      }

      // Send location to user
      io.to(ride.userId).emit('driver_location_update', {
        rideId,
        driverId: ride.driverId,
        latitude,
        longitude,
        timestamp: Date.now(),
      });
      await Partner.findByIdAndUpdate(ride.driverId, { latitude, longitude });
      console.log(`Driver location sent for ride ${rideId}: (${latitude}, ${longitude}) to user ${ride.userId}`);
    } catch (error) {
      console.error(`Error sending driver location for ride ${rideId}:`, error.message, latitude,
        longitude);
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('ride_check', async ({ rideId }) => {
    try {
      const ride = rides.get(rideId);
      if (!ride) {
        console.warn(`Ride check ignored for rideId ${rideId}: Ride not found`);
        return;
      }
      console.log(`Ride ${rideId} is active`);
      io.to(ride.driverId).emit('ride_check', {
        rideId,
        message: 'Ride is active',
      });
      let driver = await Partner.findById(ride.driverId);
      io.to(ride.userId).emit(' ', {
        rideId,
        message: 'Ride is active',
        driverLocation: {
          latitude: driver.latitude,
          longitude: driver.longitude,
        },
      });
      console.log(`Ride ${rideId} is active`);
    } catch (error) {
      console.error(`Error checking ride ${rideId}:`, error.message);
      socket.emit('error', { message: error.message });
    }
  })

  socket.on('route_created', (data) => {
    console.log('Route created:', data);
    try {
      const { rideId, userId, initialEta, destination } = data;
      const ride = rides.get(rideId);
      // Store route info in database
      // ...

      // Forward to user

      if (ride && ride.userId) {
        io.to(ride.userId).emit('route_info', {
          rideId,
          eta: initialEta,
          destination,
          status: 'active'
        });
      }
    } catch (error) {
      console.error(`Error creating route ${rideId}:`, error.message);
      socket.emit('error', { message: error.message });
    }

  });

  socket.on('eta_update', (data) => {
    const { rideId, userId, etaInfo } = data;
    const ride = rides.get(rideId);
    // Update ETA in database
    // ...

    // Forward ETA to user

    if (userId) {
      io.to(userId).emit('eta_update', {
        rideId,
        eta: etaInfo,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('route_changed', (data) => {
    const { rideId, userId } = data;
    const ride = rides.get(rideId);
    // Record route change in database
    // ...

    // Notify user about route change
    const userSocketId = ride[userId];
    if (userSocketId) {
      io.to(userSocketId).emit('route_changed', {
        rideId,
        message: 'Driver has taken a different route',
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('driver_arrived', (data) => {
    const { rideId, userId, isFinalDestination } = data;
    // Update ride status in database
    // ...
    // Notify user
    const ride = rides.get(rideId);
    const userSocketId = ride[userId];
    if (userSocketId) {
      io.to(userSocketId).emit('driver_arrived', {
        rideId,
        isFinalDestination,
        message: isFinalDestination ?
          'You have arrived at your destination' :
          'Approaching waypoint',
        timestamp: new Date().toISOString()
      });
    }
  });
 
  socket.on('end_ride', async ({ rideId }) => {
    try {
      const ride = rides.get(rideId);
      if (!ride) {
        console.warn(`End ride ignored for rideId ${rideId}: Ride not found`);
        return;
      }

      // Update ride status
      ride.status = 'ended';
      rides.set(rideId, ride);

      // Notify user that ride has ended
      io.to(ride.userId).emit('ride_ended', {
        rideId,
        message: 'Ride has ended.',
      });
      await Booking.findByIdAndUpdate(rideId, { rideStart: false });
      // Optionally, remove ride from map after some time
      setTimeout(() => {
        rides.delete(rideId);
        console.log(`Ride ${rideId} removed from active rides`);
      }, 60000); // Remove after 1 minute

      console.log(`Ride ${rideId} ended. Notified user ${ride.userId}`);
    } catch (error) {
      console.error(`Error ending ride ${rideId}:`, error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('route_polyline', (data) => {
    const { rideId, userId, polyline, polylineCoordinates } = data;

    // console.log(`Received route polyline data for ride ${rideId} from user ${userId} polyline: ${polyline} polylineCoordinates: ${polylineCoordinates}`);

    // Store polyline in database (optional)
    // This can be useful for ride history or analytics
    // storeRoutePolyline(rideId, polyline || polylineCoordinates)
    //   .catch(err => console.error('Error storing polyline:', err));
    try {
      const ride = rides.get(rideId);
      const userSocketId = ride.userId;
      if (userSocketId) {
        io.to(userSocketId).emit('route_polyline_update', {
          rideId,
          // If we received an encoded polyline, send it as is
          polyline: polyline,
          // If we received coordinates array, send it as is
          polylineCoordinates: polylineCoordinates,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`Error storing polyline for ride ${rideId}:`, error.message);
      socket.emit('error', { message: error.message });
    }
    // Forward to user

  });


  socket.on("join", (userId) => {
    console.log(`Received join event from user ${userId}`);
    socket.join(userId);

    if (!userSockets[userId]) {
      userSockets[userId] = [];
    }
    userSockets[userId].push(socket.id);
    console.log(`User ${userId} joined with socket ${socket.id}`);
  });

  socket.on("join admin", (adminId) => {
    console.log(`Received join event from admin ${adminId}`);
    socket.join(adminId); // Join the admin-specific room

    if (!adminSockets[adminId]) {
      adminSockets[adminId] = [];
    }
    adminSockets[adminId].push(socket.id);

    console.log(`Admin ${adminId} joined with socket ${socket.id}`);
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log(`User ${socket.userId} disconnected`);
      // Optionally notify active calls
      for (const [callId, call] of calls) {
        if (call.callerId === socket.userId || call.receiverId === socket.userId) {
          io.to(call.callerId).to(call.receiverId).emit('call_ended', {
            callId,
            senderId: socket.userId,
            receiverId: call.callerId === socket.userId ? call.receiverId : call.callerId,
          });
          calls.delete(callId);
        }
      }
      rides.forEach((ride, rideId) => {
        if (ride.driverId === socket.userId && ride.status === 'active') {
          ride.status = 'disconnected';
          rides.set(rideId, ride);
          io.to(ride.userId).emit('ride_disconnected', {
            rideId,
            message: 'Driver disconnected. Ride paused.',
          });
          console.log(`Ride ${rideId} paused due to driver ${socket.userId} disconnection`);
        }
      });
      for (const userId in userSockets) {
        userSockets[userId] = userSockets[userId].filter(
          (id) => id !== socket.id
        );
        if (userSockets[userId].length === 0) {
          delete userSockets[userId];
        }
      }

      // Cleanup adminSockets
      for (const adminId in adminSockets) {
        adminSockets[adminId] = adminSockets[adminId].filter(
          (id) => id !== socket.id
        );
        if (adminSockets[adminId].length === 0) {
          delete adminSockets[adminId];
        }
      }
    }
  });
});
 
global.io = io; // Make socket available globally

connectDB()
  .then(() => {
    console.log("Database connected successfully");
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });

// Swagger Documentation
// app.use(
//   "/api-docs",
//   swaggerUi.serve,
//   swaggerUi.setup(swaggerSpec, {
//     customCss: ".swagger-ui .topbar { display: none }",
//     customSiteTitle: "Wave API Documentation",
//   })
// );

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure helmet with necessary adjustments
// app.use(
//   helmet({
//     crossOriginResourcePolicy: { policy: "cross-origin" },
//   })
// );

// Create uploads directories if they don't exist
// const dirs = [
//   path.join(__dirname, "uploads"),
//   path.join(__dirname, "uploads", "banners"),
//   path.join(__dirname, "uploads", "promotional-banners"),
//   path.join(__dirname, "uploads", "company-banners"),
// ];

// dirs.forEach((dir) => {
//   if (!fs.existsSync(dir)) {
//     fs.mkdirSync(dir, { recursive: true });
//   }
// });

// Serve static files with proper headers
// const staticDirs = [
//   { url: "/uploads", dir: "uploads" },
//   { url: "/uploads/banners", dir: "uploads/banners" },
//   { url: "/uploads/promotional-banners", dir: "uploads/promotional-banners" },
//   { url: "/uploads/company-banners", dir: "uploads/company-banners" },
// ];

// staticDirs.forEach(({ url, dir }) => {
//   app.use(
//     url,
//     (req, res, next) => {
//       res.setHeader("Access-Control-Allow-Origin", "*");
//       res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
//       next();
//     },
//     express.static(path.join(__dirname, dir))
//   );
// });

// Import routes
const userRoutes = require("./routes/userRoutes");
const userServiceRoutes = require("./routes/userServiceRoutes");
const userBookingRoutes = require("./routes/userBookingRoutes");
const userAccountRoutes = require("./routes/userAccountRoutes");
const partnerRoutes = require("./routes/partnerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminServiceRoutes = require("./routes/adminServiceRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const serviceHierarchyRoutes = require("./routes/serviceHierarchyRoutes");
const adminBannerRoutes = require("./routes/adminBannerRoutes");
const userBannerRoutes = require("./routes/userBannerRoutes");
const adminBookingRoutes = require("./routes/adminBookingRoutes");
const adminBookingController = require("./controllers/adminBookingController");
const notificationRoute = require('./routes/notificationRoute');
const partnerNotification = require('./routes/partnerNotification');
const firbasecall = require('./routes/notificationRoutes')
const admin = require('firebase-admin');
const { uploadFile2 } = require("./middleware/aws");
const driverFareRoutes = require('./routes/driverFareRoutes');
const phonePayRoutes = require('./routes/phonePay');
const tokenRoutes=require('./routes/tokenRoute');
const RegisterFee=require('./routes/registerFeeRoutes');
const RefferralAmount= require('./routes/referralAmountRoutes');
const hubRoutes = require('./routes/hubRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const payuRoutes = require('./routes/payuRoutes');
// Initialize Firebase Admin
try {
  // Check if Firebase is already initialized
  if (admin.apps.length === 0) {
    const serviceAccount = require('./firebase-admin.json');   
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://wave-755af.firebaseio.com`
    });
    console.log('Firebase Admin initialized successfully');
  } else {
    console.log('Firebase Admin already initialized');
  }
} catch (error) {
  console.warn('Firebase Admin initialization skipped:', error.message);
}


// Routes
app.use("/api/user", userRoutes);
app.use("/api/user", userServiceRoutes);
app.use("/api/user", userBookingRoutes);
app.use("/api/user/account", userAccountRoutes);
app.use("/api/partner", partnerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/services", adminServiceRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/public", serviceHierarchyRoutes);
app.use("/api/admin/banners", adminBannerRoutes);
app.use("/api/user/banners", userBannerRoutes);
app.use("/api/admin/bookings", adminBookingRoutes);
app.use('/api/firebase', firbasecall);
app.use('/api/user/notifications', notificationRoute);
app.use("/api/notification", partnerNotification);
app.use('/api/driverfares', driverFareRoutes);
app.use('/api/phonepay', phonePayRoutes);
app.use('/api/tokens', tokenRoutes);
// Register fee routes for public access (pricing settings)
const registerFeeRouter = require('./routes/registerFeeRoutes');
app.use('/api/registerFee', registerFeeRouter);

// Admin register fee routes
app.use('/api/admin', RegisterFee);
app.use('/api/referral', RefferralAmount);
app.use('/api/admin/hubs', hubRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/admin/whatsapp', whatsappRoutes);
app.use('/api/payu', payuRoutes);
// Add this route to your backend
app.post('/api/admin/proxy-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const response = await axios.get(imageUrl, { responseType: 'stream' });
    response.data.pipe(res);
  } catch (error) {
    res.status(404).send('Image not found');
  }
});
// Root route for WebSocket server

app.get("/admin/bookings", adminBookingController.getAllBookings);

app.use(express.static(path.join(__dirname, 'build'))); // Change 'build' to your frontend folder if needed

// Redirect all requests to the index.html file

app.get("*", (req, res) => {
  return res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
// 404 handler
app.use((req, res, next) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Auto-initialize WhatsApp automatically (no API call needed)
  const whatsappService = require('./services/whatsappService');
  const fs = require('fs');
  const path = require('path');
  
  // Always attempt to auto-connect WhatsApp on server startup
  setTimeout(async () => {
    try {
      console.log('Auto-connecting WhatsApp...');
      await whatsappService.initialize();
      
      // Check status after initialization
      setTimeout(() => {
        const status = whatsappService.getStatus();
        if (status.isReady) {
          console.log('✅ WhatsApp auto-connected successfully!');
        } else if (status.qrCode) {
          console.log('⚠️  WhatsApp requires QR code scan. Please visit admin panel to scan QR code.');
        } else {
          console.log('ℹ️  WhatsApp initialization in progress...');
        }
      }, 5000);
    } catch (error) {
      console.log('ℹ️  WhatsApp auto-initialization:', error.message);
    }
  }, 3000); // Wait 3 seconds after server starts
});
