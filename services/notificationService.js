const firebaseAdmin = require('../config/firebase');
const Notification = require('../models/Notification');
const Partner = require('../models/PartnerModel');
const Vendor = require('../models/VendorModel');
const Admin = require('../models/admin');
const User = require('../models/User');

// Verify Firebase is initialized
try {
  if (!firebaseAdmin.apps || firebaseAdmin.apps.length === 0) {
    console.error('[Notification] ⚠️ WARNING: Firebase Admin is not initialized!');
  } else {
    console.log('[Notification] ✅ Firebase Admin is initialized');
  }
} catch (error) {
  console.error('[Notification] ⚠️ Error checking Firebase initialization:', error);
}

// Helper to get icon URL
const getIconUrl = (icon, baseUrl = 'https://nexo.works') => {
  if (!icon) return null;
  if (icon.startsWith('http://') || icon.startsWith('https://')) {
    return icon;
  }
  return `${baseUrl}${icon.startsWith('/') ? icon : '/' + icon}`;
};

// Send notification to partner
const sendPartnerNotification = async (partnerId, title, message, type = 'info', icon = null, image = null) => {
  try {
    const partner = await Partner.findById(partnerId).select('fcmtoken profile.name phone');
    if (!partner) {
      return;
    }
    
    // Double-check FCM token by querying again if not found
    if (!partner.fcmtoken) {
      const partnerCheck = await Partner.findById(partnerId).select('fcmtoken');
      if (partnerCheck?.fcmtoken) {
        partner.fcmtoken = partnerCheck.fcmtoken;
      }
    }

    // Create notification in database
    const notification = new Notification({
      userId: partnerId,
      title,
      message,
      type,
      icon,
      image,
      skipFcm: false
    });
    await notification.save();

    // Send FCM if token exists
    if (partner.fcmtoken) {
      const iconUrl = getIconUrl(icon);
      const imageUrl = image ? getIconUrl(image) : null;

      const fcmMessage = {
        notification: {
          title,
          body: message.length > 100 ? message.slice(0, 97) + '...' : message
        },
        data: {
          type: type || 'new-notification',
          userId: partnerId.toString(),
          title,
          message: message.length > 100 ? message.slice(0, 97) + '...' : message,
          timestamp: new Date().toISOString(),
          ...(iconUrl && { icon: iconUrl }),
          ...(imageUrl && { image: imageUrl })
        },
        token: partner.fcmtoken,
        webpush: {
          notification: {
            ...(iconUrl && { icon: iconUrl }),
            ...(iconUrl && { badge: iconUrl }),
            ...(imageUrl && { image: imageUrl }),
            sound: 'default',
            requireInteraction: false,
            silent: false
          },
          fcmOptions: {
            link: '/'
          }
        },
        android: {
          priority: 'high',
          ttl: 86400
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

      try {
        await firebaseAdmin.messaging().send(fcmMessage);
        console.log(`[Notification] ✅ FCM sent successfully to partner ${partnerId}`);
      } catch (fcmError) {
        console.error(`[Notification] ❌ FCM error for partner ${partnerId}:`, fcmError.code || fcmError.message || fcmError);
      }
    }
  } catch (error) {
    console.error('Error sending notification to partner:', error);
  }
};

// Send notification to admin
const sendAdminNotification = async (adminId, title, message, type = 'info', icon = null, image = null) => {
  try {
    const adminUser = await Admin.findById(adminId);
    if (!adminUser) {
      console.log(`[Notification] Admin ${adminId} not found`);
      return;
    }

    // Add notification to admin's notifications array
    const notification = {
      message: `${title}: ${message}`,
      title: title,
      seen: false,
      read: false,
      date: new Date(),
      createdAt: new Date(),
      type: type || 'info'
    };
    adminUser.notifications.push(notification);
    await adminUser.save();
    console.log(`[Notification] Saved notification to admin ${adminId} database`);

    // Send FCM if token exists
    if (adminUser.fcmToken && adminUser.fcmToken.trim() !== '') {
      console.log(`[Notification] Admin ${adminId} (${adminUser.name || adminUser.email}) has FCM token`);
      const iconUrl = getIconUrl(icon);
      const imageUrl = image ? getIconUrl(image) : null;

      const fcmMessage = {
        notification: {
          title: title || 'Notification',
          body: message.length > 100 ? message.slice(0, 97) + '...' : message
        },
        data: {
          type: type || 'new-notification',
          adminId: adminId.toString(),
          title: title || 'Notification',
          message: message.length > 100 ? message.slice(0, 97) + '...' : message,
          timestamp: new Date().toISOString(),
          ...(iconUrl && { icon: iconUrl }),
          ...(imageUrl && { image: imageUrl })
        },
        token: adminUser.fcmToken.trim(),
        webpush: {
          notification: {
            ...(iconUrl && { icon: iconUrl }),
            ...(iconUrl && { badge: iconUrl }),
            ...(imageUrl && { image: imageUrl }),
            sound: 'default',
            requireInteraction: false,
            silent: false
          },
          fcmOptions: {
            link: '/admin'
          }
        },
        android: {
          priority: 'high',
          ttl: 86400
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
              sound: 'default'
            }
          },
          headers: {
            'apns-priority': '10'
          }
        }
      };

      try {
        // Verify Firebase Admin is initialized
        if (!firebaseAdmin.apps || firebaseAdmin.apps.length === 0) {
          throw new Error('Firebase Admin is not initialized');
        }

        console.log(`[Notification] 🔔 Sending FCM to admin ${adminId} (${adminUser.name || adminUser.email})`);
        console.log(`[Notification] Token preview: ${adminUser.fcmToken.substring(0, 30)}...`);
        console.log(`[Notification] Token length: ${adminUser.fcmToken.length} characters`);
        console.log(`[Notification] Title: "${title}"`);
        console.log(`[Notification] Message: "${message.substring(0, 50)}..."`);
        
        // Validate token format (FCM tokens are typically long strings)
        if (adminUser.fcmToken.length < 50) {
          throw new Error(`Invalid FCM token format: token too short (${adminUser.fcmToken.length} chars)`);
        }
        
        const response = await firebaseAdmin.messaging().send(fcmMessage);
        console.log(`[Notification] ✅✅✅ SUCCESS! FCM sent to admin ${adminId}`);
        console.log(`[Notification] Response:`, response);
        return true;
      } catch (fcmError) {
        console.error(`[Notification] ❌❌❌ FCM ERROR for admin ${adminId}:`);
        console.error(`[Notification] Error Code: ${fcmError.code || 'UNKNOWN'}`);
        console.error(`[Notification] Error Message: ${fcmError.message || fcmError.toString()}`);
        
        // Log full error details
        if (fcmError.errorInfo) {
          console.error(`[Notification] Error Info:`, fcmError.errorInfo);
        }
        
        // Handle specific Firebase errors
        if (fcmError.code === 'messaging/invalid-registration-token' || 
            fcmError.code === 'messaging/registration-token-not-registered' ||
            fcmError.code === 'messaging/invalid-argument') {
          console.log(`[Notification] ⚠️ Invalid FCM token detected, clearing token for admin ${adminId}`);
          try {
            adminUser.fcmToken = null;
            await adminUser.save();
            console.log(`[Notification] Token cleared successfully`);
          } catch (saveError) {
            console.error(`[Notification] Failed to clear token:`, saveError);
          }
        }
        return false;
      }
    } else {
      console.log(`[Notification] ⚠️ Admin ${adminId} (${adminUser.name || adminUser.email}) has NO FCM token - notification saved to database only`);
      return true; // Return true since notification was saved to DB
    }
  } catch (error) {
    console.error(`[Notification] Error sending notification to admin ${adminId}:`, error.message || error);
    throw error;
  }
};

