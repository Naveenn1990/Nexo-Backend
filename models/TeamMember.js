const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    whatsappNumber: {
      type: String,
      trim: true,
    },
    qualification: {
      type: String,
    },
    experience: {
      type: String,
    },
    address: {
      type: String,
    },
    city: {
      type: String,
    },
    pincode: {
      type: String,
    },
    role: {
      type: String,
      enum: ["technician", "supervisor", "manager", "other"],
      default: "technician",
    },
    profilePicture: {
      type: String,
    },
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
    }],
    categoryNames: [{
      type: String,
    }],
    hubs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hub",
    }],
    kyc: {
      panCard: String,
      aadhaar: String,
      aadhaarback: String,
      chequeImage: String,
      drivingLicence: String,
      bill: String,
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      remarks: String,
    },
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    joinedDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
teamMemberSchema.index({ partner: 1, status: 1 });

const TeamMember = mongoose.model("TeamMember", teamMemberSchema);
module.exports = TeamMember;

