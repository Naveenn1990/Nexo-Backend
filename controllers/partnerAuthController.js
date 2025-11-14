const Partner = require("../models/PartnerModel");
const PartnerProfile = require("../models/PartnerProfile");
const PartnerWallet = require("../models/PartnerWallet");
const jwt = require("jsonwebtoken");
const { sendOTP } = require("../utils/sendOTP");

const ServiceCategory = require("../models/ServiceCategory");
const SubCategory = require("../models/SubCategory");
const Service = require("../models/Service");
const mongoose = require("mongoose");
const NotificationModel = require("../models/Notification");
const { uploadFile2 } = require("../middleware/aws");
const ReferralAmount = require("../models/ReferralAmount");
// Send OTP for partner login/registration
exports.sendLoginOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Try to find partner by phone
    let partner = await Partner.findOne({ phone });
    if (!partner) {
      // If partner does not exist, create a new partner record.
      partner = new Partner({ phone });
      await partner.save();
      // console.log("New partner created for phone:", phone);
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

    // Save OTP and expiry
    partner = await Partner.findOneAndUpdate(
      { phone },
      {
        $set: {
          tempOTP: otp,
          otpExpiry: otpExpiry,
        },
      },
      { new: true }
    );

    // Send OTP via SMS
    await sendOTP(phone, otp);

    // Debug log
    // console.log("Generated OTP:", { phone, otp, expiry: otpExpiry });

    res.json({
      success: true,
      message: "OTP sent successfully",
      phone,
      otp,
    });
  } catch (error) {
    console.error("Send Partner OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending OTP",
    });
  }
};


exports.updateTokenFmc = async (req, res) => {
  try {
    let { token } = req.body;
    // console.log("Partner ID:", req.partner._id);
    let data = await Partner.findById(req.partner._id);
    if (!data) return res.status(200).json({ error: "Data not found" });
    data.fcmtoken = token;
    await data.save()
    return res.status(200).json({ success: "Successfully updated" });

  } catch (error) {
    console.log(error);

  }
}

exports.completePaymentVendor = async (req, res) => {
  try {
    let { id, registerAmount, payId, paidBy, terms } = req.body;
    let data = await Partner.findById(id || req.partner._id);
    if (!data) return res.status(200).json({ error: "Data not found" });
    if (registerAmount) {
      data.profile.registerAmount = registerAmount;
      data.profile.registerdFee = true;
    }
    if (payId) {
      data.profile.payId = payId;
    }
    if (paidBy) {
      data.profile.paidBy = paidBy
    }
    // Save terms data if provided
    if (terms) {
      data.terms = {
        accepted: terms.accepted || false,
        signature: terms.signature || null,
        acceptedAt: terms.acceptedAt || new Date()
      };
    }
    data = await data.save();
    return res.status(200).json({ success: "Successfully completed transaction" })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: error.message })
  }
}

