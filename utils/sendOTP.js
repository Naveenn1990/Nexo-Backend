const { default: axios } = require('axios');
const fetch = require('node-fetch');
const whatsappService = require('../services/whatsappService');

// Send OTP via WhatsApp
exports.sendOTP = async (phone, otp) => {
  try {
    // Check if WhatsApp is ready
    const status = whatsappService.getStatus();
    console.log(`📱 Checking WhatsApp status for OTP to ${phone}:`, {
      isReady: status.isReady,
      isAuthenticated: status.isAuthenticated,
      isReconnecting: status.isReconnecting
    });
    
    if (!status.isReady) {
      // const errorMsg = status.isReconnecting 
      //   ? 'WhatsApp is reconnecting. Please wait a moment and try again.'
      //   : 'WhatsApp is not connected. Please connect WhatsApp in admin panel first.';
      // console.warn(`⚠️ ${errorMsg}`);
      // throw new Error(errorMsg);
      console.log('WhatsApp is not connected. Please connect WhatsApp in admin panel first.');
      return {
        success: false,
        message: 'WhatsApp is not connected. Please connect WhatsApp in admin panel first.',
      };
    }

    // Send OTP via WhatsApp
    console.log(`📤 Sending OTP via WhatsApp to ${phone}...`);
    const result = await whatsappService.sendOTP(phone, otp);
    console.log('✅ OTP sent via WhatsApp successfully:', {
      phone,
      messageId: result.messageId,
      timestamp: result.timestamp
    });
    return result;
  } catch (error) {
    console.error('❌ Error sending OTP via WhatsApp:', {
      phone,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Legacy SMS function (commented out, kept for reference)
// exports.sendOTP=async (phone, otp) => {
//   const apiUrl = `https://1.rapidsms.co.in/api/push`;
//     const params = {
//         apikey: "6874d06f3053b",
//         route: "TRANS",
//         sender: "WVETEC",
//         mobileno: phone,
//         text: `Welcome to Wave Tech Services your Mobile Number Verification Code is ${otp}`
//     };
//     try {
//         const response = await axios.get(apiUrl, { params });
//         console.log('SMS sent successfully:', response.data);
//         return response.data;
//     } catch (error) {
//         console.error('Error sending SMS:', error.message);
//         throw error;
//     }
// }



