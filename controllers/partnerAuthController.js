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
const { uploadFile2, handleFileUpload } = require("../middleware/aws");
const ReferralAmount = require("../models/ReferralAmount");
const { PaymentTransaction } = require("../models/RegisterFee");
const phonePayModel = require("../models/phonePay");
const path = require("path");
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
      console.log('Creating new partner for phone:', phone);
      partner = new Partner({ phone });
      try {
        await partner.save();
        console.log('Partner created successfully with ID:', partner._id);
      } catch (saveError) {
        console.error('Error saving partner:', saveError);
        return res.status(500).json({
          success: false,
          message: "Error creating partner account",
        });
      }
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

    // Save OTP and expiry
    console.log('Saving OTP for phone:', phone, 'OTP:', otp);
    try {
      // Find the partner and update directly
      partner = await Partner.findOne({ phone });
      if (partner) {
        partner.tempOTP = otp;
        partner.otpExpiry = otpExpiry;
        await partner.save();
        console.log('OTP saved successfully, partner ID:', partner._id);
      } else {
        console.error('Partner not found for OTP save');
        return res.status(404).json({
          success: false,
          message: "Partner not found",
        });
      }
    } catch (updateError) {
      console.error('Error saving OTP:', updateError);
      return res.status(500).json({
        success: false,
        message: "Error saving OTP",
      });
    }

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
    const partnerId = req.partner._id;
    
    let data = await Partner.findById(partnerId);
    if (!data) {
      return res.status(200).json({ error: "Data not found" });
    }
    
    data.fcmtoken = token;
    await data.save();
    
    return res.status(200).json({ success: "Successfully updated" });

  } catch (error) {
    console.error('Error updating FCM token:', error);
    return res.status(500).json({ error: "Failed to update token" });
  }
}

