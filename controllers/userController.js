const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { sendOTP } = require("../utils/sendOTP");
const Wallet = require("../models/Wallet");
const path = require("path");
const Booking = require("../models/booking");
const SubService = require("../models/SubService");
const { uploadFile2 } = require("../middleware/aws");

const { default: axios } = require("axios");
const { v4: uuidv4 } = require("uuid");
const ReferralAmount = require("../models/ReferralAmount");
const admin = require('firebase-admin');
const sendreferral = async (user, title, message, type) => {
  try {
    // User notification
    const userNotification = {
      title: title,
      message: message,
      userId: user._id,
      type: type,
      read: false,
      skipFcm: true, // Prevent post-save hook from sending FCM
    };

    // Save user notification to Notification collection
    // const userDoc = new Notification(userNotification);
    // await userDoc.save();

    // Send FCM to user if token exists
    if (user.fcmToken) {
      const userMessage = {
        notification: {
          title: userNotification.title,
          body: userNotification.message.length > 100
            ? userNotification.message.slice(0, 97) + '...'
            : userNotification.message,
        },
        data: {
          type: 'new-notification', // Align with FirebaseProvider
          userId: user._id.toString(),

          title: userNotification.title,
          message: userNotification.message.length > 100
            ? userNotification.message.slice(0, 97) + '...'
            : userNotification.message,
          timestamp: new Date().toISOString(),
        },
        token: user.fcmToken,
        android: {
          priority: 'high',
          ttl: 60 * 60 * 24,
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
            },
          },
          headers: {
            'apns-priority': '5',
          },
        },
      };

      // Validate payload size
      const userPayloadString = JSON.stringify(userMessage);
      const userPayloadSize = Buffer.byteLength(userPayloadString, 'utf8');
      if (userPayloadSize > 4096) {
        console.error(`User FCM payload too large: ${userPayloadSize} bytes`);
        userMessage.notification.body = userMessage.notification.body.slice(0, 50) + '...';
        userMessage.data.message = userMessage.data.message.slice(0, 50) + '...';
        const fallbackSize = Buffer.byteLength(JSON.stringify(userMessage), 'utf8');
        if (fallbackSize > 4096) {
          console.error(`User fallback payload still too large: ${fallbackSize} bytes`);
          throw new Error('User FCM payload exceeds size limit');
        }
      }

      console.log(`Sending FCM to user: ${user._id}`);
      await admin.messaging().send(userMessage);
      console.log(`FCM sent to user: ${user._id}`);
    } else {
      console.log(`No FCM token for user: ${user._id}`);
    }

    return true;
  } catch (error) {
    console.error('Booking acceptance notification error:', error);
    return { success: false, error: error.message };
  }
};
async function handleReferral(user, referralCode) {
  if (!referralCode) return;

  const referringUser = await User.findOne({ referalCode: referralCode.toUpperCase() });
  if (!referringUser) return;
  const referAmount = await ReferralAmount.findOne({});
  const alreadyReferred = referringUser.referredUsers.some(u => u._id.equals(user._id));
  if (!alreadyReferred && referAmount) {
    referringUser.referredUsers.push({
      _id: user._id,
      name: user.name,
      mobile: user.phone
    });

    let wallet = await Wallet.findOne({ userId: referringUser?._id });
    if (wallet&&referAmount.referralUserAm>0) {
      wallet.balance += referAmount.referralUserAm;
      wallet.transactions.push({
        type: "Credit",
        transactionId: `RE0` + uuidv4(),
        amount: referAmount.referralUserAm,
        description: `Referral bonus for ${user.name} amout of ${referAmount.referralUserAm}`,
      })
      sendreferral(referringUser, "Referral bonus", `You get the money for ${user.name} referral`, "new_notification");
      await wallet.save();
    }
    if (referAmount.joiningAmountUser > 0) {
      await Wallet.create({
        userId: user._id,
        balance: referAmount.joiningAmountUser,
        transactions: [
          {
            type: "Credit",
            transactionId: `JOI0` + uuidv4(),
            amount: referAmount.joiningAmountUser,
            description: `Joining bonus for ${referringUser.name} amout of ${referAmount.joiningAmountUser}`,

          }
        ]
      })
    }

    await referringUser.save();
  }

  user.referredBy = referringUser._id;
  await user.save();
}

