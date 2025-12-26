const Partner = require('../models/PartnerModel');
const User = require('../models/User');
const Notification = require('../models/Notification');
const firebaseAdmin = require('../config/firebase');

/**
 * Send notification to partner about material quotation status
 */
const sendPartnerMaterialNotification = async (partnerId, title, message, data = {}) => {
  try {
    console.log(`[Partner Notification] Sending to partner: ${partnerId}`);
    
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      console.error('[Partner Notification] Partner not found');
      return { success: false, error: 'Partner not found' };
    }

    // Create notification record
    const notification = new Notification({
      userId: partnerId,
      userType: 'partner',
      title: title,
      message: message,
      type: 'material_quotation',
      data: JSON.stringify(data),
      skipFcm: false
    });
    await notification.save();

    // Send FCM notification if partner has token
    if (partner.fcmToken) {
      try {
        await firebaseAdmin.messaging().send({
          notification: {
            title: title,
            body: message
          },
          data: {
            type: 'material_quotation',
            ...data
          },
          token: partner.fcmToken
        });
        console.log('[Partner Notification] ✅ FCM notification sent successfully');
      } catch (fcmError) {
        console.error('[Partner Notification] ❌ FCM error:', fcmError);
      }
    }

    return { success: true, notificationId: notification._id };
  } catch (error) {
    console.error('[Partner Notification] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to customer about material quotation status
 */
const sendCustomerMaterialNotification = async (customerPhone, customerEmail, title, message, data = {}) => {
  try {
    console.log(`[Customer Notification] Sending to customer: ${customerPhone}`);
    
    // Try to find user by phone or email
    let user = null;
    if (customerPhone) {
      user = await User.findOne({ phone: customerPhone });
    }
    if (!user && customerEmail) {
      user = await User.findOne({ email: customerEmail });
    }

    if (user) {
      // Create notification record for registered user
      const notification = new Notification({
        userId: user._id,
        userType: 'user',
        title: title,
        message: message,
        type: 'material_quotation',
        data: JSON.stringify(data),
        skipFcm: false
      });
      await notification.save();

      // Send FCM notification if user has token
      if (user.fcmToken) {
        try {
          await firebaseAdmin.messaging().send({
            notification: {
              title: title,
              body: message
            },
            data: {
              type: 'material_quotation',
              ...data
            },
            token: user.fcmToken
          });
          console.log('[Customer Notification] ✅ FCM notification sent to registered user');
        } catch (fcmError) {
          console.error('[Customer Notification] ❌ FCM error:', fcmError);
        }
      }

      return { success: true, userFound: true, notificationId: notification._id };
    } else {
      // Customer is not a registered user, log for SMS/Email implementation
      console.log('[Customer Notification] 📱 Customer not registered, would send SMS/Email');
      console.log(`[Customer Notification] Phone: ${customerPhone}, Email: ${customerEmail}`);
      console.log(`[Customer Notification] Message: ${message}`);
      
      // Here you could implement SMS or Email notification
      // Example: await sendSMS(customerPhone, message);
      // Example: await sendEmail(customerEmail, title, message);
      
      return { success: true, userFound: false, method: 'sms_email' };
    }
  } catch (error) {
    console.error('[Customer Notification] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to technician about material quotation
 */
const sendTechnicianMaterialNotification = async (technicianPhone, technicianName, title, message, data = {}) => {
  try {
    console.log(`[Technician Notification] Sending to technician: ${technicianName} (${technicianPhone})`);
    
    // Try to find technician in partner database (technicians might be partners)
    const technician = await Partner.findOne({ phone: technicianPhone });
    
    if (technician) {
      // Technician is a registered partner
      return await sendPartnerMaterialNotification(technician._id, title, message, data);
    } else {
      // Technician is not registered, log for SMS implementation
      console.log('[Technician Notification] 📱 Technician not registered, would send SMS');
      console.log(`[Technician Notification] Phone: ${technicianPhone}`);
      console.log(`[Technician Notification] Message: ${message}`);
      
      // Here you could implement SMS notification
      // Example: await sendSMS(technicianPhone, message);
      
      return { success: true, technicianFound: false, method: 'sms' };
    }
  } catch (error) {
    console.error('[Technician Notification] Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send comprehensive notifications for material quotation events
 */
const sendMaterialQuotationNotifications = async (eventType, quotationData) => {
  try {
    console.log(`[Material Notifications] Processing ${eventType} notifications`);
    
    const results = {
      partner: null,
      customer: null,
      technician: null,
      admin: null
    };

    switch (eventType) {
      case 'quotation_submitted':
        // Notify partner that quotation was submitted
        if (quotationData.partnerPhone) {
          const partner = await Partner.findOne({ phone: quotationData.partnerPhone });
          if (partner) {
            results.partner = await sendPartnerMaterialNotification(
              partner._id,
              '📋 Material Quotation Submitted',
              `Your material quotation request for customer ${quotationData.customerName} has been submitted successfully. Request ID: ${quotationData.requestId}`,
              { requestId: quotationData.requestId, customerName: quotationData.customerName }
            );
          }
        }

        // Notify customer that quotation was received
        results.customer = await sendCustomerMaterialNotification(
          quotationData.customerPhone,
          quotationData.customerEmail,
          '✅ Material Quotation Request Received',
          `Dear ${quotationData.customerName}, your material quotation request has been received. Our team will contact you soon. Service: ${quotationData.serviceType}`,
          { requestId: quotationData.requestId, serviceType: quotationData.serviceType }
        );

        // Notify technician about the material request
        results.technician = await sendTechnicianMaterialNotification(
          quotationData.technicianPhone,
          quotationData.technicianName,
          '🔧 Material Request for Your Service',
          `Material quotation requested for customer ${quotationData.customerName}. Service: ${quotationData.serviceType}. Admin will coordinate delivery.`,
          { requestId: quotationData.requestId, customerName: quotationData.customerName, serviceType: quotationData.serviceType }
        );
        break;

      case 'quotation_approved':
        // Notify all parties that quotation was approved
        results.customer = await sendCustomerMaterialNotification(
          quotationData.customerPhone,
          quotationData.customerEmail,
          '✅ Material Quotation Approved',
          `Your material quotation has been approved. Total amount: ₹${quotationData.totalAmount}. Materials will be delivered soon.`,
          { requestId: quotationData.requestId, totalAmount: quotationData.totalAmount }
        );

        results.technician = await sendTechnicianMaterialNotification(
          quotationData.technicianPhone,
          quotationData.technicianName,
          '✅ Materials Approved for Delivery',
          `Materials for customer ${quotationData.customerName} have been approved. Delivery will be coordinated soon.`,
          { requestId: quotationData.requestId, customerName: quotationData.customerName }
        );
        break;

      case 'materials_delivered':
        // Notify all parties that materials were delivered
        results.customer = await sendCustomerMaterialNotification(
          quotationData.customerPhone,
          quotationData.customerEmail,
          '🚚 Materials Delivered',
          `Your materials have been delivered successfully. Please check with your technician ${quotationData.technicianName}.`,
          { requestId: quotationData.requestId, technicianName: quotationData.technicianName }
        );

        results.technician = await sendTechnicianMaterialNotification(
          quotationData.technicianPhone,
          quotationData.technicianName,
          '📦 Materials Delivered',
          `Materials for customer ${quotationData.customerName} have been delivered. You can now proceed with the service.`,
          { requestId: quotationData.requestId, customerName: quotationData.customerName }
        );
        break;
    }

    console.log('[Material Notifications] ✅ Notification processing completed');
    return { success: true, results };
  } catch (error) {
    console.error('[Material Notifications] Error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPartnerMaterialNotification,
  sendCustomerMaterialNotification,
  sendTechnicianMaterialNotification,
  sendMaterialQuotationNotifications
};