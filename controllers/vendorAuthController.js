const Vendor = require("../models/VendorModel");
const jwt = require("jsonwebtoken");
const { sendOTP } = require("../utils/sendOTP");

// Send OTP for vendor login/registration
exports.sendLoginOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Try to find vendor by phone
    let vendor = await Vendor.findOne({ phone });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found. Please contact admin for registration.",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

    // Save OTP and expiry
    vendor = await Vendor.findOneAndUpdate(
      { phone },
      {
        $set: {
          tempOTP: otp,
          otpExpiry: otpExpiry,
        },
      },
      { new: true }
    );

    // Send OTP via WhatsApp
    try {
      console.log(`📱 Attempting to send vendor OTP to ${phone}, OTP: ${otp}`);
      const sendResult = await sendOTP(phone, otp);
      console.log(`✅ Vendor OTP sent successfully to ${phone}:`, sendResult);
      
      return res.json({
        success: true,
        message: "OTP sent successfully to your WhatsApp",
        phone
      });
    } catch (otpError) {
      console.error("❌ Error sending vendor OTP:", {
        phone,
        error: otpError.message || otpError,
        stack: otpError.stack
      });
      
      // If WhatsApp is not connected, provide helpful error message
      if (otpError.message && (
        otpError.message.includes('WhatsApp is not connected') ||
        otpError.message.includes('not ready') ||
        otpError.message.includes('Please connect WhatsApp') ||
        otpError.message.includes('reconnecting')
      )) {
        return res.status(503).json({
          success: false,
          message: "WhatsApp service is not connected. Please contact admin to connect WhatsApp for OTP delivery.",
          error: "WhatsApp not connected",
          details: "The admin needs to connect WhatsApp in the admin panel to enable OTP delivery."
        });
      }
      
      // For other errors, return error response
      return res.status(500).json({
        success: false,
        message: otpError.message || "Error sending OTP. Please try again later.",
        error: otpError.message || "Unknown error"
      });
    }
  } catch (error) {
    console.error("Send Vendor OTP Error:", error);
    // Only return error if not already returned above
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message || "Error sending OTP. Please try again later.",
        error: error.message
      });
    }
  }
};

// Verify OTP and login
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP are required",
      });
    }

    const vendor = await Vendor.findOne({
      phone,
      tempOTP: otp,
      otpExpiry: { $gt: new Date() },
    }).select("+tempOTP +otpExpiry");

    if (!vendor) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Check if vendor is active
    if (vendor.status !== "active") {
      const statusMessage = vendor.status === "suspended" 
        ? "Your vendor account has been suspended. Please contact Nexo admin to restore access."
        : vendor.status === "inactive"
        ? "Your vendor account is inactive. Please contact Nexo admin to activate your account."
        : "Your vendor account is not active. Please contact Nexo admin.";
      
      return res.status(403).json({
        success: false,
        message: statusMessage,
        status: vendor.status
      });
    }

    // Clear OTP
    vendor.tempOTP = undefined;
    vendor.otpExpiry = undefined;
    vendor.lastLogin = new Date();
    await vendor.save();

    // Generate token
    const token = jwt.sign({ vendorId: vendor._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      success: true,
      message: "Login successful",
      vendor: {
        token,
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        companyName: vendor.companyName,
        status: vendor.status,
      },
    });
  } catch (error) {
    console.error("Vendor OTP Verification Error:", error);
    res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};

// Login with password
exports.loginWithPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Vendor login attempt:", { email, hasPassword: !!password });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find vendor with password field included
    const vendor = await Vendor.findOne({ email: normalizedEmail }).select("+password");

    if (!vendor) {
      console.log("Vendor not found for email:", normalizedEmail);
      // Check if vendor exists with different case
      const anyVendor = await Vendor.findOne({ 
        $or: [
          { email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } }
        ]
      });
      
      if (anyVendor) {
        console.log("Vendor found with different email case:", anyVendor.email);
      }
      
      return res.status(401).json({
        success: false,
        message: "No vendor account found with this email. Please contact admin to create your account.",
      });
    }

    console.log("Vendor found:", { 
      id: vendor._id, 
      email: vendor.email, 
      status: vendor.status, 
      hasPassword: !!vendor.password,
      passwordLength: vendor.password?.length 
    });

    // Check if vendor has a password set
    if (!vendor.password) {
      console.log("Vendor has no password set");
      return res.status(401).json({
        success: false,
        message: "Password not set. Please contact admin to set your password or use OTP login.",
      });
    }

    // Check if vendor account is active (before password check)
    if (vendor.status !== "active") {
      const statusMessage = vendor.status === "suspended" 
        ? "Your vendor account has been suspended. Please contact Nexo admin to restore access."
        : vendor.status === "inactive"
        ? "Your vendor account is inactive. Please contact Nexo admin to activate your account."
        : "Your vendor account is not active. Please contact Nexo admin.";
      
      return res.status(403).json({
        success: false,
        message: statusMessage,
        status: vendor.status
      });
    }

    // Compare password
    const isMatch = await vendor.comparePassword(password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Password mismatch for vendor:", vendor._id);
      return res.status(401).json({
        success: false,
        message: "Invalid password. Please check your password or contact admin to reset it.",
      });
    }

    // Update last login
    vendor.lastLogin = new Date();
    await vendor.save();

    // Generate token
    const token = jwt.sign({ vendorId: vendor._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    console.log("Vendor login successful:", vendor._id);

    res.json({
      success: true,
      message: "Login successful",
      vendor: {
        token,
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        companyName: vendor.companyName,
        status: vendor.status,
      },
    });
  } catch (error) {
    console.error("Vendor Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update FCM token
exports.updateFCMToken = async (req, res) => {
  try {
    const { token } = req.body;
    const vendorId = req.vendor._id;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    vendor.fcmtoken = token;
    await vendor.save();

    return res.status(200).json({ success: true, message: "FCM token updated successfully" });
  } catch (error) {
    console.error("Error updating FCM token:", error);
    return res.status(500).json({ success: false, message: "Failed to update token" });
  }
};

// Get vendor profile
exports.getProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id).select("-password -tempOTP -otpExpiry");
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.json({
      success: true,
      vendor,
    });
  } catch (error) {
    console.error("Get Vendor Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

