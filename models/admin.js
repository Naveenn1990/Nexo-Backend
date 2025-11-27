

const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "subadmin"],
      default: "admin",
    }, 
    // notifications: [],
    fcmToken: { type: String },
    notifications: [{
      message: { type: String, required: true },
      title: { type: String }, // Add title field for consistency
      booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
      seen: { type: Boolean, default: false },
      read: { type: Boolean, default: false }, // Add read field for consistency with frontend
      date: { type: Date, default: Date.now },
      createdAt: { type: Date, default: Date.now }, // Add createdAt for consistency
      type: { type: String, enum: ['info', 'alert', 'message', 'job'], default: 'info' }
    }], 
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin", // Reference to the admin who created the subadmin
      default: null,
    },
    // Permissions for Subadmins (Controlled by Admin)
    permissions: {
      dashboard: { type: Boolean, default: false },
      subadmin: { type: Boolean, default: false },
      banner: { type: Boolean, default: false },
      categories: { type: Boolean, default: false },
      subCategories: { type: Boolean, default: false },
      services: { type: Boolean, default: false },
      subServices: { type: Boolean, default: false },
      offers: { type: Boolean, default: false },
      productInventory: { type: Boolean, default: false },
      orders: { type: Boolean, default: false },
      booking: { type: Boolean, default: false },
      refundRequest: { type: Boolean, default: false },
      reviews: { type: Boolean, default: false },
      customer: { type: Boolean, default: false },
      providerVerification: { type: Boolean, default: false },
      promotionalVideo: { type: Boolean, default: false },
      verifiedProvider: { type: Boolean, default: false },
      enquiry: { type: Boolean, default: false },
      sales: { type: Boolean, default: false },
      revenue: { type: Boolean, default: false },
      register: { type: Boolean, default: false },
      complaintToken: { type: Boolean, default: false },
      providerregisterfee:{ type: Boolean, default: false },
      transaction: { type: Boolean, default: false },
      referralAmount: { type: Boolean, default: false }, // New permission for Referral Amount
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

module.exports = mongoose.model("Admin", adminSchema);