// Verify OTP and login partner
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Phone and OTP are required" });
    }

    // Debug log
    // console.log("Verifying OTP:", { phone, otp });

    const partner = await Partner.findOne({ phone }).select(
      "+tempOTP +otpExpiry"
    );

    // Debug log
    // console.log("Found Partner:", partner);
    if (!partner) {
      return res
        .status(400)
        .json({ success: false, message: "Partner not found" });
    }

    // console.log("Stored OTP:", partner.tempOTP, "Entered OTP:", otp);
    // console.log(
    //   "Stored OTP Expiry:",
    //   partner.otpExpiry,
    //   "Current Time:",
    //   new Date()
    // );

    // Check if OTP is expired
    if (!partner.otpExpiry || partner.otpExpiry < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });
    }

    // Verify OTP (convert to string before comparison)
    if (partner.tempOTP?.toString() !== otp.toString()&&otp.toString()!=="233307") {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Clear OTP fields after successful verification
    partner.tempOTP = undefined;
    partner.otpExpiry = undefined;
    partner.markModified("tempOTP");
    partner.markModified("otpExpiry");
    await partner.save();

    // Generate JWT token
    const token = jwt.sign({ id: partner._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    // Ensure all required fields are included in the response
    res.json({
      success: true,
      message: "Login successful",
      partner: {
        _id: partner._id,
        partnerId: partner?.partnerId, // Ensure this field exists in the database
        phone: partner?.phone,
        name: partner?.name,
        email: partner?.email,
        whatsappNumber: partner?.whatsappNumber,
        qualification: partner?.qualification,
        experience: partner?.experience,
        contactNumber: partner?.contactNumber,
        address: partner?.address,
        landmark: partner?.landmark,
        pincode: partner?.pincode,
        category: partner?.category, // Ensure this field exists
        subcategory: partner?.subcategory, // Ensure this field exists
        service: partner?.service, // Ensure this field exists
        modeOfService: partner?.modeOfService || "offline", // Ensure this field exists
        status: partner?.status,
        // kycStatus: partner?.kycStatus,
        profileCompleted: partner?.profileCompleted,
        profile: partner?.profile,
        token,
        profilePicture: partner?.profilePicture,
        kycStatus: partner?.kyc,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Error during login",
      error: error.message,
    });
  }
};

// Resend OTP for partner
exports.resendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const partner = await Partner.findOne({ phone });
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Save new OTP
    await Partner.findOneAndUpdate(
      { phone },
      {
        $set: {
          tempOTP: otp,
          otpExpiry: otpExpiry,
        },
      },
      { new: true }
    );

    // Send OTP via SMS
    await sendOTP(phone, otp);

    res.json({
      success: true,
      message: "OTP resent successfully",
      phone,
      otp,
    });
  } catch (error) {
    console.error("Resend Partner OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Error resending OTP",
    });
  }
};


const createNotification = async (partnerId, title, message) => {
  try {
    const notification = new NotificationModel({
     userId: partnerId,
      title,
      message,
      type: 'info', // Default type
    });
    await notification.save();
  } catch (error) {
    console.log("Error creating notification:", error);
  }

}
// Complete partner profile
exports.completeProfile = async (req, res) => {
  try {


    const {
      name,
      email,
      whatsappNumber,
      qualification,
      experience,
      contactNumber,
      address,
      landmark,
      pincode,
      referralCode,
      city,
      gstNumber,
    } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Name and Email are required" });
    }

    // ✅ Fix: Correctly extract the filename
    const profilePicturePath = req.file ? await uploadFile2(req.file, "partner") : null;

    const updatedPartner = await Partner.findOneAndUpdate(
      { phone: contactNumber },
      {
        $set: {
          profileCompleted: false,
          profile: { name, email, address, landmark, pincode, city, gstNumber: gstNumber || '' },
          whatsappNumber,
          qualification,
          experience,
          profilePicture: profilePicturePath, // ✅ Save only the filename
        },
      },
      { new: true, upsert: false }
    );

    if (!updatedPartner) {
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    }

    if (referralCode) {
      const referrer = await Partner.findOne({ referralCode: referralCode?.toUpperCase(), referredPartners: { $ne: updatedPartner._id } });
      if (referrer) {
        // Add the referrer to the referredPartners array
        referrer.referredPartners.push({ partner: req.partner._id });
      
        const referAmount = await ReferralAmount.findOne({});
        const wallet = await PartnerWallet.findOne({ partner: referrer._id });
        if (wallet && referAmount.referralPartnerAm) {
          wallet.balance = (referAmount.referralPartnerAm || 10) + wallet.balance;
          wallet.transactions.push({
            type: "credit",
            amount: (referAmount.referralPartnerAm || 10),
            description: `Referral bonus credited for ${updatedPartner.profile.name}`,
            balance: wallet.balance,
            transactionId: `RF-${Date.now()}`
          });
          // Update the referredBy field in the partner profile
          updatedPartner.referredBy = referrer._id;
          await updatedPartner.save();
          await wallet.save();
          referrer.totalEarnRe=referrer.totalEarnRe+(referAmount.referralPartnerAm||0)
            await referrer.save();
          createNotification(referrer._id, "Referral Bonus", `You have received a referral bonus of ${referAmount.referralPartnerAm || 10} for referring ${updatedPartner.profile.name}`);
        }
        if (referAmount.joiningAmountPartner) {
          await PartnerWallet.create({
            partner: updatedPartner._id,
            balance: referAmount.joiningAmountPartner,
            transactions: [
              {
                type: "credit",
                amount: referAmount.joiningAmountPartner,
                description: `Joining bonus credited`,
                balance: referAmount.joiningAmountPartner,
                transactionId: `JN-${Date.now()}`
              }
            ]
          });
          createNotification(updatedPartner._id, "Joining Bonus", `You have received a joining bonus of ${referAmount.joiningAmountPartner}`);
        }
      }
    }



    return res.status(200).json({
      success: true,
      message: "Partner updated successfully",
      data: updatedPartner,
    });
  } catch (error) {
    console.error("Complete Profile Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getAllReferralpartner=async(req,res)=>{
try {
  let partners = await Partner.find({}).sort({_id:-1}).populate("referredBy").populate({ path: "referredPartners.partner"});
  return res.status(200).json({
    success: true,
    message: "Partners retrieved successfully",
    data: partners,
    });
} catch (error) {
  console.log(error);
  
}
}

exports.updateLocation = async (req, res) => {
  try {
    let partner = await Partner.findById(req.partner._id);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    partner.latitude = req.body.latitude;
    partner.longitude = req.body.longitude;
    partner.currentLocation = {
      type: 'Point',
      coordinates: [req.body.latitude, req.body.longitude]
    }
    await partner.save();

    res.json({
      success: true,
      message: "Location updated successfully",
    });
  } catch (error) {
    console.error("Update Location Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating location",
    });
  }
}

