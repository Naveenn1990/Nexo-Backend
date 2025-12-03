const TeamMember = require("../models/TeamMember");
const Partner = require("../models/PartnerModel");
const { uploadFile2, handleFileUpload } = require("../middleware/aws");
const multer = require("multer");

// Get all team members for a partner
exports.getTeamMembers = async (req, res) => {
  try {
    if (!req.partner || !req.partner._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const partnerId = req.partner._id;
    const teamMembers = await TeamMember.find({ partner: partnerId })
      .populate("categories", "name")
      .populate("hubs", "name city state")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: teamMembers,
    });
  } catch (error) {
    console.error("Get Team Members Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching team members",
    });
  }
};

// Add a new team member
exports.addTeamMember = async (req, res) => {
  try {
    if (!req.partner || !req.partner._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const partnerId = req.partner._id;
    const {
      name,
      email,
      phone,
      whatsappNumber,
      qualification,
      experience,
      address,
      city,
      pincode,
      role,
      categories,
      categoryNames,
      hubs,
      accountNumber,
      ifscCode,
      accountHolderName,
      bankName,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required",
      });
    }

    // Handle arrays from FormData - they come as string arrays or comma-separated strings
    let categoriesArray = [];
    if (categories) {
      if (Array.isArray(categories)) {
        categoriesArray = categories;
      } else if (typeof categories === 'string') {
        try {
          categoriesArray = JSON.parse(categories);
        } catch {
          categoriesArray = categories.split(',').filter(Boolean);
        }
      }
    }

    let categoryNamesArray = [];
    if (categoryNames) {
      if (Array.isArray(categoryNames)) {
        categoryNamesArray = categoryNames;
      } else if (typeof categoryNames === 'string') {
        try {
          categoryNamesArray = JSON.parse(categoryNames);
        } catch {
          categoryNamesArray = categoryNames.split(',').filter(Boolean);
        }
      }
    }

    let hubsArray = [];
    if (hubs) {
      if (Array.isArray(hubs)) {
        hubsArray = hubs;
      } else if (typeof hubs === 'string') {
        try {
          hubsArray = JSON.parse(hubs);
        } catch {
          hubsArray = hubs.split(',').filter(Boolean);
        }
      }
    }

    // Handle profile picture upload
    const profilePicture = req.files?.profilePicture ? await handleFileUpload(req.files.profilePicture[0], "team-member") : null;

    // Handle KYC documents
    const kycFiles = {};
    if (req.files) {
      if (req.files.panCard) kycFiles.panCard = await handleFileUpload(req.files.panCard[0], "kyc");
      if (req.files.aadhaar) kycFiles.aadhaar = await handleFileUpload(req.files.aadhaar[0], "kyc");
      if (req.files.aadhaarback) kycFiles.aadhaarback = await handleFileUpload(req.files.aadhaarback[0], "kyc");
      if (req.files.chequeImage) kycFiles.chequeImage = await handleFileUpload(req.files.chequeImage[0], "kyc");
      if (req.files.drivingLicence) kycFiles.drivingLicence = await handleFileUpload(req.files.drivingLicence[0], "kyc");
      if (req.files.bill) kycFiles.bill = await handleFileUpload(req.files.bill[0], "kyc");
    }

    const teamMember = new TeamMember({
      partner: partnerId,
      name,
      email,
      phone,
      whatsappNumber,
      qualification,
      experience,
      address,
      city,
      pincode,
      role: role || "technician",
      profilePicture,
      categories: categoriesArray,
      categoryNames: categoryNamesArray,
      hubs: hubsArray,
      kyc: Object.keys(kycFiles).length > 0 ? kycFiles : undefined,
      bankDetails: accountNumber || ifscCode || accountHolderName || bankName ? {
        accountNumber,
        ifscCode,
        accountHolderName,
        bankName,
      } : undefined,
    });

    await teamMember.save();

    const populatedMember = await TeamMember.findById(teamMember._id)
      .populate("categories", "name")
      .populate("hubs", "name city state");

    res.json({
      success: true,
      message: "Team member added successfully",
      data: populatedMember,
    });
  } catch (error) {
    console.error("Add Team Member Error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding team member",
      error: error.message,
    });
  }
};

