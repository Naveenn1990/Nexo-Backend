const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.qrCode = null;
    this.isReady = false;
    this.isAuthenticated = false;
    this.statusListeners = [];
    this.autoReconnect = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds initial delay
    this.reconnectTimer = null;
    this.isReconnecting = false;
    this.manualDisconnect = false; // Track if disconnect was manual
  }

  initialize() {
    // If client already exists and is ready, return immediately
    if (this.client && this.isReady) {
      return Promise.resolve();
    }
    
    // If client exists but not ready, destroy it first
    if (this.client && !this.isReady) {
      try {
        this.client.destroy();
      } catch (error) {
        console.error('Error destroying existing client:', error);
      }
      this.client = null;
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // QR Code event
    this.client.on('qr', async (qr) => {
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        this.notifyStatusListeners({
          qrCode: this.qrCode,
          isReady: false,
          isAuthenticated: false
        });
        console.log('QR Code generated');
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    });

    // Ready event
    this.client.on('ready', () => {
      this.isReady = true;
      this.isAuthenticated = true;
      this.qrCode = null;
      this.isReconnecting = false;
      this.reconnectAttempts = 0; // Reset on successful connection
      this.manualDisconnect = false; // Reset manual disconnect flag
      this.notifyStatusListeners({
        qrCode: null,
        isReady: true,
        isAuthenticated: true
      });
      console.log('✅ WhatsApp client is ready and connected!');
    });

    // Authentication event
    this.client.on('authenticated', () => {
      this.isAuthenticated = true;
      this.notifyStatusListeners({
        qrCode: null,
        isReady: false,
        isAuthenticated: true
      });
      console.log('WhatsApp client authenticated');
    });

    // Authentication failure event
    this.client.on('auth_failure', (msg) => {
      this.isReady = false;
      this.isAuthenticated = false;
      this.notifyStatusListeners({
        qrCode: null,
        isReady: false,
        isAuthenticated: false,
        error: msg
      });
      console.error('Authentication failure:', msg);
    });

    // Disconnected event
    this.client.on('disconnected', (reason) => {
      this.isReady = false;
      this.isAuthenticated = false;
      this.qrCode = null;
      this.notifyStatusListeners({
        qrCode: null,
        isReady: false,
        isAuthenticated: false,
        error: reason
      });
      console.log('⚠️  WhatsApp client disconnected:', reason);
      
      // Auto-reconnect if enabled and not manually disconnected
      if (this.autoReconnect && !this.manualDisconnect) {
        console.log('🔄 Auto-reconnect enabled. Attempting to reconnect...');
        this.handleAutoReconnect(reason);
      } else {
        this.manualDisconnect = false; // Reset flag
        if (!this.autoReconnect) {
          console.log('ℹ️  Auto-reconnect is disabled. Please reconnect manually.');
        }
      }
    });

    // Initialize the client
    return this.client.initialize();
  }

  async sendMessage(phoneNumber, message) {
    if (!this.isReady || !this.client) {
      throw new Error('WhatsApp client is not ready. Please connect first.');
    }

    // Format phone number (remove + and ensure country code)
    let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    // If number doesn't start with country code, assume it's Indian (+91)
    if (formattedNumber.length === 10) {
      formattedNumber = '91' + formattedNumber;
    }

    // WhatsApp format: country code + number @c.us
    const chatId = `${formattedNumber}@c.us`;

    try {
      const result = await this.client.sendMessage(chatId, message);
      return {
        success: true,
        messageId: result.id._serialized,
        timestamp: result.timestamp
      };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async sendOTP(phoneNumber, otp) {
    const message = `🔐 Nexo Works - OTP Verification

Your One-Time Password (OTP) for mobile number verification is:

${otp}

This OTP is valid for 10 minutes. Please do not share this code with anyone.

If you didn't request this OTP, please ignore this message.

━━━━━━━━━━━━━━━━━━━━
Thank you for choosing Nexo Works!
We appreciate your trust in our services.

Best regards,
Nexo Works Team`;
    return await this.sendMessage(phoneNumber, message);
  }

  getQRCode() {
    return this.qrCode;
  }

  getStatus() {
    return {
      isReady: this.isReady,
      isAuthenticated: this.isAuthenticated,
      qrCode: this.qrCode,
      autoReconnect: this.autoReconnect,
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting
    };
  }

  async disconnect() {
    // Set manual disconnect flag to prevent auto-reconnect
    this.manualDisconnect = true;
    
    // Clear any pending reconnect timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Reset reconnect attempts
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    
    if (this.client) {
      try {
        await this.client.logout();
        await this.client.destroy();
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
      this.client = null;
      this.isReady = false;
      this.isAuthenticated = false;
      this.qrCode = null;
      this.notifyStatusListeners({
        qrCode: null,
        isReady: false,
        isAuthenticated: false
      });
    }
  }

  async handleAutoReconnect(reason) {
    // Prevent multiple simultaneous reconnection attempts
    if (this.isReconnecting) {
      return;
    }

    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping auto-reconnect.`);
      this.notifyStatusListeners({
        qrCode: null,
        isReady: false,
        isAuthenticated: false,
        error: `Auto-reconnect failed after ${this.maxReconnectAttempts} attempts. Please reconnect manually.`
      });
      this.reconnectAttempts = 0;
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff (max 60 seconds)
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000);

    console.log(`🔄 Attempting to reconnect WhatsApp (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay/1000} seconds...`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        // Clean up old client if it exists
        if (this.client) {
          try {
            await this.client.destroy();
          } catch (error) {
            console.error('Error destroying old client:', error);
          }
          this.client = null;
        }

        // Reinitialize automatically (no API call needed)
        console.log('🔄 Reinitializing WhatsApp client...');
        await this.initialize();
        this.isReconnecting = false;
        
        // Reset attempts on successful initialization (will be reset to 0 on ready event)
        console.log('✅ Reconnection attempt initiated. Waiting for connection...');
      } catch (error) {
        console.error('❌ Error during reconnection:', error.message);
        this.isReconnecting = false;
        // Retry again after delay if not exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.handleAutoReconnect(reason);
        }
      }
    }, delay);
  }

  async reconnect() {
    // Manual reconnect method
    this.manualDisconnect = false;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        await this.client.destroy();
      } catch (error) {
        console.error('Error destroying client during reconnect:', error);
      }
      this.client = null;
    }

    return await this.initialize();
  }

  setAutoReconnect(enabled) {
    this.autoReconnect = enabled;
    if (!enabled && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.isReconnecting = false;
    }
  }

  addStatusListener(callback) {
    this.statusListeners.push(callback);
    // Immediately call with current status
    callback(this.getStatus());
  }

  removeStatusListener(callback) {
    this.statusListeners = this.statusListeners.filter(listener => listener !== callback);
  }

  notifyStatusListeners(status) {
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    });
  }
}

// Export singleton instance
const whatsappService = new WhatsAppService();

module.exports = whatsappService;