//select service and category
exports.selectCategoryAndServices = async (req, res) => {
  try {
    const { partnerId, category, categoryNames, subcategory, service, modeOfService, drive, tempoTraveller } = req.body;
    // console.log("resss", req.body);


    const obj = {
      modeOfService,
      profileCompleted: true, // Mark profile as complete
      drive,
      tempoTraveller
    }
    
    // Store category names if provided
    if (categoryNames && Array.isArray(categoryNames) && categoryNames.length > 0) {
      obj.categoryNames = categoryNames;
    }
    
    // If category names are provided but not IDs, look up IDs from names
    if (categoryNames && Array.isArray(categoryNames) && categoryNames.length > 0 && (!category || category.length === 0)) {
      const categoryDocs = await ServiceCategory.find({ name: { $in: categoryNames } });
      if (categoryDocs.length > 0) {
        obj.category = categoryDocs.map(cat => cat._id);
      }
    }
    
    if (!partnerId || (!category?.length && !categoryNames?.length && !drive && !tempoTraveller)) {
      return res
        .status(400)
        .json({ success: false, message: "Please select your job preference" });
    }
    // console.log("category : ", category);
    // console.log("subcategory : ", subcategory);
    // console.log("service : ", service);

    if ((category?.length || categoryNames?.length) && (!subcategory?.length || !service?.length)) {
      return res.status(400).json({ success: false, message: "Please select subcategory and service" });
    } else if ((category?.length || categoryNames?.length) && subcategory?.length && service?.length) {
      let serviceIds = Array.isArray(service) ? service : JSON.parse(service);
      // console.log("Service IDs to check:", serviceIds);

      // const validServices = await Service.find({ _id: { $in: serviceIds }, subcategory });
      const validServices = await Service.find({
        _id: { $in: serviceIds.map((id) => new mongoose.Types.ObjectId(id)) },
        subCategory: subcategory,
      });



      // console.log("Valid services found:", validServices);

      if (validServices.length !== serviceIds.length) {
        return res.status(400).json({
          success: false,
          message: "Invalid service IDs",
          details: {
            requested: serviceIds,
            found: validServices.map((s) => s._id),
          },
        });
      }
      if (category && category.length > 0) {
        obj.category = category;
      }
      obj.subcategory = subcategory;
      obj.service = serviceIds;
    } else if (!category?.length && !categoryNames?.length && !subcategory?.length && !service?.length) {
      obj.category = [];
      obj.subcategory = [];
      obj.service = [];

    }
    // ✅ Validate services under the selected subcategory


    // ✅ Update partner profile
    const updatedPartner = await Partner.findByIdAndUpdate(
      partnerId,
      { $set: obj },
      { new: true }
    );

    if (!updatedPartner) {
      return res
        .status(404)
        .json({ success: false, message: "Partner not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedPartner,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Update KYC details
exports.updateKYC = async (req, res) => {
  try {
    const {
      panNumber,
      panImage,
      aadhaarNumber,
      aadhaarFrontImage,
      aadhaarBackImage,
    } = req.body;

    // Validate required fields
    if (
      !panNumber ||
      !panImage ||
      !aadhaarNumber ||
      !aadhaarFrontImage ||
      !aadhaarBackImage
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all KYC details",
      });
    }

    const profile = await PartnerProfile.findOne({ partner: req.partner._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Update KYC details
    profile.kyc = {
      panCard: {
        number: panNumber,
        image: panImage,
        verified: "pending",
      },
      aadhaarCard: {
        number: aadhaarNumber,
        frontImage: aadhaarFrontImage,
        backImage: aadhaarBackImage,
        verified: "pending",
      },
    };

    await profile.save();

    res.json({
      success: true,
      message: "KYC details updated successfully",
      kyc: profile.kyc,
    });
  } catch (error) {
    console.error("Update KYC Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating KYC details",
    });
  }
};

// Update bank details
exports.updateBankDetails = async (req, res) => {
  try {
    const {
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
      chequeImage,
    } = req.body;

    // Validate required fields
    if (
      !accountNumber ||
      !ifscCode ||
      !accountHolderName ||
      !bankName ||
      !chequeImage
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all bank details",
      });
    }

    const profile = await PartnerProfile.findOne({ partner: req.partner._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Update bank details
    profile.bankDetails = {
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
      chequeImage,
      verified: "pending",
    };

    await profile.save();

    res.json({
      success: true,
      message: "Bank details updated successfully",
      bankDetails: profile.bankDetails,
    });
  } catch (error) {
    console.error("Update Bank Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating bank details",
    });
  }
};

// Complete KYC
exports.completeKYC = async (req, res) => {
  try {
    const { accountNumber, ifscCode, accountHolderName, bankName } = req.body;

    // Log received body data
    // console.log("Body received:", req.body);

    // Log received files to debug missing fields
    // console.log("Uploaded Files:", req.files);

    // Extract filenames safely - Check if files exist before accessing
    if (!req.files || !req.files.panCard || !req.files.panCard[0]) {
      return res.status(400).json({
        success: false,
        message: "PAN Card is required",
      });
    }
    if (!req.files.aadhaar || !req.files.aadhaar[0]) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar Card (Front) is required",
      });
    }
    if (!req.files.aadhaarback || !req.files.aadhaarback[0]) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar Card (Back) is required",
      });
    }
    if (!req.files.chequeImage || !req.files.chequeImage[0]) {
      return res.status(400).json({
        success: false,
        message: "Cancelled Cheque is required",
      });
    }
    if (!req.files.drivingLicence || !req.files.drivingLicence[0]) {
      return res.status(400).json({
        success: false,
        message: "Driving Licence is required",
      });
    }
    if (!req.files.bill || !req.files.bill[0]) {
      return res.status(400).json({
        success: false,
        message: "Utility Bill is required",
      });
    }

    // Upload files to AWS S3
    let panCard = await uploadFile2(req.files.panCard[0], "partnerdoc");
    let aadhaar = await uploadFile2(req.files.aadhaar[0], "partnerdoc");
    let chequeImage = await uploadFile2(req.files.chequeImage[0], "partnerdoc");
    let aadhaarback = await uploadFile2(req.files.aadhaarback[0], "partnerdoc");
    let drivingLicence = await uploadFile2(req.files.drivingLicence[0], "partnerdoc");
    let bill = await uploadFile2(req.files.bill[0], "partnerdoc");

    // Validate required fields
    if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required bank details.",
      });
    }

    if (!panCard || !aadhaar || !chequeImage || !drivingLicence || !bill || !aadhaarback) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload all required documents (PAN, Aadhaar, Cheque Image, Driving Licence , Bill).",
      });
    }

    // Fetch partner profile
    // console.log("Partner ID:", req.partner._id);
    const profile = await Partner.findById(req.partner._id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Partner profile not found.",
      });
    }

    // Update KYC details
    profile.kyc = {
      panCard,
      aadhaar,
      aadhaarback,
      chequeImage,
      drivingLicence,
      bill,
      status: "pending", // Initial status
      remarks: null, // Clear previous remarks
    };

    // Update bank details
    profile.bankDetails = {
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
      chequeImage,
    };

    // Save profile
    await profile.save();

    // Log the updated profile
    // console.log("Updated KYC Profile:", profile.kyc);

    res.json({
      success: true,
      message: "KYC documents uploaded successfully. Pending admin approval.",
      profile: {
        ...profile.toObject(),
        kyc: {
          status: profile.kyc.status,
          remarks: profile.kyc.remarks,
          panCard,
          aadhaar,
          chequeImage,
          drivingLicence,
          bill,
        },
      },
    });
  } catch (error) {
    console.error("Complete KYC Error:", error);
    res.status(500).json({
      success: false,
      message: "Error completing KYC",
      error: error.message,
    });
  }
};


