const jwt = require("jsonwebtoken");
const Vendor = require("../models/VendorModel");

exports.vendorAuth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Empty token provided",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    if (!decoded.vendorId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // Find vendor
    const vendor = await Vendor.findById(decoded.vendorId).select("-password -tempOTP -otpExpiry");

    if (!vendor) {
      return res.status(401).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Allow profile endpoint even if suspended/inactive (so frontend can check status)
    const isProfileEndpoint = req.originalUrl.includes('/auth/profile') || req.path.includes('/auth/profile');
    
    if (vendor.status !== "active" && !isProfileEndpoint) {
      return res.status(403).json({
        success: false,
        message: "Vendor account is not active",
        status: vendor.status
      });
    }

    // Attach vendor to request
    req.vendor = vendor;
    req.token = token;
    next();
  } catch (error) {
    console.error("Vendor Auth Middleware Error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

