const mongoose = require("mongoose");

const vendorTransactionSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorBooking"
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ["online", "cash", "bank_transfer", "wallet"],
      default: "online"
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending"
    },
    reference: {
      type: String
    },
    transactionDate: {
      type: Date,
      default: Date.now
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

vendorTransactionSchema.index({ vendor: 1 });
vendorTransactionSchema.index({ status: 1 });
vendorTransactionSchema.index({ transactionDate: -1 });

module.exports = mongoose.model("VendorTransaction", vendorTransactionSchema);