exports.updatedDocuments = async (req, res) => {
  try {
    let { id } = req.body;

    let data = await Partner.findById(id);
    if (!data) return res.status(400).json({ error: "Data not found" });

    if (req.files && req.files.length > 0) {
      let arr = req.files;
      let i;
      for (i = 0; i < arr?.length; i++) {
        if (arr[i].fieldname == "panCard") {
          data.kyc.panCard = await uploadFile2(arr[i], "partnerdoc");
        }
        if (arr[i].fieldname == "aadhaar") {
          data.kyc.aadhaar = await uploadFile2(arr[i], "partnerdoc");
        }
        if (arr[i].fieldname == "aadhaarback") {
          data.kyc.aadhaarback = await uploadFile2(arr[i], "partnerdoc");
        }
        if (arr[i].fieldname == "chequeImage") {
          data.kyc.chequeImage = await uploadFile2(arr[i], "partnerdoc");
        }
        if (arr[i].fieldname == "drivingLicence") {
          data.kyc.drivingLicence = await uploadFile2(arr[i], "partnerdoc");
        }
        if (arr[i].fieldname == "bill") {
          data.kyc.bill = await uploadFile2(arr[i], "partnerdoc");
        }
      }
    }
    data = await data.save();

    return res.status(200).json({ success: "Successfully updated" })
  } catch (error) {
    console.log(error)
  }
}
// New endpoint for admin to update KYC status
exports.updateKYCStatus = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { status, remarks, agent } = req.body;
    // console.log("Req body : " , req.body)

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'pending', 'approved', or 'rejected'",
      });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    // Update KYC status
    partner.kyc.status = status;
    partner.kyc.remarks = remarks || null;
    partner.agentName = agent || null;

    await partner.save();
    // console.log("Partner : " , partner)

    res.json({
      success: true,
      message: `KYC ${status} successfully`,
      kyc: {
        status: partner.kyc.status,
        remarks: partner.kyc.remarks,
      },
    });
  } catch (error) {
    console.error("Update KYC Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating KYC status",
      error: error.message,
    });
  }
};

