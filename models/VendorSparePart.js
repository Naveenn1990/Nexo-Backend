const mongoose = require("mongoose");

const vendorSparePartSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    brand: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    unit: {
      type: String,
      default: "units"
    },
    image: {
      type: String
    },
    icon: {
      type: String,
      trim: true
    },
    specifications: {
      type: String
    },
    hsnCode: {
      type: String
    },
    gstPercentage: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["active", "inactive", "out_of_stock"],
      default: "active"
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

vendorSparePartSchema.index({ vendor: 1 });
vendorSparePartSchema.index({ category: 1 });
vendorSparePartSchema.index({ status: 1 });

module.exports = mongoose.model("VendorSparePart", vendorSparePartSchema);

