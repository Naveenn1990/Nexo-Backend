const whatsappService = require('../services/whatsappService');

// Initialize WhatsApp client
exports.initialize = async (req, res) => {
  try {
    await whatsappService.initialize();
    const status = whatsappService.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Error initializing WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize WhatsApp client',
      error: error.message
    });
  }
};

// Get QR code
exports.getQRCode = async (req, res) => {
  try {
    // Ensure client is initialized
    if (!whatsappService.client) {
      await whatsappService.initialize();
    }

    const status = whatsappService.getStatus();
    
    if (status.qrCode) {
      return res.json({
        success: true,
        qrCode: status.qrCode,
        isReady: false,
        isAuthenticated: false
      });
    } else if (status.isReady) {
      return res.json({
        success: true,
        qrCode: null,
        isReady: true,
        isAuthenticated: true,
        message: 'WhatsApp is already connected'
      });
    } else {
      // Wait a bit for QR code to be generated
      setTimeout(async () => {
        const updatedStatus = whatsappService.getStatus();
        res.json({
          success: true,
          qrCode: updatedStatus.qrCode,
          isReady: updatedStatus.isReady,
          isAuthenticated: updatedStatus.isAuthenticated
        });
      }, 2000);
    }
  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get QR code',
      error: error.message
    });
  }
};

// Get connection status
exports.getStatus = async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get status',
      error: error.message
    });
  }
};

// Disconnect WhatsApp
exports.disconnect = async (req, res) => {
  try {
    await whatsappService.disconnect();
    res.json({
      success: true,
      message: 'WhatsApp disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect WhatsApp',
      error: error.message
    });
  }
};

// Reconnect WhatsApp
exports.reconnect = async (req, res) => {
  try {
    await whatsappService.reconnect();
    const status = whatsappService.getStatus();
    res.json({
      success: true,
      message: 'WhatsApp reconnection initiated',
      ...status
    });
  } catch (error) {
    console.error('Error reconnecting WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reconnect WhatsApp',
      error: error.message
    });
  }
};

// Set auto-reconnect setting
exports.setAutoReconnect = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean value'
      });
    }
    
    whatsappService.setAutoReconnect(enabled);
    res.json({
      success: true,
      message: `Auto-reconnect ${enabled ? 'enabled' : 'disabled'}`,
      autoReconnect: enabled
    });
  } catch (error) {
    console.error('Error setting auto-reconnect:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set auto-reconnect',
      error: error.message
    });
  }
};

// Send test message
exports.sendTestMessage = async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const result = await whatsappService.sendMessage(
      phoneNumber,
      message || 'Test message from Nexo Works'
    );

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send message',
      error: error.message
    });
  }
};