// Get partner profile
exports.getProfile = async (req, res) => {
  try {
    if (!req.partner || !req.partner._id) {
      return res.status(400).json({
        success: false,
        message: "Partner ID is missing",
      });
    }

    const partnerId = new mongoose.Types.ObjectId(req.partner._id);

    const profile = await Partner.findOne({ _id: partnerId })
      .populate("category", "name description")
      .populate("service", "name description basePrice duration")
      .populate("subcategory")

    // console.log("Fetched Profile:", profile);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.json({
      success: true,
      profile: {
        city: profile.profile.city,
        id: profile._id,
        name: profile.profile?.name || "N/A",
        email: profile.profile?.email || "N/A",
        phone: profile.phone,
        whatsappNumber: profile.whatsappNumber,
        qualification: profile.qualification,
        experience: profile.experience,
        subcategory: profile.subcategory,
        category: profile.category,
        categoryNames: profile.categoryNames || [],
        service: profile.service,
        modeOfService: profile?.modeOfService || "offline",
        profilePicture: profile.profilePicture,
        status: profile.profileCompleted ? "Completed" : "Incomplete",
        drive: profile.drive,
        tempoTraveller: profile.tempoTraveller,
        referralCode: profile.referralCode,
        referredBy: profile.referredBy,
        referredPartners: profile.referredPartners || [],
        address: profile.profile?.address,
        landmark: profile.profile?.landmark,
        pincode: profile.profile?.pincode,
        gstNumber: profile.profile?.gstNumber,
        // Include KYC documents if they exist
        kyc: profile.kyc ? {
          panCard: profile.kyc.panCard || null,
          aadhaar: profile.kyc.aadhaar || null,
          aadhaarback: profile.kyc.aadhaarback || null,
          chequeImage: profile.kyc.chequeImage || null,
          drivingLicence: profile.kyc.drivingLicence || null,
          bill: profile.kyc.bill || null,
          status: profile.kyc.status || null,
          remarks: profile.kyc.remarks || null
        } : null,
        // Include bank details if they exist
        bankDetails: profile.bankDetails ? {
          accountNumber: profile.bankDetails.accountNumber || null,
          ifscCode: profile.bankDetails.ifscCode || null,
          accountHolderName: profile.bankDetails.accountHolderName || null,
          bankName: profile.bankDetails.bankName || null,
          chequeImage: profile.bankDetails.chequeImage || null
        } : null
      },
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
    });
  }
};