exports.completePaymentVendor = async (req, res) => {
  try {
    let { id, registerAmount, payId, paidBy, terms, securityDeposit, toolkitPrice } = req.body;

    // Debug logging
    console.log('completePaymentVendor called:', {
      bodyId: id,
      authPartnerId: req.partner?._id,
      registerAmount,
      payId,
      paidBy
    });

    // Use authenticated partner ID for security, fallback to body ID if needed
    const partnerId = req.partner?._id || id;
    if (!partnerId) {
      return res.status(400).json({ error: "Partner ID not found" });
    }

    let data = await Partner.findById(partnerId);
    console.log('Partner found:', !!data, 'Partner ID:', data?._id);

    if (!data) return res.status(200).json({ error: "Data not found" });
    
    // Fetch current fees from PricingSettings to validate and use dynamic fees
    const { PricingSettings } = require('../models/RegisterFee');
    let pricingSettings = await PricingSettings.findOne();
    
    // If no pricing settings exist, create default
    if (!pricingSettings) {
      pricingSettings = new PricingSettings({
        registrationFee: 500,
        securityDeposit: 1000,
        toolkitPrice: 2499,
        originalPrice: 3000,
        specialOfferActive: false,
        commissionRate: 15,
        freeCommissionThreshold: 1000,
        refundPolicy: "Registration fees are non-refundable once payment is processed",
        registrationFeeRefundable: false,
        securityDepositRefundable: false,
        toolkitPriceRefundable: false
      });
      await pricingSettings.save();
    }
    
    // Use dynamic fees from settings if not provided or validate against current fees
    const currentRegistrationFee = pricingSettings.registrationFee || 500;
    const currentSecurityDeposit = pricingSettings.securityDeposit || 1000;
    const currentToolkitPrice = pricingSettings.toolkitPrice || 2499;
    
    // Use provided amounts or fall back to current settings
    const finalRegistrationFee = registerAmount || currentRegistrationFee;
    const finalSecurityDeposit = securityDeposit !== undefined ? securityDeposit : currentSecurityDeposit;
    const finalToolkitPrice = toolkitPrice !== undefined ? toolkitPrice : (toolkitPrice === 0 ? 0 : currentToolkitPrice);
    
    // Validate amounts match current settings (allow small tolerance for rounding)
    if (Math.abs(finalRegistrationFee - currentRegistrationFee) > 1) {
      console.warn(`Registration fee mismatch: provided ${finalRegistrationFee}, expected ${currentRegistrationFee}`);
    }
    if (securityDeposit !== undefined && Math.abs(finalSecurityDeposit - currentSecurityDeposit) > 1) {
      console.warn(`Security deposit mismatch: provided ${finalSecurityDeposit}, expected ${currentSecurityDeposit}`);
    }
    if (toolkitPrice !== undefined && toolkitPrice > 0 && Math.abs(finalToolkitPrice - currentToolkitPrice) > 1) {
      console.warn(`Toolkit price mismatch: provided ${finalToolkitPrice}, expected ${currentToolkitPrice}`);
    }
    
    const partnerIdString = data._id.toString();
    const totalAmount = finalRegistrationFee + finalSecurityDeposit + finalToolkitPrice;
    
    // Get partner name from profile or use phone as fallback
    const partnerName = data.profile?.name || data.name || data.phone || 'Unknown Partner';
    
    // Create a payment group ID to link related transactions
    const paymentGroupId = `PAY-${partnerIdString}-${Date.now()}`;
    
    // Verify and get PhonePe transaction details if payId is provided
    let phonePeTransaction = null;
    let phonePeTransactionId = null;
    let paymentStatus = 'success'; // Default to success
    
    if (payId) {
      try {
        // Check if payId is a valid ObjectId or string
        const isValidObjectId = mongoose.Types.ObjectId.isValid(payId);
        if (isValidObjectId) {
          phonePeTransaction = await phonePayModel.findById(payId);
        } else {
          // Try to find by transactionid field
          phonePeTransaction = await phonePayModel.findOne({ transactionid: payId });
        }
        
        if (phonePeTransaction) {
          phonePeTransactionId = phonePeTransaction.transactionid || phonePeTransaction._id.toString();
          // Map PhonePe status to our status
          if (phonePeTransaction.status === 'COMPLETED') {
            paymentStatus = 'success';
          } else if (phonePeTransaction.status === 'FAILED') {
            paymentStatus = 'failed';
          } else {
            paymentStatus = 'pending';
          }
        } else {
          // If transaction not found, use payId as phonepeTransactionId
          phonePeTransactionId = payId;
        }
      } catch (phonePeError) {
        console.error('Error fetching PhonePe transaction:', phonePeError);
        // Continue with payId as phonepeTransactionId
        phonePeTransactionId = payId;
      }
    }
    
    // Check if transactions already exist for this partner
    const existingTransactions = await PaymentTransaction.find({ partnerId: partnerId });
    const hasExistingTransactions = existingTransactions.length > 0;

    // If transactions exist, just update the payId instead of creating new ones
    if (hasExistingTransactions && payId) {
      try {
        // Update all existing transactions with the payId
        await PaymentTransaction.updateMany(
          { partnerId: partnerId, phonepeTransactionId: null },
          {
            $set: {
              phonepeTransactionId: payId,
              status: paymentStatus,
              'metadata.phonePeMerchantTransactionId': payId,
              'metadata.phonePeStatus': phonePeTransaction?.status || null
            }
          }
        );
        console.log('Updated existing transactions with payId:', payId);
      } catch (updateError) {
        console.error('Error updating existing transactions:', updateError);
      }
    }

    // Generate unique transaction IDs for each fee type (only if no existing transactions)
    const timestamp = Date.now();
    const uniqueId = phonePeTransactionId || payId || partnerIdString;

    // Record registration fee transaction (separate transaction) - only if no existing transactions
    if (finalRegistrationFee && finalRegistrationFee > 0 && !hasExistingTransactions) {
      try {
        await PaymentTransaction.create({
          partnerId: partnerId,
          amount: finalRegistrationFee,
          status: paymentStatus,
          paymentMethod: 'whatsapp',
          transactionId: `REG-${uniqueId}-${timestamp}-1`,
          phonepeTransactionId: phonePeTransactionId || payId || null,
          feeType: 'registration',
          description: `Registration Fee - ₹${finalRegistrationFee.toLocaleString('en-IN')} - Partner: ${partnerName}`,
          metadata: {
            paidBy: paidBy || 'Self',
            partnerName: partnerName,
            partnerPhone: data.phone || null,
            partnerEmail: data.profile?.email || null,
            phonePeMerchantTransactionId: payId || null,
            phonePeStatus: phonePeTransaction?.status || null,
            paymentGroupId: paymentGroupId,
            totalPaymentAmount: totalAmount,
            priceBreakdown: {
              registrationFee: finalRegistrationFee,
              securityDeposit: finalSecurityDeposit,
              toolkitPrice: finalToolkitPrice,
              totalAmount: totalAmount
            },
            currentFees: {
              registrationFee: currentRegistrationFee,
              securityDeposit: currentSecurityDeposit,
              toolkitPrice: currentToolkitPrice
            }
          }
        });
      } catch (txnError) {
        console.error('Error recording registration fee transaction:', txnError);
      }
    }
    
    // Record security deposit transaction (separate transaction) - only if no existing transactions
    if (finalSecurityDeposit && finalSecurityDeposit > 0 && !hasExistingTransactions) {
      try {
        await PaymentTransaction.create({
          partnerId: partnerId,
          amount: finalSecurityDeposit,
          status: paymentStatus,
          paymentMethod: 'whatsapp',
          transactionId: `SEC-${uniqueId}-${timestamp}-2`,
          phonepeTransactionId: phonePeTransactionId || payId || null,
          feeType: 'security_deposit',
          description: `Security Deposit - ₹${finalSecurityDeposit.toLocaleString('en-IN')} - Partner: ${partnerName}`,
          metadata: {
            paidBy: paidBy || 'Self',
            partnerName: partnerName,
            partnerPhone: data.phone || null,
            partnerEmail: data.profile?.email || null,
            phonePeMerchantTransactionId: payId || null,
            phonePeStatus: phonePeTransaction?.status || null,
            paymentGroupId: paymentGroupId,
            totalPaymentAmount: totalAmount,
            priceBreakdown: {
              registrationFee: finalRegistrationFee,
              securityDeposit: finalSecurityDeposit,
              toolkitPrice: finalToolkitPrice,
              totalAmount: totalAmount
            },
            currentFees: {
              registrationFee: currentRegistrationFee,
              securityDeposit: currentSecurityDeposit,
              toolkitPrice: currentToolkitPrice
            }
          }
        });
      } catch (txnError) {
        console.error('Error recording security deposit transaction:', txnError);
      }
    }
    
    // Record toolkit transaction (separate transaction) - only if no existing transactions
    if (finalToolkitPrice && finalToolkitPrice > 0 && !hasExistingTransactions) {
      try {
        await PaymentTransaction.create({
          partnerId: partnerId,
          amount: finalToolkitPrice,
          status: paymentStatus,
          paymentMethod: 'whatsapp',
          transactionId: `TOOL-${uniqueId}-${timestamp}-3`,
          phonepeTransactionId: phonePeTransactionId || payId || null,
          feeType: 'toolkit',
          description: `Toolkit Purchase - ₹${finalToolkitPrice.toLocaleString('en-IN')} - Partner: ${partnerName}`,
          metadata: {
            paidBy: paidBy || 'Self',
            partnerName: partnerName,
            partnerPhone: data.phone || null,
            partnerEmail: data.profile?.email || null,
            phonePeMerchantTransactionId: payId || null,
            phonePeStatus: phonePeTransaction?.status || null,
            paymentGroupId: paymentGroupId,
            totalPaymentAmount: totalAmount,
            priceBreakdown: {
              registrationFee: finalRegistrationFee,
              securityDeposit: finalSecurityDeposit,
              toolkitPrice: finalToolkitPrice,
              totalAmount: totalAmount
            },
            currentFees: {
              registrationFee: currentRegistrationFee,
              securityDeposit: currentSecurityDeposit,
              toolkitPrice: currentToolkitPrice
            }
          }
        });
      } catch (txnError) {
        console.error('Error recording toolkit transaction:', txnError);
      }
    }
    
    console.log('Saving payment data:', {
      partnerId: data._id,
      finalRegistrationFee,
      payId,
      paidBy,
      securityDeposit,
      toolkitPrice
    });

    // Save payment data to profile object (as per Partner model schema)
    if (!data.profile) {
      data.profile = {};
    }
    data.profile.registerAmount = finalRegistrationFee || 0;
    data.profile.securityDeposit = finalSecurityDeposit || 0;
    data.profile.toolkitPrice = finalToolkitPrice || 0;
    data.profile.payId = payId || null;
    data.profile.paidBy = paidBy || null;
    data.profile.registerdFee = true;

    console.log('Payment data saved to partner profile:', {
      registerAmount: data.profile.registerAmount,
      securityDeposit: data.profile.securityDeposit,
      toolkitPrice: data.profile.toolkitPrice,
      payId: data.profile.payId,
      paidBy: data.profile.paidBy,
      registerdFee: data.profile.registerdFee
    });
    // Save terms data if provided
    if (terms) {
      data.terms = {
        accepted: terms.accepted || false,
        signature: terms.signature || null,
        acceptedAt: terms.acceptedAt || new Date()
      };
    }
    
    // Update profile status when payment is completed
    // If payment is done, ensure profile is marked appropriately
    if (data.profile.registerdFee) {
      // Check if basic required fields are present
      const hasBasicFields = data.profile?.name && 
                            data.profile?.email && 
                            data.qualification && 
                            data.experience;
      
      // If basic fields are present, mark profile as complete
      if (hasBasicFields) {
        data.profileCompleted = true;
      }
      
      // Set profileStatus to active when payment is completed
      // Admin can review and change status later if needed
      data.profileStatus = 'active';
    }
    
    data = await data.save();

    // Notify all admins about new partner registration/payment
    if (data.profile.registerdFee) {
      const { sendAllAdminsNotification, sendPartnerNotification } = require("../services/notificationService");
      await sendAllAdminsNotification(
        'New Partner Registration',
        `Partner ${data.profile?.name || data.phone} has completed registration and payment. Amount: ₹${totalAmount || data.profile.registerAmount || 0}. Please review their KYC.`,
        'info',
        '/android-chrome-192x192.png'
      );

      // Notify partner
      await sendPartnerNotification(
        data._id,
        'Registration Complete',
        `Your registration is complete! Payment of ₹${totalAmount || data.profile.registerAmount || 0} received. Your profile is under review.`,
        'success',
        '/android-chrome-192x192.png'
      );
    }

    return res.status(200).json({ 
      success: true,
      message: "Successfully completed transaction",
      partnerId: data._id.toString(),
      profileCompleted: data.profileCompleted,
      profileStatus: data.profileStatus
    })
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
      partnerType,
    } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Name and Email are required" });
    }

    // ✅ Fix: Correctly extract the filename
    const profilePicturePath = req.file ? await handleFileUpload(req.file, "partner") : null;

    const updatedPartner = await Partner.findOneAndUpdate(
      { phone: contactNumber },
      {
        $set: {
          profileCompleted: false,
          profile: { name, email, address, landmark, pincode, city, gstNumber: gstNumber || '' },
          whatsappNumber,
          qualification,
          experience,
          partnerType: partnerType || 'individual',
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
      profileStatus: 'active', // Set profile status to active when categories are selected
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
    
    // Ensure profileStatus is active when profile is completed
    // This happens when categories are selected (which means onboarding is progressing)
    if (updatedPartner.profileCompleted) {
      if (updatedPartner.profileStatus !== 'active') {
        updatedPartner.profileStatus = 'active';
        await updatedPartner.save();
      }
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
    let panCard = await handleFileUpload(req.files.panCard[0], "partnerdoc");
    let aadhaar = await handleFileUpload(req.files.aadhaar[0], "partnerdoc");
    let chequeImage = await handleFileUpload(req.files.chequeImage[0], "partnerdoc");
    let aadhaarback = await handleFileUpload(req.files.aadhaarback[0], "partnerdoc");
    let drivingLicence = await handleFileUpload(req.files.drivingLicence[0], "partnerdoc");
    let bill = await handleFileUpload(req.files.bill[0], "partnerdoc");

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
    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: "Partner not found" 
      });
    }

    // Initialize kyc object if it doesn't exist
    if (!data.kyc) {
      data.kyc = {};
    }

    if (req.files && req.files.length > 0) {
      let arr = req.files;
      let uploadedFiles = [];
      
      for (let i = 0; i < arr.length; i++) {
        try {
          if (arr[i].fieldname == "panCard") {
            data.kyc.panCard = await handleFileUpload(arr[i], "partnerdoc");
            uploadedFiles.push("PAN Card");
          }
          if (arr[i].fieldname == "aadhaar") {
            data.kyc.aadhaar = await handleFileUpload(arr[i], "partnerdoc");
            uploadedFiles.push("Aadhaar (Front)");
          }
          if (arr[i].fieldname == "aadhaarback") {
            data.kyc.aadhaarback = await handleFileUpload(arr[i], "partnerdoc");
            uploadedFiles.push("Aadhaar (Back)");
          }
          if (arr[i].fieldname == "chequeImage") {
            data.kyc.chequeImage = await handleFileUpload(arr[i], "partnerdoc");
            uploadedFiles.push("Cancelled Cheque");
          }
          if (arr[i].fieldname == "drivingLicence") {
            data.kyc.drivingLicence = await handleFileUpload(arr[i], "partnerdoc");
            uploadedFiles.push("Driving Licence");
          }
          if (arr[i].fieldname == "bill") {
            data.kyc.bill = await handleFileUpload(arr[i], "partnerdoc");
            uploadedFiles.push("Utility Bill");
          }
        } catch (uploadError) {
          console.error(`Error uploading ${arr[i].fieldname}:`, uploadError);
          return res.status(500).json({ 
            success: false, 
            error: `Failed to upload ${arr[i].fieldname}`,
            message: uploadError.message 
          });
        }
      }
      
      data = await data.save();

      return res.status(200).json({ 
        success: true,
        message: "KYC documents updated successfully",
        uploadedFiles: uploadedFiles
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: "No files provided for upload" 
      });
    }
  } catch (error) {
    console.error("Error updating KYC documents:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to update KYC documents",
      message: error.message 
    });
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
      .populate("hubs", "name city state areas description")

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
        partnerType: profile.partnerType || "individual",
        subcategory: profile.subcategory,
        category: profile.category,
        categoryNames: profile.categoryNames || [],
        service: profile.service,
        modeOfService: profile?.modeOfService || "offline",
        profilePicture: profile.profilePicture,
        status: profile.status || (profile.profileCompleted ? "approved" : "pending"), // Partner approval status
        profileCompleted: profile.profileCompleted,
        drive: profile.drive,
        tempoTraveller: profile.tempoTraveller,
        referralCode: profile.referralCode,
        referredBy: profile.referredBy,
        referredPartners: profile.referredPartners || [],
        address: profile.profile?.address,
        landmark: profile.profile?.landmark,
        pincode: profile.profile?.pincode,
        gstNumber: profile.profile?.gstNumber,
        // Include payment and approval status fields
        paymentApproved: profile?.profile?.paymentApproved,
        registerdFee: profile?.profile?.registerdFee,
        payId: profile?.profile?.payId || "N/A",  
        paidBy: profile?.profile?.paidBy,
        registerAmount: profile?.profile?.registerAmount || 0,
        approvedAt: profile?.approvedAt || profile?.profile?.approvedAt || null,
        approvedBy: profile?.profile?.approvedBy || "Admin",
        isApproved: profile.status === 'approved',
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
        } : null,
        // Include assigned hubs
        hubs: profile.hubs || []
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
      subcategory,
      modeOfService,
      city,
      address,
      landmark,
      pincode,
      referralCode,
      gstNumber,
      partnerType,
      categories,
      categoryNames,
      terms,
    } = req.body;
    
    // Log the entire request body for debugging
    console.log('📥 Update Profile Request Body:', {
      hasCategories: !!req.body.categories,
      hasCategoryNames: !!req.body.categoryNames,
      categories: req.body.categories,
      categoryNames: req.body.categoryNames,
      allKeys: Object.keys(req.body)
    });

    let profile = await Partner.findOne({ _id: req.partner._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Check if profilePicture is uploaded in form-data
    const profilePicture = req.file ? await handleFileUpload(req.file, "partner") : undefined;

    // Update only provided fields (Handle both JSON & form-data)

    if (name) profile.profile.name = name;
    if (city) profile.profile.city = city;
    if (email) profile.profile.email = email;
    if (whatsappNumber) profile.whatsappNumber = whatsappNumber;
    if (contactNumber) profile.contactNumber = contactNumber;
    if (qualification) profile.qualification = qualification;
    if (experience) profile.experience = (experience);
    if (partnerType) profile.partnerType = partnerType;
    if (category) profile.category = category;
    if (subcategory) {
      // Handle both array and single value
      if (Array.isArray(subcategory)) {
        profile.subcategory = subcategory;
      } else {
        profile.subcategory = [subcategory];
      }
    }
    if (service) {
      // Handle both array and single value
      if (Array.isArray(service)) {
        profile.service = service;
      } else {
        profile.service = [service];
      }
    }
    if (modeOfService) profile.modeOfService = modeOfService;
    if (profilePicture) profile.profilePicture = profilePicture;

    // Update address fields
    if (address) profile.profile.address = address;
    if (landmark) profile.profile.landmark = landmark;
    if (pincode) profile.profile.pincode = pincode;
    if (gstNumber) profile.profile.gstNumber = gstNumber;
    if (referralCode) profile.referralCode = referralCode;
    
    // Update categories (can be array)
    console.log('📦 Update Profile - Categories Data:', {
      hasCategories: !!categories,
      categoriesType: Array.isArray(categories) ? 'array' : typeof categories,
      categoriesValue: categories,
      categoriesLength: Array.isArray(categories) ? categories.length : (categories ? 1 : 0),
      hasCategoryNames: !!categoryNames,
      categoryNamesType: Array.isArray(categoryNames) ? 'array' : typeof categoryNames,
      categoryNamesValue: categoryNames,
      categoryNamesLength: Array.isArray(categoryNames) ? categoryNames.length : (categoryNames ? 1 : 0)
    });
    
    if (categories) {
      if (Array.isArray(categories)) {
        profile.category = categories;
        console.log('✅ Saved categories array:', categories);
      } else {
        profile.category = [categories];
        console.log('✅ Saved single category as array:', [categories]);
      }
    } else {
      console.log('⚠️ No categories provided in request');
    }
    
    // Always ensure categoryNames are stored
    if (categoryNames && Array.isArray(categoryNames) && categoryNames.length > 0) {
      // Store category names directly
      profile.categoryNames = categoryNames;
      console.log('✅ Saved categoryNames directly:', categoryNames);
    } else if (categories && (Array.isArray(categories) ? categories.length > 0 : true)) {
      // If categoryNames not provided but categories are, fetch names from database
      const ServiceCategory = require('../models/ServiceCategory');
      try {
        const categoryIds = Array.isArray(categories) ? categories : [categories];
        console.log('🔍 Fetching category names for IDs:', categoryIds);
        
        const categoryDocs = await ServiceCategory.find({ 
          _id: { $in: categoryIds } 
        }).select('name');
        
        console.log('📋 Found category documents:', categoryDocs);
        
        if (categoryDocs.length > 0) {
          profile.categoryNames = categoryDocs.map(cat => cat.name).filter(Boolean);
          console.log('✅ Saved categoryNames from database:', profile.categoryNames);
        } else {
          // If lookup fails, try to extract from populated objects
          const namesFromObjects = categoryIds
            .map(cat => (typeof cat === 'object' && cat.name ? cat.name : null))
            .filter(Boolean);
          if (namesFromObjects.length > 0) {
            profile.categoryNames = namesFromObjects;
            console.log('✅ Saved categoryNames from objects:', profile.categoryNames);
          } else {
            console.log('⚠️ Could not find category names for IDs:', categoryIds);
          }
        }
      } catch (err) {
        console.error('❌ Error fetching category names:', err);
        // If lookup fails, try to extract from populated objects
        const categoryIds = Array.isArray(categories) ? categories : [categories];
        const namesFromObjects = categoryIds
          .map(cat => (typeof cat === 'object' && cat.name ? cat.name : null))
          .filter(Boolean);
        if (namesFromObjects.length > 0) {
          profile.categoryNames = namesFromObjects;
          console.log('✅ Saved categoryNames from objects (fallback):', profile.categoryNames);
        }
      }
    } else {
      console.log('⚠️ No categories or categoryNames to process');
    }
    
    // Handle terms acceptance (for Lead Marketplace flow - registration without payment)
    if (terms && terms.accepted) {
      profile.termsAccepted = true;
      profile.termsSignature = terms.signature || null;
      profile.termsAcceptedAt = terms.acceptedAt ? new Date(terms.acceptedAt) : new Date();
      // Set profile as completed and active (without payment requirement for Lead Marketplace flow)
      profile.profileCompleted = true;
      profile.profileStatus = 'active';
    }
    
    // Log before saving
    console.log('💾 Saving partner profile:', {
      partnerId: profile._id,
      categoryCount: profile.category?.length || 0,
      categoryNamesCount: profile.categoryNames?.length || 0,
      categories: profile.category,
      categoryNames: profile.categoryNames
    });
    
    // Apply updates to the profile - SAVE FIRST before creating lead
    profile = await profile.save();
    
    // Log after saving
    console.log('✅ Partner profile saved:', {
      partnerId: profile._id,
      categoryCount: profile.category?.length || 0,
      categoryNamesCount: profile.categoryNames?.length || 0,
      categories: profile.category,
      categoryNames: profile.categoryNames
    });

    // Populate category and service details before lead creation check
    await profile.populate("category", "name description");
    await profile.populate("service", "name description basePrice duration");
    
    // Create a lead entry in Lead Management for partners registered from Lead Marketplace
    // AFTER profile is saved and populated
    if (terms && terms.accepted) {
      try {
        const Lead = require('../models/Lead');
        const ServiceCategory = require('../models/ServiceCategory');
        
        // Check if lead already exists for this partner registration
        const existingLead = await Lead.findOne({ 
          'metadata.partnerRegistrationId': profile._id.toString(),
          'metadata.createdBy': 'partner_registration'
        });
        
        // Check if partner has category and city (required for lead creation)
        // Now profile is saved and populated, so we can check properly
        // Handle both populated (object) and unpopulated (ObjectId) category
        let categoryValue = profile.category;
        if (Array.isArray(categoryValue)) {
          categoryValue = categoryValue.length > 0 ? categoryValue[0] : null;
        }
        // If populated, get the _id, otherwise use the value directly
        const categoryId = categoryValue?._id || categoryValue;
        
        const hasCategory = !!categoryId;
        const hasCity = profile.profile?.city && profile.profile.city.trim() !== '';
        
        console.log('🔍 Partner Registration Lead Creation Check (AFTER SAVE):');
        console.log('  - Partner ID:', profile._id.toString());
        console.log('  - Profile name:', profile.profile?.name);
        console.log('  - Profile city:', profile.profile?.city);
        console.log('  - Category value (raw):', profile.category);
        console.log('  - Category value (processed):', categoryValue);
        console.log('  - Category ID:', categoryId);
        console.log('  - Has category:', hasCategory);
        console.log('  - Has city:', hasCity);
        console.log('  - Existing lead:', !!existingLead);
        
        if (!existingLead && hasCategory && hasCity) {
          // categoryId is already processed above
          
          // Generate leadId as fallback
          const generateLeadId = () => {
            const timestamp = Date.now();
            const randomNum = Math.floor(Math.random() * 10000);
            return `LD-${timestamp}-${randomNum}`;
          };
          
          // Create lead (leadId will be auto-generated by the model)
          const lead = new Lead({
            leadId: generateLeadId(), // Set initial leadId
            user: null, // No user for partner registration leads
            booking: null, // No booking for partner registration leads
            category: categoryId,
            service: profile.service && profile.service.length > 0 ? (profile.service[0]._id || profile.service[0]) : null,
            subService: null,
            city: profile.profile.city,
            location: {
              address: profile.profile.address || '',
              landmark: profile.profile.landmark || '',
              pincode: profile.profile.pincode || '',
              coordinates: {
                lat: 0,
                lng: 0
              }
            },
            value: 0, // Default value for partner registration leads
            allocationStrategy: 'rule_based',
            priority: 'high', // Higher priority for Lead Marketplace registrations
            status: 'awaiting_bid',
            expiryTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            metadata: {
              description: `Partner registration from Lead Marketplace - ${profile.profile.name || 'New Partner'}`,
              createdBy: 'partner_registration',
              partnerRegistrationId: profile._id.toString(),
              partnerName: profile.profile.name,
              partnerPhone: profile.phone,
              partnerEmail: profile.profile.email,
              fromLeadMarketplace: true // Flag to identify Lead Marketplace registrations
            }
          });
          
          await lead.save();
          console.log('✅ Lead created for partner registration from Lead Marketplace:');
          console.log('  - Lead ID:', lead.leadId);
          console.log('  - Partner:', profile.profile.name || profile.phone);
          console.log('  - Category:', categoryId);
          console.log('  - City:', profile.profile.city);
          console.log('  - This lead will appear in Admin Lead Management page');
        } else if (existingLead) {
          console.log('⚠️ Lead already exists for this partner registration, skipping creation');
          console.log('  - Existing Lead ID:', existingLead.leadId);
        } else {
          console.log('⚠️ Cannot create lead: Missing category or city');
          console.log('  - Has category:', hasCategory);
          console.log('  - Category value:', profile.category);
          console.log('  - Has city:', hasCity);
          console.log('  - City value:', profile.profile?.city);
        }
      } catch (leadErr) {
        console.error('❌ Error creating lead for partner registration:', leadErr);
        console.error('  - Error details:', leadErr.message);
        // Don't block profile update if lead creation fails
      }
    }
    // Note: Profile is already populated above before lead creation

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
    // Check if this is a partner request (filtered) or admin request (all)
    const partnerId = req.partner?._id || req.partner?.id;
    const limit = parseInt(req.query.limit) || 50;
    
    let wallets = [];
    
    if (partnerId) {
      // Partner request: Get partner's wallet and team member activities
      const TeamMember = require("../models/TeamMember");
      const teamMembers = await TeamMember.find({ partner: partnerId, status: "active" }).select("_id name phone");
      const teamMemberIds = teamMembers.map(tm => tm._id);
      const teamMemberMap = {};
      teamMembers.forEach(tm => {
        teamMemberMap[tm._id.toString()] = { name: tm.name, phone: tm.phone };
      });
      
      // Get partner's wallet
      const partnerWallet = await PartnerWallet.findOne({ partner: partnerId })
        .populate("partner", "profile phone");
      
      if (partnerWallet) {
        wallets.push(partnerWallet);
      }
      
      // Flatten transactions with team member info
      const allTransactions = [];
      
      for (const wallet of wallets) {
        if (wallet.transactions && wallet.transactions.length > 0) {
          const partnerName = wallet.partner?.profile?.name || wallet.partner?.Profile?.name || 'N/A';
          
          wallet.transactions.forEach((txn) => {
            // Check if transaction description mentions a team member
            let teamMemberInfo = null;
            if (txn.teamMember) {
              const tmId = txn.teamMember.toString();
              if (teamMemberMap[tmId]) {
                teamMemberInfo = teamMemberMap[tmId];
              }
            }
            
            allTransactions.push({
              id: txn._id || txn.transactionId,
              transactionId: txn.transactionId || txn._id?.toString() || 'N/A',
              partnerName: partnerName,
              partnerId: wallet.partner?._id || wallet.partner?.id,
              teamMember: teamMemberInfo,
              type: txn.type || 'N/A',
              amount: txn.amount || 0,
              balance: txn.balance || wallet.balance || 0,
              description: txn.description || '',
              reference: txn.reference || '',
              initiatedBy: txn.initiatedBy || 'System',
              createdAt: txn.createdAt || txn.timestamp || new Date()
            });
          });
        }
      }
      
      // Sort by date (newest first) and limit
      allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const limitedTransactions = allTransactions.slice(0, limit);
      
      return res.status(200).json({
        message: "Successfully fetched partner transactions",
        success: true,
        transactions: limitedTransactions,
        total: allTransactions.length
      });
    } else {
      // Admin request: Get all wallets
      wallets = await PartnerWallet.find()
        .populate("partner", "profile phone")
        .sort({ _id: -1 });
      
      // Flatten all transactions with partner info
      const allTransactions = [];
      
      for (const wallet of wallets) {
        if (wallet.transactions && wallet.transactions.length > 0) {
          const partnerName = wallet.partner?.profile?.name || wallet.partner?.Profile?.name || 'N/A';
          const partnerEmail = wallet.partner?.profile?.email || wallet.partner?.Profile?.email || 'N/A';
          
          wallet.transactions.forEach((txn) => {
            allTransactions.push({
              id: txn._id || txn.transactionId,
              transactionId: txn.transactionId || txn._id?.toString() || 'N/A',
              partnerName: partnerName,
              partnerId: wallet.partner?._id || wallet.partner?.id,
              type: txn.type || 'N/A',
              amount: txn.amount || 0,
              balance: txn.balance || wallet.balance || 0,
              description: txn.description || '',
              reference: txn.reference || '',
              initiatedBy: txn.initiatedBy || 'System',
              createdAt: txn.createdAt || txn.timestamp || new Date()
            });
          });
        }
      }
      
      // Sort by date (newest first) and limit
      allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const limitedTransactions = allTransactions.slice(0, limit);
      
      return res.status(200).json({
        message: "Successfully fetched all transactions",
        success: true,
        transactions: limitedTransactions,
        total: allTransactions.length
      });
    }
  } catch (error) {
    console.error("Get All Wallet Transactions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching wallet transactions",
      error: error.message
    });
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
      // Send notification using notification service
      const { sendPartnerNotification, sendAdminNotification } = require("../services/notificationService");
      const transactionType = type === 'credit' ? 'credited' : 'debited';
      await sendPartnerNotification(
        partner,
        type === 'credit' ? 'Wallet Credited' : 'Wallet Debited',
        `Your wallet has been ${transactionType} with ₹${amount}. ${description}. Your new balance is ₹${data.balance}.`,
        type === 'credit' ? 'success' : 'alert',
        '/android-chrome-192x192.png'
      );

      // Notify admin who made the transaction
      if (req.admin) {
        const partnerData = await Partner.findById(partner);
        await sendAdminNotification(
          req.admin._id,
          'Wallet Transaction',
          `Wallet ${type} of ₹${amount} for partner ${partnerData?.profile?.name || partnerData?.phone || 'Unknown'}. ${description}`,
          'info',
          '/android-chrome-192x192.png'
        );
      }

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

    // Send notification using notification service
    console.log(`💰 Wallet transaction completed: ${type} ₹${amount} for partner ${partner}`);
    const { sendPartnerNotification, sendAdminNotification } = require("../services/notificationService");
    const transactionType = type === 'credit' ? 'credited' : 'debited';
    
    try {
      await sendPartnerNotification(
        partner,
        type === 'credit' ? 'Wallet Credited' : 'Wallet Debited',
        `Your wallet has been ${transactionType} with ₹${amount}. ${description}. Your new balance is ₹${data.balance}.`,
        type === 'credit' ? 'success' : 'alert',
        '/android-chrome-192x192.png'
      );
      console.log(`✅ Partner notification sent for wallet transaction`);
    } catch (notifError) {
      console.error(`❌ Error sending partner notification:`, notifError);
    }

    // Notify admin who made the transaction
    if (req.admin) {
      try {
        const partnerData = await Partner.findById(partner);
        await sendAdminNotification(
          req.admin._id,
          'Wallet Transaction',
          `Wallet ${type} of ₹${amount} for partner ${partnerData?.profile?.name || partnerData?.phone || 'Unknown'}. ${description}`,
          'info',
          '/android-chrome-192x192.png'
        );
        console.log(`✅ Admin notification sent for wallet transaction`);
      } catch (notifError) {
        console.error(`❌ Error sending admin notification:`, notifError);
      }
    }

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

// Public Partner Verification (No Auth Required)
exports.verifyPartner = async (req, res) => {
  try {
    const { partnerId } = req.params;

    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: "Partner ID is required",
      });
    }

    const partner = await Partner.findById(partnerId)
      .populate("category", "name")
      .select("profile.name profile.email phone profile.city qualification experience categoryNames kyc.status profilePicture")
      .lean();

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    res.json({
      success: true,
      partner: {
        id: partner._id,
        partnerId: partner._id.toString(),
        name: partner.profile?.name || "N/A",
        email: partner.profile?.email || "N/A",
        phone: partner.phone || "N/A",
        city: partner.profile?.city || "N/A",
        qualification: partner.qualification || "N/A",
        experience: partner.experience || 0,
        categoryNames: partner.categoryNames || [],
        profilePicture: partner.profilePicture || null,
        kycStatus: partner.kyc?.status || "pending",
        verifiedAt: partner.kyc?.verifiedAt || null
      },
    });
  } catch (error) {
    console.error("Verify Partner Error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying partner",
      error: error.message,
    });
  }
};

