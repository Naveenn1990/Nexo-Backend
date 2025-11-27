const mongoose = require("mongoose");

const vendorBookingSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true
    },
    sparePart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorSparePart",
      required: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner"
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "dispatched", "delivered", "cancelled"],
      default: "pending"
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
      name: String
    },
    orderDate: {
      type: Date,
      default: Date.now
    },
    deliveryDate: {
      type: Date
    },
    trackingNumber: {
      type: String
    },
    notes: {
      type: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

vendorBookingSchema.index({ vendor: 1 });
vendorBookingSchema.index({ status: 1 });
vendorBookingSchema.index({ orderDate: -1 });

module.exports = mongoose.model("VendorBooking", vendorBookingSchema);

