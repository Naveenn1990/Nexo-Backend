const mongoose = require('mongoose');
const admin = require('firebase-admin');
const Partner = require('./PartnerModel'); // Adjust path to your Partner model
const Vendor = require('./VendorModel'); // Add Vendor model

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userTypeModel', // Dynamic reference based on userType
    },
    userType: {
      type: String,
      enum: ['partner', 'vendor', 'user', 'admin'],
      default: 'partner',
    },
    userTypeModel: {
      type: String,
      enum: ['Partner', 'Vendor', 'User', 'Admin'],
      default: 'Partner',
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['info', 'alert', 'message', 'job', 'success', 'booking_paused', 'booking_resumed'], // Added booking status types
      default: 'info',
    },
    icon: {
      type: String,
      default: null, // Custom icon URL
    },
    image: {
      type: String,
      default: null, // Image URL for rich notifications
    },
    skipFcm: {
      type: Boolean,
      default: false, // Flag to skip FCM in post-save hook
    },
  },
  { timestamps: true },
);

// Post-save hook for real-time FCM notifications
notificationSchema.post('save', async function (doc) {
  try {
    // Skip FCM if flag is set (e.g., createNotification already sent FCM)
    if (doc.skipFcm) {
      console.log(`Skipping FCM for notification ${doc._id} (skipFcm=true)`);
      return;
    }

    const userIdString = doc.userId.toString();
    let user = null;
    let fcmToken = null;

    // Get user based on userType
    if (doc.userType === 'vendor') {
      user = await Vendor.findById(userIdString).select('fcmtoken name email');
      fcmToken = user?.fcmtoken;
    } else if (doc.userType === 'partner') {
      user = await Partner.findById(userIdString).select('fcmtoken profile.name phone');
      fcmToken = user?.fcmtoken;
    } else {
      // For other user types, skip FCM in post-save hook (they may have custom handlers)
      console.log(`Skipping FCM for userType: ${doc.userType}`);
      return;
    }

    if (!fcmToken) {
      console.log(`No FCM token for ${doc.userType}: ${userIdString}`);
      return;
    }

    // Helper to get icon URL (use full URL for web)
    const getIconUrl = (icon) => {
      if (!icon) return null;
      // If already a full URL, return as is
      if (icon.startsWith('http://') || icon.startsWith('https://')) {
        return icon;
      }
      // Otherwise, prepend base URL
      return `http://localhost:9088${icon.startsWith('/') ? icon : '/' + icon}`;
    };

    const iconUrl = getIconUrl(doc.icon);
    const imageUrl = doc.image ? (doc.image.startsWith('http') ? doc.image : `http://localhost:9088${doc.image.startsWith('/') ? doc.image : '/' + doc.image}`) : null;

    const userMessage = {
      notification: {
        title: doc.title,
        body: doc.message.length > 100 ? doc.message.slice(0, 97) + '...' : doc.message // Truncate to avoid size issues
        // Note: icon and image are NOT supported in top-level notification object
        // They should only be in webpush.notification
      },
      data: {
        type: doc.type || 'new-notification',
        userId: userIdString,
        userType: doc.userType || 'partner',
        title: doc.title,
        message: doc.message.length > 100 ? doc.message.slice(0, 97) + '...' : doc.message,
        timestamp: new Date().toISOString(),
        ...(iconUrl && { icon: iconUrl }),
        ...(imageUrl && { image: imageUrl }),
      },
      token: fcmToken,
      webpush: {
        notification: {
          ...(iconUrl && { icon: iconUrl }),
          ...(iconUrl && { badge: iconUrl }),
          ...(imageUrl && { image: imageUrl }),
          sound: 'default', // Play default notification sound
          requireInteraction: false,
          silent: false // Ensure sound plays
        },
        fcmOptions: {
          link: '/' // Link to open when notification is clicked
        }
      },
      "android": {
        "priority": "high",
        "ttl": 86400
      },
      "apns": {
        "payload": {
          "aps": {
            "contentAvailable": true
          }
        },
        "headers": {
          "apns-priority": "5"
        }
      }
    };

    // Validate payload size (4KB = 4096 bytes)
    const payloadString = JSON.stringify(userMessage);
    const payloadSize = Buffer.byteLength(payloadString, 'utf8');
    if (payloadSize > 4096) {
      console.error(
        `FCM payload too large for ${doc.userType} ${userIdString}: ${payloadSize} bytes`,
      );
      // Fallback to minimal payload
      userMessage.notification.body = userMessage.notification.body.slice(0, 50) + '...';
      userMessage.data.message = userMessage.data.message.slice(0, 50) + '...';
      const fallbackSize = Buffer.byteLength(JSON.stringify(userMessage), 'utf8');
      if (fallbackSize > 4096) {
        console.error(
          `Fallback FCM payload still too large for ${doc.userType} ${userIdString}: ${fallbackSize} bytes`,
        );
        return;
      }
    }

    console.log(`Sending FCM notification to ${doc.userType}: ${userIdString}`);
    await admin.messaging().send(userMessage);
    console.log(`FCM notification sent to ${doc.userType}: ${userIdString}`);
  } catch (error) {
    console.error(
      `Error in post-save hook for notification ${doc._id}:`,
      error.message,
    );
  }
});

module.exports = mongoose.model('Notification', notificationSchema);