// Register new user
exports.register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      password, 
      confirmPassword, 
      fcmToken, 
      referalCode,
      userType,
      companyDetails
    } = req.body;
    console.log("req.body AM : ", req.body)
    
    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone are required",
      });
    }

    // Additional validation for company users
    if (userType === 'company') {
      if (!companyDetails || !companyDetails.companyName || !companyDetails.contactPerson) {
        return res.status(400).json({
          success: false,
          message: "Company name and contact person are required for company registration",
        });
      }
    }

    // Find the user by phone number
    let user = await User.findOne({ phone });

    // If user exists but is not verified, prevent registration
    if (user && !user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone number is not verified",
      });
    }

    if (user) {
      console.log("=== UPDATING EXISTING USER ===");
      console.log("Before update - user password:", user.password);
      console.log("New password from request:", password);
      
      user.name = name;
      user.email = email;
      user.userType = userType || 'home';
      
      // Update password if provided
      if (password) {
        user.password = password;
        console.log("Password updated to:", password);
      }
      
      // Update company details if user type is company
      if (userType === 'company' && companyDetails) {
        user.companyDetails = {
          companyName: companyDetails.companyName,
          companySize: companyDetails.companySize,
          industry: companyDetails.industry,
          gstNumber: companyDetails.gstNumber,
          contactPerson: companyDetails.contactPerson,
          designation: companyDetails.designation
        };
      }

      // Mark profile as complete since required fields are provided
      user.isProfileComplete = true;

      if (fcmToken) {
        user.fcmToken = fcmToken;
      }
      if (referalCode) {
        handleReferral(user, referalCode)
      }

      console.log("Before save - user password:", user.password);
      await user.save();
      console.log("After save - user password:", user.password);
    } else {
      const userData = {
        name,
        email,
        phone,
        password,
        userType: userType || 'home',
        isVerified: true,
        isProfileComplete: true, // Set to true on successful profile completion
        fcmToken: fcmToken || null // Store FCM token
      };

      // Add company details if user type is company
      if (userType === 'company' && companyDetails) {
        userData.companyDetails = {
          companyName: companyDetails.companyName,
          companySize: companyDetails.companySize,
          industry: companyDetails.industry,
          gstNumber: companyDetails.gstNumber,
          contactPerson: companyDetails.contactPerson,
          designation: companyDetails.designation
        };
      }

      user = new User(userData);
      await user.save();
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "10y",
    });

    res.status(200).json({
      success: true,
      message: "Registration successful",
      user: {
        userId: user._id,
        token,
        name: user.name,
        email: user.email,
        phone: user.phone,
        userType: user.userType,
        isVerified: user.isVerified,
        isProfileComplete: user.isProfileComplete,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error during registration",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.updateFcmToken = async (req, res) => {
  try {
    let { id, fcmToken } = req.body;
    let data = await User.findById(id);
    if (!data) return res.status(400).json({ error: "User Data not found" });
    if (fcmToken) {
      data.fcmToken = fcmToken
    }
    await data.save();
    return res.status(200).json({ success: "Successfully updated" })
  } catch (error) {
    console.log(error);

  }
}

exports.deleteUser = async (req, res) => {
  try {
    let id = req.user._id;
    let data = await User.deleteOne({ _id: id });
    return res.status(200).json({ success: "Suuccessfully deleted" })
  } catch (error) {
    console.log(error);

  }
}

// Login with password
exports.loginWithPassword = async (req, res) => {
  try {
    console.log("=== LOGIN DEBUG ===");
    console.log("Request Body:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("Missing email or password");
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    console.log("Looking for user with email:", email);
    // Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      console.log("User not found with email:", email);
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    console.log("User found:", {
      id: user._id,
      email: user.email,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0,
      passwordValue: user.password
    });

    // Verify password
    if (!user.password) {
      console.log("User has no password set");
      return res
        .status(500)
        .json({ success: false, message: "User does not have a password set" });
    }

    console.log("Comparing password...");
    console.log("Input password:", password);
    console.log("Stored password/hash:", user.password);
    
    // Check if password is already hashed
    const isHashed = user.password.startsWith('$2');
    console.log("Is password hashed?", isHashed);
    
    let isMatch;
    if (isHashed) {
      // Use bcrypt comparison for hashed password
      isMatch = await user.comparePassword(password);
      console.log("Bcrypt comparison result:", isMatch);
    } else {
      // Direct comparison for plain text (shouldn't happen but let's check)
      isMatch = user.password === password;
      console.log("Plain text comparison result:", isMatch);
    }
    
    if (!isMatch) {
      console.log("Password comparison failed");
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    console.log("Login successful!");
    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "10y",
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        token,
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified,
        profilePicture: user.profilePicture || "",
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message, // Send actual error message
    });
  }
};

// Send OTP for login
exports.sendLoginOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this phone number",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tempOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    user.tempOTP = otp;
    user.tempOTPExpiry = tempOTPExpiry;
    
    await user.save();

    console.log(`OTP generated for ${phone}: ${otp}`); // For debugging

    // Skip SMS sending for testing - just return OTP in response
    res.json({
      success: true,
      otp: otp, // Return OTP in response for testing
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

// Verify OTP and login
// Verify OTP and login
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    console.log(`Verifying OTP for ${phone}: ${otp}`); // Debugging

    const user = await User.findOne({
      phone,
      tempOTPExpiry: { $gt: new Date() },
    }).select("+name +email +isVerified +isProfileComplete"); // Explicitly selecting fields

    if (!user) {
      console.log("User not found or OTP expired"); // Debugging
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    console.log(`Stored OTP: ${user.tempOTP}, Provided OTP: ${otp}, Type: ${typeof user.tempOTP} vs ${typeof otp}`);

    // Master OTP bypass for testing
    if (otp?.toString() === "233307") {
      console.log("Master OTP used - bypassing verification");
    } else if (user.tempOTP?.toString() !== otp?.toString()) {
      console.log("OTP mismatch for user:", user._id);
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Clear OTP
    user.tempOTP = undefined;
    user.tempOTPExpiry = undefined;

    // Update verification status if not already verified
    if (!user.isVerified) {
      user.isVerified = true;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();
    console.log("User verified and logged in:", user);

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "10y",
    });

    res.json({
      success: true,
      token: token,
      isProfileComplete: user.isProfileComplete,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};


// Send OTP for forgot password
exports.sendForgotPasswordOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this phone number",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tempOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    user.tempOTP = otp;
    user.tempOTPExpiry = tempOTPExpiry;
    await user.save();

    console.log(`Forgot password OTP generated for ${phone}: ${otp}`); // For debugging

    // Send OTP
    await sendOTP(phone, otp);

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Send Forgot Password OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

// Reset password with OTP verification
exports.resetPassword = async (req, res) => {
  try {
    const { phone, otp, newPassword, confirmPassword } = req.body;

    if (!phone || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const user = await User.findOne({ phone }).select(
      "+tempOTP +tempOTPExpiry"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify OTP
    if (!user.tempOTP || user.tempOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Check OTP expiry
    if (!user.tempOTPExpiry || user.tempOTPExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    // Update password
    user.password = newPassword;
    user.tempOTP = undefined;
    user.tempOTPExpiry = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

// Get user profile
exports.getProfile = async (req, res, next) => {
  try {
    console.log("Getting profile for user:", req.user._id);

    if (!req.user || !req.user._id) {
      throw new Error("User not authenticated");
    }

    const user = await User.findById(req.user._id)
      .select("-password -tempOTP -tempOTPExpiry")
      .lean();

    if (!user) {
      console.log("User : ", user)
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // console.log("Found user profile:", {
    //   id: user._id,
    //   name: user.name,
    //   email: user.email,
    //   phone: user.phone,
    // });

    res.json({
      success: true,
      user,
      // : {
      //   name: user.name,
      //   email: user.email,
      //   phone: user.phone,
      //   address: user.address,
      //   landmark: user.landmark,
      //   addressType: user.addressType,
      //   isVerified: user.isVerified,
      //   status: user.status,
      //   createdAt: user.createdAt,
      //   updatedAt: user.updatedAt,
      // },
    });
  } catch (error) {
    console.error("Get Profile Error:", {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id,
    });

    // Pass error to express error handler
    next(error);
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, userType, companyDetails } = req.body;
    const updates = { name, email };
    
    console.log("Req Body", req.body);
    
    // Handle user type update
    if (userType && ['home', 'pg', 'company'].includes(userType)) {
      updates.userType = userType;
    }
    
    // Handle company details if user type is company
    if (userType === 'company' && companyDetails) {
      try {
        // Parse companyDetails if it's a string (from FormData)
        const parsedCompanyDetails = typeof companyDetails === 'string' 
          ? JSON.parse(companyDetails) 
          : companyDetails;
        
        updates.companyDetails = {
          companyName: parsedCompanyDetails.companyName || '',
          companySize: parsedCompanyDetails.companySize || '',
          industry: parsedCompanyDetails.industry || '',
          gstNumber: parsedCompanyDetails.gstNumber || '',
          contactPerson: parsedCompanyDetails.contactPerson || '',
          designation: parsedCompanyDetails.designation || ''
        };
      } catch (parseError) {
        console.error('Error parsing company details:', parseError);
        return res.status(400).json({
          success: false,
          message: "Invalid company details format"
        });
      }
    } else if (userType !== 'company') {
      // Clear company details if user type is not company
      updates.companyDetails = {
        companyName: '',
        companySize: '',
        industry: '',
        gstNumber: '',
        contactPerson: '',
        designation: ''
      };
    }
    
    // Handle profile picture if uploaded
    if (req.file) {
      updates.profilePicture = await uploadFile2(req.file, "profile");
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select("-password -tempOTP -otpExpiry");

    console.log("Updated user:", user);

    res.json({
      success: true,
      user,
      message: "Profile updated successfully"
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "No password set. Please use OTP login or set a password first.",
      });
    }

    // Verify current password
    const bcrypt = require("bcryptjs");
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
    });
  }
};

// Add address
// exports.addAddress = async (req, res) => {
//   try {
//     const { address, landmark, addressType } = req.body;

//     if (!address) {
//       return res.status(400).json({
//         success: false,
//         message: "Address is required",
//       });
//     }

//     const user = await User.findById(req.user._id);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Update user's address fields
//     user.address = address;
//     user.landmark = landmark || "";
//     user.addressType = addressType || "home";

//     await user.save();

//     res.json({
//       success: true,
//       address: {
//         address: user.address,
//         landmark: user.landmark,
//         addressType: user.addressType,
//       },
//     });
//   } catch (error) {
//     console.error("Add Address Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error adding address",
//       details:
//         process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };

// Add address
// Get all addresses for authenticated user
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: user.addresses || []
    });
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
      error: error.message
    });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const { address, landmark, addressType, lat, lng, pincode } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Address is required",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if the address type already exists for the user
    const existingAddressIndex = addressType ? user.addresses.findIndex(addr => addr.addressType === addressType) : -1;

    if (existingAddressIndex !== -1) {
      // Update the existing address
      user.addresses[existingAddressIndex].address = address;
      user.addresses[existingAddressIndex].landmark = landmark || "";
      user.addresses[existingAddressIndex].lat = lat || "";
      user.addresses[existingAddressIndex].lng = lng || "";
      user.addresses[existingAddressIndex].pincode = pincode || "";
    } else {
      // Add new address to the addresses array
      user.addresses.push({
        address,
        landmark: landmark || "",
        addressType: addressType || "Other",
        lat: lat || "",
        lng: lng || "",
        pincode: pincode || ""
      });
    }

    await user.save();

    res.json({
      success: true,
      message: "Address added/updated successfully",
      addresses: user.addresses, // Return updated addresses array
    });
  } catch (error) {
    console.error("Add Address Error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding/updating address",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update address
exports.updateAddress = async (req, res) => {
  try {
    const { address, landmark, addressType } = req.body;
    const { addressId } = req.params; // Get address ID from params

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Find the address by ID
    const addressIndex = user.addresses.findIndex((addr) => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Update only provided fields
    if (address !== undefined) user.addresses[addressIndex].address = address;
    if (landmark !== undefined) user.addresses[addressIndex].landmark = landmark;
    if (addressType !== undefined) user.addresses[addressIndex].addressType = addressType;

    await user.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      addresses: user.addresses, // Return updated addresses array
    });
  } catch (error) {
    console.error("Update Address Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating address",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete address
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params; // Get address ID from params

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Filter out the address to be deleted
    const updatedAddresses = user.addresses.filter((addr) => addr._id.toString() !== addressId);

    if (updatedAddresses.length === user.addresses.length) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    user.addresses = updatedAddresses;
    await user.save();

    res.json({
      success: true,
      message: "Address deleted successfully",
      addresses: user.addresses, // Return updated addresses array
    });
  } catch (error) {
    console.error("Delete Address Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting address",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get user details by ID
exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId)
      .select("-password -tempOTP -tempOTPExpiry")
      .lean(); // Convert to plain JavaScript object

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Handle the case where old users might have address in the root level
    if (user.address && !user.addresses) {
      user.addresses = [
        {
          address: user.address,
          landmark: user.landmark,
          addressType: user.addressType || "home",
        },
      ];
      // Remove old fields
      delete user.address;
      delete user.landmark;
      delete user.addressType;
    }

    res.json({
      success: true,
      user: {
        // _id: user._id,
        userId: user._id, // Adding userId as requested
        name: user.name || "",
        email: user.email || "",
        phone: user.phone,
        isVerified: user.isVerified,
        // addresses: user.addresses || [],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Get User Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
    });
  }
};


exports.addliveselectedAdd = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.user._id });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const selectedAdd = req.body.selectedAdd;
    if (selectedAdd) {
      user.selectedAddress = selectedAdd
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: "Address added successfully",
    });
  } catch (error) {
    console.error("Add Address Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

// Get user's AMC subscriptions
exports.getAMCSubscriptions = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId)
      .select('amcSubscriptions amcSubscription name email phone')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Combine both amcSubscription (single) and amcSubscriptions (array)
    const subscriptions = [];
    
    // Add single AMC subscription if exists
    if (user.amcSubscription && user.amcSubscription.planId) {
      subscriptions.push({
        _id: user.amcSubscription.planId,
        planName: user.amcSubscription.planName,
        planPrice: user.amcSubscription.planPrice || 0,
        startDate: user.amcSubscription.startDate,
        endDate: user.amcSubscription.endDate,
        status: user.amcSubscription.isActive ? 'active' : 'expired',
        subscribedAt: user.amcSubscription.startDate,
        features: user.amcSubscription.features || [],
        serviceAddress: user.amcSubscription.serviceAddress || {},
        type: 'single'
      });
    }
    
    // Add multiple AMC subscriptions if exist
    if (user.amcSubscriptions && Array.isArray(user.amcSubscriptions)) {
      user.amcSubscriptions.forEach(subscription => {
        subscriptions.push({
          _id: subscription._id,
          planName: subscription.planName,
          planPrice: subscription.amount,
          startDate: subscription.subscribedAt,
          endDate: subscription.endDate || new Date(new Date(subscription.subscribedAt).getTime() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
          status: subscription.status || 'active',
          subscribedAt: subscription.subscribedAt,
          txnid: subscription.txnid,
          mihpayid: subscription.mihpayid,
          features: subscription.features || [],
          serviceAddress: subscription.serviceAddress || {},
          type: 'multiple'
        });
      });
    }

    // Sort by subscription date (newest first)
    subscriptions.sort((a, b) => new Date(b.subscribedAt) - new Date(a.subscribedAt));

    return res.status(200).json({
      success: true,
      message: "AMC subscriptions fetched successfully",
      data: {
        subscriptions: subscriptions,
        activeSubscription: subscriptions.find(sub => sub.status === 'active') || null,
        totalSubscriptions: subscriptions.length
      }
    });

  } catch (error) {
    console.error("Get AMC Subscriptions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch AMC subscriptions",
      error: error.message
    });
  }
};

// Get active AMC subscription
exports.getActiveAMCSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId)
      .select('amcSubscriptions amcSubscription')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    let activeSubscription = null;

    // Check single AMC subscription
    if (user.amcSubscription && user.amcSubscription.isActive) {
      activeSubscription = {
        _id: user.amcSubscription.planId,
        planName: user.amcSubscription.planName,
        planPrice: user.amcSubscription.planPrice || 0,
        startDate: user.amcSubscription.startDate,
        endDate: user.amcSubscription.endDate,
        status: 'active',
        features: user.amcSubscription.features || [],
        serviceAddress: user.amcSubscription.serviceAddress || {},
        type: 'single'
      };
    }

    // Check multiple AMC subscriptions for active ones
    if (!activeSubscription && user.amcSubscriptions && Array.isArray(user.amcSubscriptions)) {
      const activeAMC = user.amcSubscriptions.find(sub => sub.status === 'active');
      if (activeAMC) {
        activeSubscription = {
          _id: activeAMC._id,
          planName: activeAMC.planName,
          planPrice: activeAMC.amount,
          startDate: activeAMC.subscribedAt,
          endDate: activeAMC.endDate || new Date(new Date(activeAMC.subscribedAt).getTime() + 365 * 24 * 60 * 60 * 1000),
          status: activeAMC.status,
          features: activeAMC.features || [],
          serviceAddress: activeAMC.serviceAddress || {},
          type: 'multiple'
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: activeSubscription ? "Active AMC subscription found" : "No active AMC subscription",
      data: activeSubscription
    });

  } catch (error) {
    console.error("Get Active AMC Subscription Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active AMC subscription",
      error: error.message
    });
  }
};