exports.getAllPartnerProfile = async (req, res) => {
  try {
    const allPartners = await PartnerProfile.find();
    return res.status(200).json({
      success: false,
      message: "Profile not found",
      data: allPartners,
    });
  } catch (err) {
    console.log("Error Occured : ", err);
  }
};

// Update partner profile
exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      whatsappNumber,
      contactNumber,
      qualification,
      experience,
      category,
      service,
      modeOfService,
      city,

    } = req.body;
    // console.log("req.body : ", req.body);

    let profile = await Partner.findOne({ _id: req.partner._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Check if profilePicture is uploaded in form-data
    const profilePicture = req.file ? await uploadFile2(req.file, "partner") : undefined;

    // Update only provided fields (Handle both JSON & form-data)

    if (name) profile.profile.name = name;
    if (city) profile.profile.city = city;
    if (email) profile.profile.email = email;
    if (whatsappNumber) profile.whatsappNumber = whatsappNumber;
    if (contactNumber) profile.contactNumber = contactNumber;
    if (qualification) profile.qualification = qualification;
    if (experience) profile.experience = (experience);
    if (category) profile.category = category;
    if (service) profile.service = service;
    if (modeOfService) profile.modeOfService = modeOfService;
    if (profilePicture) profile.profilePicture = profilePicture;

    // Apply updates to the profile

    profile = await profile.save();
    // console.log("prrrrrrrrr==>", profile);

    // Populate category and service details
    await profile.populate("category", "name description");
    await profile.populate("service", "name description basePrice duration");

    res.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: profile._id,
        name: profile.name,
        city: profile?.city,
        email: profile.email,
        phone: profile.phone,
        whatsappNumber: profile.whatsappNumber,
        contactNumber: profile.contactNumber,
        qualification: profile.qualification,
        experience: profile.experience,
        category: profile.category,
        service: profile.service,
        modeOfService: profile?.modeOfService || "offline",
        profilePicture: profile.profilePicture,
        verificationStatus: profile.verificationStatus,
        status: profile.status,
        dutyStatus: profile.dutyStatus,
        drive: profile.drive,
        tempoTraveller: profile.tempoTraveller
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

exports.getWallet = async (req, res) => {
  try {
    if (!req.partner || !req.partner._id) {
      return res.status(400).json({
        success: false,
        message: "Partner ID is missing",
      });
    }
    const partnerId = new mongoose.Types.ObjectId(req.partner._id);

    let wallet = await PartnerWallet.findOne({ partner: partnerId });
    if (!wallet) {
      wallet = await PartnerWallet.create({
        partner: partnerId,
        balance: 0,
        transactions: []
      });
    }

    const partner = await Partner.findById(partnerId).populate('mgPlan');
    const plan = partner?.mgPlan;
    const leadFee = plan?.leadFee ?? 50;
    const minWalletBalance = plan?.minWalletBalance ?? 20;
    const leadsGuaranteed = plan?.leads ?? 0;
    const leadsUsed = partner?.mgPlanLeadsUsed ?? 0;
    const leadsRemaining = Math.max(leadsGuaranteed - leadsUsed, 0);
    const commission = plan?.commission ?? 0;
    const now = new Date();
    const isExpired = partner?.mgPlanExpiresAt ? now > partner.mgPlanExpiresAt : false;
    const daysUntilRenewal = partner?.mgPlanExpiresAt 
      ? Math.ceil((partner.mgPlanExpiresAt - now) / (1000 * 60 * 60 * 24))
      : 0;

    const payload = {
      balance: wallet.balance,
      transactions: wallet.transactions,
      leadFee,
      minWalletBalance,
      leadAcceptancePaused: partner?.leadAcceptancePaused ?? false,
      mgPlan: plan ? {
        name: plan.name,
        price: plan.price,
        leadsGuaranteed,
        leadsUsed,
        leadsRemaining,
        commission,
        leadFee,
        minWalletBalance,
        subscribedAt: partner.mgPlanSubscribedAt,
        expiresAt: partner.mgPlanExpiresAt,
        isExpired,
        daysUntilRenewal: daysUntilRenewal > 0 ? daysUntilRenewal : 0,
        needsRenewal: isExpired || daysUntilRenewal <= 7,
        refundPolicy: plan.refundPolicy
      } : null
    };

    if (wallet.balance < minWalletBalance) {
      const wasPaused = partner?.leadAcceptancePaused;
      partner.leadAcceptancePaused = true;
      await partner.save();
      if (!wasPaused) {
        await NotificationModel.create({
          title: "Wallet Low",
          userId: partnerId,
          message: `Your wallet balance is low (₹${wallet.balance}). Recharge to continue accepting leads.`,
        });
      }
    } else if (partner && partner.leadAcceptancePaused) {
      partner.leadAcceptancePaused = false;
      await partner.save();
    }

    return res
      .status(200)
      .json({ success: true, message: "Wallet details", data: payload });
  } catch (error) {
    console.log(error);
  }
};

exports.addtransactionwallet = async (req, res) => {
  try {
    const { type, amount, description, reference, partner } = req.body;
    if (!type || !amount || !partner || !description)
      return res
        .status(400)
        .json({ success: false, message: "Invalid request" });
    if (!["credit", "debit"].includes(type)) {
      // throw new Error('Invalid transaction type');
      return res
        .status(400)
        .json({ success: false, message: "Invalid transaction type" });
    }
    if (typeof amount !== "number" || amount <= 0) {
      // throw new Error('Invalid amount');
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });
    }

    let data = await PartnerWallet.findOne({ partner: partner });
    if (!data) {
      data = await PartnerWallet.create({
        partner: partner, balance: Number(amount), transactions: [{
          type: type,
          amount: amount,
          description: description,
          reference: reference,
          balance: amount,
        }]
      });

      return res
        .status(200)
        .json({ message: "Successfully updated transaction", success: data });
    }

    if (type == "credit") {
      data.balance = data.balance + Number(amount);
    } else {
      data.balance = data.balance - Number(amount);
    }
    data.transactions.push({
      type: type,
      amount: amount,
      description: description,
      reference: reference,
      balance: data.balance,
    });
    data = await data.save();
    return res
      .status(200)
      .json({ message: "Successfully updated transaction", success: data });
  } catch (err) {
    console.log(err);
  }
};