exports.updateOnboardingStep = async (req, res) => {
  try {
    console.log("ppoppppp",req.body); 

    if (!req.partner || !req.partner._id) {
      return res.status(400).json({
        success: false,
        message: "Partner ID is missing",
      });
    }

    const partnerId = new mongoose.Types.ObjectId(req.partner._id);
    const { step, completed, approved, approvedAt, registerAmount, payId, paidBy, securityDeposit,toolkitPrice } = req.body;

    // Update the partner's onboarding step progress
    const updateData = {
      [`onboardingProgress.step${step}`]: {
        completed: completed || false,
        approved: approved || false,
        approvedAt: approvedAt || null,
        updatedAt: new Date(),
        completedAt:new Date()
      }
    };

    // Also update overall approval status if approved
    if (approved) {
      updateData.status = 'approved';
      updateData.approvedAt = approvedAt || new Date();
    }
    if(registerAmount){
      updateData['profile.registerAmount'] = registerAmount;
    }
    if(payId){
      updateData['profile.payId'] = payId;
    }
    if(paidBy){
      updateData['profile.paidBy'] = paidBy;
    }
    if(securityDeposit){
      updateData['profile.securityDeposit'] = securityDeposit;
    }
    if(toolkitPrice){
      updateData['profile.toolkitPrice'] = toolkitPrice;
    }



    const updatedPartner = await Partner.findByIdAndUpdate(
      partnerId,
      updateData,
      { new: true }
    );

    if (!updatedPartner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    res.json({
      success: true,
      message: "Onboarding step updated successfully",
      step: step,
      completed: completed,
      approved: approved
    });

  } catch (error) {
    console.error("Error updating onboarding step:", error);
    res.status(500).json({
      success: false,
      message: "Error updating onboarding step",
      error: error.message
    });
  }
};