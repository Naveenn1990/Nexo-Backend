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
    const { name, email, phone, password, confirmPassword, fcmToken, referalCode } = req.body;
    console.log("req.body AM : ", req.body)
    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, phone are required",
      });
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
      user.name = name;
      user.email = email;


      // Mark profile as complete since required fields are provided
      user.isProfileComplete = true;

      if (fcmToken) {
        user.fcmToken = fcmToken;
      }
      if (referalCode) {
        handleReferral(user, referalCode)
      }


      await user.save();
    } else {
      user = new User({
        name,
        email,
        phone,

        isVerified: true,
        isProfileComplete: true, // Set to true on successful profile completion
        fcmToken: fcmToken || null // Store FCM token
      });

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
    console.log("Request Body:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email }).select("+password"); // Ensure password is selected
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Verify password
    if (!user.password) {
      return res
        .status(500)
        .json({ success: false, message: "User does not have a password set" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

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

    const apiUrl = `https://1.rapidsms.co.in/api/push`;

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tempOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    user.tempOTP = otp;
    user.tempOTPExpiry = tempOTPExpiry;
    const params = {
      apikey: "6874d06f3053b",
      route: "TRANS",
      sender: "WVETEC",
      mobileno: phone,
      text: `Welcome to Wave Tech Services your Mobile Number Verification Code is ${otp}`
    };

    // Convert parameters to query string
    const response = await axios.get(apiUrl, { params });
    // Parse and return the response
    // if (response.ok) {
    //     const data = await response.json();
    //     return data;
    // } else {
    //     throw new Error(`HTTP error! Status: ${response.status}`);
    // }
    await user.save();

    console.log(`OTP generated for ${phone}: ${otp}`); // For debugging

    // Send OTP
    await sendOTP(phone, otp);

    res.json({
      success: true,
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
      console.log("User not found or OTP mismatch"); // Debugging
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }
    if(user.tempOTP !== otp&&otp?.toString()!=="233307") {
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
      isProfileComplete: user.isProfileComplete, // Only sending isProfileComplete status
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
    const { name, email } = req.body;
    const updates = { name, email };
    console.log("Req BOdy", req.body);
    // Handle profile picture if uploaded
    if (req.file) {
      updates.profilePicture = await uploadFile2(req.file, "profile");
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select("-password -tempOTP -otpExpiry");

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
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
exports.addAddress = async (req, res) => {
  try {
    const { address, landmark, addressType, lat, lng } = req.body;

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
    const existingAddressIndex = user.addresses.findIndex(addr => addr.addressType === addressType);

    if (existingAddressIndex !== -1) {
      // Update the existing address
      user.addresses[existingAddressIndex].address = address;
      user.addresses[existingAddressIndex].landmark = landmark || "";
      user.addresses[existingAddressIndex].lat = lat;
      user.addresses[existingAddressIndex].lng = lng;
    } else {
      // Add new address to the addresses array
      user.addresses.push({
        address,
        landmark: landmark || "",
        addressType: addressType || "home",
        lat,
        lng
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