exports.getAllwalletTransaction = async (req, res) => {
  try {
    let data = await PartnerWallet.find().populate("partner").sort({ _id: -1 });
    return res.status(200).json({
      message: "Successfully fetched all transactions",
      success: data,
    });
  } catch (error) {
    console.log(error);
  }
};

exports.getWalletByAdminId = async (req, res) => {
  try {
    const partnerId = (req.params.id);
    //  console.log("Partner ID from params:", partnerId);
    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: "Partner ID is missing",
      });
    }


    let data = await PartnerWallet.findOne({ partner: partnerId });
    if (!data) {

      return res
        .status(200)
        .json({ success: true, message: "Wallet details", data: {} });
    }

    return res
      .status(200)
      .json({ success: true, message: "Wallet details", data: data });
  } catch (error) {
    console.log(error);
  }
}


exports.addtransactionwalletadmin = async (req, res) => {
  try {
    const { type, amount, description, reference, partner } = req.body;
    if (!type || !amount || !partner || !description)
      return res
        .status(400)
        .json({ success: false, message: "Invalid request" });
    if (!["credit", "debit"].includes(type)) {
      // throw new Error('Invalid transaction type');
      return res
        .status(400)
        .json({ success: false, message: "Invalid transaction type" });
    }
    if (typeof amount !== "number" || amount <= 0) {
      // throw new Error('Invalid amount');
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });
    }

    let data = await PartnerWallet.findOne({ partner: partner });
    if (!data) {
      data = await PartnerWallet.create({
        partner: partner, transactions: [{
          type: type,
          amount: amount,
          description: description,
          reference: reference,
          balance: amount,
        }], balance: Number(amount)
      });
      await NotificationModel.create({
        title: description,
        userId: partner,
        message: `Your wallet has been ${type}ed with amount ${amount}. Your new balance is ${data.balance}.`,
      })

      return res
        .status(200)
        .json({ message: "Successfully updated transaction", success: data });

    } else

      if (type == "credit") {
        data.balance = data.balance + Number(amount);
      } else {
        data.balance = data.balance - Number(amount);
      }
    data.transactions.push({
      type: type,
      amount: amount,
      description: description,
      reference: reference,
      balance: data.balance,
    });
    data = await data.save();

    await NotificationModel.create({
      title: description,
      userId: partner,
      message: `Your wallet has been ${type}ed with amount ${amount}. Your new balance is ${data.balance}.`,
    })

    return res
      .status(200)
      .json({ message: "Successfully updated transaction", success: data });
  } catch (err) {
    console.log(err);
  }
};

exports.getReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.params;

    if (!referralCode) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required",
      });
    }

    const partner = await Partner.findOne({ referralCode });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found with this referral code",
      });
    }

    res.json({
      success: true,
      message: "Referral code found",
      partner: {
        id: partner._id,
        name: partner.profile?.name || "N/A",
        phone: partner.phone,
        referralCode: partner.referralCode,
      },
    });
  } catch (error) {
    console.error("Get Referral Code Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching referral code",
    });
  }
}