// Update a team member
exports.updateTeamMember = async (req, res) => {
  try {
    if (!req.partner || !req.partner._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const partnerId = req.partner._id;
    const { memberId } = req.params;
    const updateData = req.body;

    // Verify team member belongs to this partner
    const teamMember = await TeamMember.findOne({ _id: memberId, partner: partnerId });
    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    // Handle profile picture upload
    if (req.file) {
      updateData.profilePicture = await handleFileUpload(req.file, "team-member");
    }

    // Handle KYC documents
    if (req.files) {
      if (req.files.panCard) updateData["kyc.panCard"] = await handleFileUpload(req.files.panCard[0], "kyc");
      if (req.files.aadhaar) updateData["kyc.aadhaar"] = await handleFileUpload(req.files.aadhaar[0], "kyc");
      if (req.files.aadhaarback) updateData["kyc.aadhaarback"] = await handleFileUpload(req.files.aadhaarback[0], "kyc");
      if (req.files.chequeImage) updateData["kyc.chequeImage"] = await handleFileUpload(req.files.chequeImage[0], "kyc");
      if (req.files.drivingLicence) updateData["kyc.drivingLicence"] = await handleFileUpload(req.files.drivingLicence[0], "kyc");
      if (req.files.bill) updateData["kyc.bill"] = await handleFileUpload(req.files.bill[0], "kyc");
    }

    // Handle nested fields properly
    if (updateData.categories) {
      teamMember.categories = Array.isArray(updateData.categories) ? updateData.categories : [updateData.categories];
    }
    if (updateData.categoryNames) {
      teamMember.categoryNames = Array.isArray(updateData.categoryNames) ? updateData.categoryNames : [updateData.categoryNames];
    }
    if (updateData.hubs) {
      teamMember.hubs = Array.isArray(updateData.hubs) ? updateData.hubs : [updateData.hubs];
    }

    // Update other fields
    Object.keys(updateData).forEach((key) => {
      if (key !== "categories" && key !== "categoryNames" && key !== "hubs" && !key.startsWith("kyc.")) {
        if (key === "bankDetails") {
          teamMember.bankDetails = { ...teamMember.bankDetails, ...updateData.bankDetails };
        } else {
          teamMember[key] = updateData[key];
        }
      }
    });

    await teamMember.save();

    const populatedMember = await TeamMember.findById(teamMember._id)
      .populate("categories", "name")
      .populate("hubs", "name city state");

    res.json({
      success: true,
      message: "Team member updated successfully",
      data: populatedMember,
    });
  } catch (error) {
    console.error("Update Team Member Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating team member",
      error: error.message,
    });
  }
};

// Delete a team member
exports.deleteTeamMember = async (req, res) => {
  try {
    if (!req.partner || !req.partner._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const partnerId = req.partner._id;
    const { memberId } = req.params;

    // Verify team member belongs to this partner
    const teamMember = await TeamMember.findOne({ _id: memberId, partner: partnerId });
    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    await TeamMember.findByIdAndDelete(memberId);

    res.json({
      success: true,
      message: "Team member deleted successfully",
    });
  } catch (error) {
    console.error("Delete Team Member Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting team member",
    });
  }
};

// Get team member activities (bookings)
exports.getTeamMemberActivities = async (req, res) => {
  try {
    if (!req.partner || !req.partner._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const partnerId = req.partner._id;
    const { memberId } = req.params;

    // Verify team member belongs to this partner
    const teamMember = await TeamMember.findOne({ _id: memberId, partner: partnerId });
    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    // Get all bookings for this team member
    const Booking = require("../models/booking");
    const bookings = await Booking.find({ teamMember: memberId })
      .populate({
        path: "user",
        select: "name email phone profilePicture",
      })
      .populate({
        path: "subService",
        select: "name price photo description duration",
      })
      .populate({
        path: "service",
        select: "name description",
      })
      .populate({
        path: "category",
        select: "name",
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Get Team Member Activities Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching team member activities",
      error: error.message,
    });
  }
};

// Assign booking to team member
exports.assignBookingToTeamMember = async (req, res) => {
  try {
    if (!req.partner || !req.partner._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const partnerId = req.partner._id;
    const { bookingId, teamMemberId } = req.body;

    if (!bookingId || !teamMemberId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and Team Member ID are required",
      });
    }

    // Verify booking belongs to this partner
    const Booking = require("../models/booking");
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.partner?.toString() !== partnerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "This booking does not belong to your partner account",
      });
    }

    // Verify team member belongs to this partner
    const teamMember = await TeamMember.findOne({ _id: teamMemberId, partner: partnerId });
    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found or does not belong to your account",
      });
    }

    // Check if team member is active
    if (teamMember.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: "Team member is not active",
      });
    }

    // Update booking with team member
    booking.teamMember = teamMemberId;
    if (booking.status === 'accepted') {
      booking.status = 'in_progress';
    }
    await booking.save();

    const populatedBooking = await Booking.findById(bookingId)
      .populate("user", "name email phone")
      .populate("subService", "name")
      .populate("teamMember", "name phone role");

    res.json({
      success: true,
      message: "Booking assigned to team member successfully",
      data: populatedBooking,
    });
  } catch (error) {
    console.error("Assign Booking to Team Member Error:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning booking to team member",
      error: error.message,
    });
  }
};