// Cancel AMC subscription
exports.cancelAMCSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { subscriptionId } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    let subscriptionFound = false;

    // Check if it's a single AMC subscription
    if (user.amcSubscription && user.amcSubscription.planId && user.amcSubscription.planId.toString() === subscriptionId) {
      user.amcSubscription.isActive = false;
      user.amcSubscription.cancelledAt = new Date();
      user.amcSubscription.cancellationReason = reason || 'User requested cancellation';
      subscriptionFound = true;
    }

    // Check multiple AMC subscriptions
    if (!subscriptionFound && user.amcSubscriptions && Array.isArray(user.amcSubscriptions)) {
      const subscriptionIndex = user.amcSubscriptions.findIndex(sub => sub._id.toString() === subscriptionId);
      if (subscriptionIndex !== -1) {
        user.amcSubscriptions[subscriptionIndex].status = 'cancelled';
        user.amcSubscriptions[subscriptionIndex].cancelledAt = new Date();
        user.amcSubscriptions[subscriptionIndex].cancellationReason = reason || 'User requested cancellation';
        subscriptionFound = true;
      }
    }

    if (!subscriptionFound) {
      return res.status(404).json({
        success: false,
        message: "AMC subscription not found"
      });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "AMC subscription cancelled successfully"
    });

  } catch (error) {
    console.error("Cancel AMC Subscription Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel AMC subscription",
      error: error.message
    });
  }
};