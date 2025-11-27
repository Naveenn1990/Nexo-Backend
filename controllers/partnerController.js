const Partner = require("../models/PartnerModel");
const PartnerProfile = require("../models/PartnerProfile");
const jwt = require("jsonwebtoken");
const { sendOTP } = require("../utils/sendOTP");
const path = require("path");
const Booking = require("../models/booking");
const { uploadFile2 } = require("../middleware/aws");

const sendLoginOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated OTP:", otp); // Debug log

    // Find or create partner
    let partner = await Partner.findOne({ phone });
    if (!partner) {
      partner = new Partner({ phone });
    }

    // Save OTP
    partner.tempOTP = otp;
    await partner.save();

    // Log saved partner for debugging
    // console.log("Saved partner:", {
    //   phone: partner.phone,
    //   tempOTP: partner.tempOTP,
    // });

    // Send OTP (in development, we're just logging it)
    // await sendOTP(phone, otp);

    res.status(200).json({
      message: "OTP sent successfully",
      // Remove this in production!
      debug: {
        otp: otp,
      },
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    res.status(500).json({ message: "Error sending OTP" });
  }
};

const verifyOTP = async (req, res) => {
  // console.log("Verification attempt:", req.body);
  try {
    const { phone, otp } = req.body;

    // Log received data
    // console.log("Verification attempt:", { phone, otp });

    const partner = await Partner.findOne({ phone });

    // Log found partner
    // console.log("Found 54567654567898765 000partner:", partner);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    if (!partner.tempOTP) {
      return res
        .status(400)
        .json({ message: "No OTP found. Please request a new OTP." });
    }

    // Log OTP comparison
    // console.log("Comparing OTPs:", {
    //   stored: partner.tempOTP,
    //   received: otp,
    //   match: partner.tempOTP === otp,
    // });

    if (partner.tempOTP !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const token = jwt.sign(
      { partnerId: partner._id },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    // Clear OTP after successful verification
    partner.tempOTP = undefined;
    await partner.save();

    // Return complete partner data for frontend
    const partnerData = {
      _id: partner._id,
      token: token,
      phone: partner.phone,
      name: partner.profile?.name,
      email: partner.profile?.email,
      profileCompleted: partner.profileCompleted,
      partnerType: partner.partnerType || 'individual',
      profile: partner.profile,
      whatsappNumber: partner.whatsappNumber,
      qualification: partner.qualification,
      experience: partner.experience,
      profilePicture: partner.profilePicture,
      referralCode: partner.referralCode,
      status: partner.kycStatus || partner.status
    };

    res.status(200).json({
      success: true,
      token,
      partner: partnerData,
      isProfileCompleted: partner.profileCompleted,
      partnerId: partner._id,
      status: partner.kycStatus,
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ message: "Error verifying OTP" });
  }
};

const updateTokenFmc = async (req, res) => {
  try {
    console.log("Partner ID:", req.partner._id);
    let data = await Partner.findById(req.partner._id);
    if (!data) return res.status(200).json({ error: "Data not found" });
    return res.status(200).json({ success: "Successfully updated" });

  } catch (error) {
    console.log(error);

  }
}

// const completePaymentVendor=async(req,res)=>{
//   try {
//     let {registerAmount,payId}=req.body;
//     let data=await Partner.findById(req.partner._id);
//     if(!data) return res.status(200).json({error:"Data not found"});
//     data.registerAmount=registerAmount;
//     data.payId=payId;
//     registerdFee=true;
//   } catch (error) {
//     return res.status(500).json({error:error.message})
//   }
// }

const updateProfile = async (req, res) => {
  try {
    // console.log("Request body:", req.body);
    // console.log("Request file:", req.file);
    // console.log("Partner ID:", req.partner._id);

    const {
      name,
      email,
      whatsappNumber,
      highestQualification,
      experience,
      category,
      service,
      modeOfService,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !email ||
      !whatsappNumber ||
      !highestQualification ||
      !experience ||
      !category ||
      !service ||
      !modeOfService
    ) {
      // console.log("Missing fields:", {
      //   name,
      //   email,
      //   whatsappNumber,
      //   highestQualification,
      //   experience,
      //   category,
      //   service,
      //   modeOfService,
      // });
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate modeOfService
    if (!["online", "offline", "both"].includes(modeOfService)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid mode of service. Must be one of: online, offline, both",
      });
    }

    const partner = await Partner.findById(req.partner._id);
    // console.log("Found partner:", partner);

    // Update profile
    partner.profile = {
      ...partner.profile,
      name,
      email,
      whatsappNumber,
      highestQualification,
      experience,
      category,
      service,
      modeOfService,
    };

    // Handle profile picture if uploaded
    if (req.file) {
      partner.profile.profilePicture = await uploadFile2(req.file,"partner");
    }

    partner.profileCompleted = true;
    const savedPartner = await partner.save();
    // console.log("Saved partner:", savedPartner);

    res.json({
      success: true,
      message: "Profile updated successfully",
      partnerId: req.partner._id,
      profile: savedPartner.profile,
    });
  } catch (error) {
    console.error("Full error details:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      debug: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const updateDeviceToken = async (req, res) => {
  try {
    const { deviceToken } = req.body;
    const partner = await Partner.findById(req.partner._id);
    partner.deviceToken = deviceToken;
    await partner.save();
    res.json({ message: "Device token updated successfully" });
  } catch (error) {
    console.error("Update Device Token Error:", error);
    res.status(500).json({ message: "Error updating device token" });
  }
};

const updateLanguagePreference = async (req, res) => {
  try {
    const { language } = req.body;
    const partner = await Partner.findById(req.partner._id);
    partner.languagePreference = language;
    await partner.save();
    res.json({ message: "Language preference updated successfully" });
  } catch (error) {
    console.error("Update Language Error:", error);
    res.status(500).json({ message: "Error updating language preference" });
  }
};

const getDashboardStats = async (req, res) => {
  /* ... */
};
const uploadKYCDocuments = async (req, res) => {
  try {
    const { accountNumber, ifscCode, accountHolderName } = req.body;

    // Validate bank details
    if (!accountNumber || !ifscCode || !accountHolderName) {
      return res.status(400).json({
        success: false,
        message: "All bank details are required",
      });
    }

    // Validate file uploads
    if (
      !req.files ||
      !req.files?.panCard ||
      !req.files?.aadhaarCard ||
      !req.files?.cancelledCheque ||
      !req.files?.drivingLicence ||
      !req.files?.bill
    ) {
      return res.status(400).json({
        success: false,
        message: "All documents are required",
      });
    }

    const partner = await Partner.findById(req.partner._id);
   let panCard=  await uploadFile2(req.files.panCard[0],"partnerdoc");
   let aadhaarCard= await uploadFile2(req.files.aadhaarCard[0],"partnerdoc");
   let cancelledCheque=await uploadFile2(req.files.cancelledCheque[0],"partnerdoc");

   let drivingLicence= await uploadFile2(req.files.drivingLicence[0],"partnerdoc");
   let bill=await uploadFile2(req.files.bill[0],"partnerdoc");


    // Update KYC documents
    partner.kycDetails = {
      panCard: panCard,
      aadhaarCard: aadhaarCard,
      cancelledCheque: cancelledCheque,
      drivingLicence:drivingLicence,
      bill:bill,
      bankDetails: {
        accountNumber,
        ifscCode,
        accountHolderName,
      },
      submittedAt: new Date(),
    };

    partner.kycStatus = "under_review";
    await partner.save();

    res.json({
      success: true,
      message: "KYC documents uploaded successfully",
      partnerId: req.partner._id,
      kycStatus: partner.kycStatus,
    });
  } catch (error) {
    console.error("Upload KYC Error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading KYC documents",
    });
  }
};
const getKYCStatus = async (req, res) => {
  /* ... */
};

const completeBooking = async (req, res) => {
  const bookingId = req.params.id;


  try {
    // Update the booking status to completed
       const imageUploadPromises = req.files.map(async (file) => {
          return await uploadFile2(file, "jobstart");
      });
      
      // Wait for all uploads to complete
      const imagePaths = await Promise.all(imageUploadPromises);
      
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { status: "completed", photos: imagePaths },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({ message: "Booking marked as completed", booking });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error marking booking as completed", error });
  }
};

// Get all partner KYC details
const getAllPartnerKYC = async (req, res) => {
  try {
    const partners = await Partner.find({ "kycDetails.isVerified": false }) // Fetch only unverified partners
      .select("name email phone kycDetails") // Select the fields you want
      .lean(); // Convert to plain JS objects for better performance

    return res.status(200).json({
      success: true,
      count: partners.length,
      data: partners.map((partner) => ({
        id: partner._id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        kycDetails: {
          isVerified: partner.kycDetails.isVerified,
          panImage: partner.kycDetails.panImage || "No PAN image available",
          aadharImage:
            partner.kycDetails.aadharImage || "No Aadhar image available",
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching partner KYC details:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching partner KYC details",
      error: error.message,
    });
  }
};
// Single export statement at the end
module.exports = {
  sendLoginOTP,
  verifyOTP,
  updateProfile,
  updateDeviceToken,
  updateLanguagePreference,
  getDashboardStats,
  uploadKYCDocuments,
  getKYCStatus,
  completeBooking,
  getAllPartnerKYC,
  updateTokenFmc,

};
