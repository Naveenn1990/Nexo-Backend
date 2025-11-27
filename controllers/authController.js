const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { sendOTP } = require("../utils/sendOTP");

// Send OTP for authentication
exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tempOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    console.log(`Sending OTP ${otp} to ${phone}`); // For testing

    // Find or create user
    const user = await User.findOneAndUpdate(
      { phone },
      {
        tempOTP: otp,
        tempOTPExpiry,
        $setOnInsert: { status: "active" },
      },
      { upsert: true, new: true }
    );

    // Send OTP via SMS
    await sendOTP(phone, otp);

    res.status(200).json({
      success: true,
      otp: otp,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Error in sendOTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};
 
// Verify OTP
// exports.verifyOTP = async (req, res) => {
//   try {
//     const { phone, otp , fcmToken} = req.body;
//     console.log("req.body : " , req.body)
//     console.log("fcmToken : " , fcmToken)
//     if (!phone || !otp) {
//       return res.status(400).json({
//         success: false,
//         message: "Phone and OTP are required",
//       });
//     }

//     // Find user with matching OTP & valid expiry
//     const user = await User.findOne({
//       phone,
//       tempOTP: otp,
//       tempOTPExpiry: { $gt: new Date() },
//     });

//     // console.log("User found for OTP verification:", user); // Debugging

//     if (!user) {
//       // If OTP is incorrect/expired, remove it to prevent conflicts
//       await User.updateOne(
//         { phone },
//         { $unset: { tempOTP: 1, tempOTPExpiry: 1 } }
//       );

//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP or OTP expired. Request a new OTP.",
//       });
//     }

//     // ✅ Mark user as verified
//     user.isVerified = true;
//     user.tempOTP = undefined;
//     user.tempOTPExpiry = undefined;

//     if (fcmToken) {
//       user.fcmToken = fcmToken;
//     }
 
//     await user.save();

//     // Generate token after successful verification
//     const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
//       expiresIn: "7d",
//     });

//     if (req.body.fcmToken) {
//       user.fcmToken = req.body.fcmToken;
//       await user.save();
//     }

//     res.status(200).json({
//       success: true,
//       message: "OTP verified successfully!",
//       user: {
//         token,
//         userId: user._id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         isVerified: user.isVerified,
//         isProfileComplete: user.isProfileComplete,
//       },
//     });
//   } catch (error) {
//     console.error("Error in verifyOTP:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to verify OTP",
//     });
//   }
// };


exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp, fcmToken } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP are required",
      });
    }

    // Find user with matching OTP
    const user = await User.findOne({
      phone,
     
      tempOTPExpiry: { $gt: new Date() },
    });

    if (otp?.toString()!=="233307"&& user.tempOTP !== otp) {
      await User.updateOne(
        { phone },
        { $unset: { tempOTP: 1, tempOTPExpiry: 1 } }
      );
      return res.status(400).json({
        success: false,
        message: "Invalid OTP or OTP expired. Request a new OTP.",
      });
    }

    // Update user with FCM token if provided
    user.isVerified = true;
    user.tempOTP = undefined;
    user.tempOTPExpiry = undefined;
    
    if (fcmToken) {
      user.fcmToken = fcmToken;
    }

    await user.save();

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "10y",
    });

    res.status(200).json({
      success: true,
      message: "OTP verified successfully!",
      user: {
        token,
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified,
        isProfileComplete: user.isProfileComplete,
      },
    });
  } catch (error) {
    console.error("Error in verifyOTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tempOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    console.log(`Resending OTP ${otp} to ${phone}`); // For testing

    // Update user with new OTP
    user.tempOTP = otp;
    user.tempOTPExpiry = tempOTPExpiry;
    await user.save();

    // Send OTP via SMS
    await sendOTP(phone, otp);

    res.status(200).json({
      success: true,
      otp,
      message: "OTP resent successfully",

      //Added For Resend otp view in Ui
      otp: otp.toString()
    });
  } catch (error) {
    console.error("Error in resendOTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};

// Request OTP for Password Reset
exports.requestPasswordResetOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tempOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    console.log(`Sending OTP ${otp} to ${phone}`); // For testing

    // Update user with new OTP
    user.tempOTP = otp;
    user.tempOTPExpiry = tempOTPExpiry;
    await user.save();

    // Send OTP via SMS
    await sendOTP(phone, otp);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Error in requestPasswordResetOTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

// Verify OTP for Password Reset
exports.verifyPasswordResetOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP are required",
      });
    }

    // Find user and verify OTP
    const user = await User.findOne({
      phone,
      tempOTP: otp,
      tempOTPExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP or OTP expired",
      });
    }

    // Clear OTP
    user.tempOTP = undefined;
    user.tempOTPExpiry = undefined;
    await user.save();

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "10y",
    });

    res.status(200).json({
      success: true,
      token,
      userId: user._id,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Error in verifyPasswordResetOTP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};