// Send notification to all admins
const sendAllAdminsNotification = async (title, message, type = 'info', icon = null, image = null) => {
  try {
    console.log(`[Notification] ========================================`);
    console.log(`[Notification] 📢 SENDING NOTIFICATION TO ALL ADMINS`);
    console.log(`[Notification] Title: "${title}"`);
    console.log(`[Notification] Message: "${message}"`);
    console.log(`[Notification] Type: ${type}`);
    console.log(`[Notification] ========================================`);
    
    const admins = await Admin.find({}).select('_id fcmToken name email');
    console.log(`[Notification] Found ${admins.length} admin(s) in database`);
    
    if (admins.length === 0) {
      console.log('[Notification] ⚠️ WARNING: No admins found in database!');
      return { success: false, sent: 0, total: 0, error: 'No admins found' };
    }

    // Log each admin's details
    console.log(`[Notification] Admin Details:`);
    admins.forEach((adminUser, index) => {
      const hasToken = !!(adminUser.fcmToken && adminUser.fcmToken.trim() !== '');
      console.log(`[Notification]   ${index + 1}. ${adminUser.name || adminUser.email} (ID: ${adminUser._id}) - Token: ${hasToken ? '✅ EXISTS' : '❌ MISSING'}`);
    });

    const results = await Promise.all(
      admins.map(async (adminUser) => {
        try {
          const hasToken = !!(adminUser.fcmToken && adminUser.fcmToken.trim() !== '');
          console.log(`[Notification] Processing admin ${adminUser._id} (${adminUser.name || adminUser.email})...`);
          
          const result = await sendAdminNotification(adminUser._id, title, message, type, icon, image);
          return { 
            success: result !== false, 
            adminId: adminUser._id, 
            name: adminUser.name || adminUser.email,
            hasToken 
          };
        } catch (err) {
          console.error(`[Notification] ❌ Exception sending to admin ${adminUser._id}:`, err.message || err);
          console.error(`[Notification] Stack:`, err.stack);
          return { 
            success: false, 
            adminId: adminUser._id, 
            name: adminUser.name || adminUser.email,
            error: err.message || err.toString() 
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    const withTokenCount = results.filter(r => r.hasToken).length;
    const sentCount = results.filter(r => r.success && r.hasToken).length;
    
    console.log(`[Notification] ========================================`);
    console.log(`[Notification] 📊 NOTIFICATION SUMMARY:`);
    console.log(`[Notification] Total Admins: ${admins.length}`);
    console.log(`[Notification] Admins with FCM Token: ${withTokenCount}`);
    console.log(`[Notification] FCM Sent Successfully: ${sentCount}`);
    console.log(`[Notification] Database Saved: ${successCount}`);
    console.log(`[Notification] Failed: ${failedCount}`);
    console.log(`[Notification] ========================================`);
    
    return { 
      success: successCount > 0, 
      sent: sentCount, 
      saved: successCount,
      total: admins.length, 
      failed: failedCount,
      withToken: withTokenCount
    };
  } catch (error) {
    console.error('[Notification] ❌❌❌ CRITICAL ERROR sending notification to all admins:', error);
    console.error('[Notification] Error stack:', error.stack);
    throw error;
  }
};

// Send notification to vendor
const sendVendorNotification = async (vendorId, title, message, type = 'info', icon = null, image = null) => {
  try {
    const vendor = await Vendor.findById(vendorId).select('fcmtoken name email');
    if (!vendor) {
      return;
    }
    
    // Double-check FCM token by querying again if not found
    if (!vendor.fcmtoken) {
      const vendorCheck = await Vendor.findById(vendorId).select('fcmtoken');
      if (vendorCheck?.fcmtoken) {
        vendor.fcmtoken = vendorCheck.fcmtoken;
      }
    }

    // Create notification in database
    const notification = new Notification({
      userId: vendorId,
      userType: 'vendor',
      userTypeModel: 'Vendor',
      title,
      message,
      type,
      icon,
      image,
      skipFcm: false
    });
    await notification.save();

    // Send FCM if token exists
    if (vendor.fcmtoken) {
      const iconUrl = getIconUrl(icon);
      const imageUrl = image ? getIconUrl(image) : null;

      // Check if this is a status change notification
      const isStatusChange = title.toLowerCase().includes('account') && 
        (title.toLowerCase().includes('activated') || 
         title.toLowerCase().includes('suspended') || 
         title.toLowerCase().includes('deactivated'))

      const fcmMessage = {
        notification: {
          title,
          body: message.length > 100 ? message.slice(0, 97) + '...' : message
        },
        data: {
          type: isStatusChange ? 'status-change' : (type || 'new-notification'),
          userId: vendorId.toString(),
          userType: 'vendor',
          title,
          message: message.length > 100 ? message.slice(0, 97) + '...' : message,
          timestamp: new Date().toISOString(),
          isStatusChange: isStatusChange ? 'true' : 'false',
          ...(iconUrl && { icon: iconUrl }),
          ...(imageUrl && { image: imageUrl })
        },
        token: vendor.fcmtoken,
        webpush: {
          notification: {
            ...(iconUrl && { icon: iconUrl }),
            ...(iconUrl && { badge: iconUrl }),
            ...(imageUrl && { image: imageUrl }),
            sound: 'default',
            requireInteraction: false,
            silent: false
          },
          fcmOptions: {
            link: '/'
          }
        },
        android: {
          priority: 'high',
          ttl: 86400
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

      try {
        await firebaseAdmin.messaging().send(fcmMessage);
        console.log(`[Notification] ✅ FCM sent successfully to vendor ${vendorId}`);
      } catch (fcmError) {
        console.error(`[Notification] ❌ FCM error for vendor ${vendorId}:`, fcmError.code || fcmError.message || fcmError);
      }
    }
  } catch (error) {
    console.error('Error sending notification to vendor:', error);
  }
};

module.exports = {
  sendPartnerNotification,
  sendVendorNotification,
  sendAdminNotification,
  sendAllAdminsNotification
};

