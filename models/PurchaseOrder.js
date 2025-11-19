const mongoose = require('mongoose');

const purchaseOrderItemSchema = new mongoose.Schema({
  inventoryItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  sku: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
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
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  }
});

const purchaseOrderSchema = new mongoose.Schema({
  poId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  supplier: {
    type: String,
    required: true,
    trim: true
  },
  supplierContact: {
    type: String,
    trim: true
  },
  items: [purchaseOrderItemSchema],
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'Approved', 'In Transit', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDeliveryDate: {
    type: Date,
    required: true
  },
  actualDeliveryDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'purchaseorders'
});

// Index for faster queries
purchaseOrderSchema.index({ poId: 1 });
purchaseOrderSchema.index({ supplier: 1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ orderDate: -1 });

// Pre-save middleware to calculate total value
purchaseOrderSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.totalValue = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }
  this.updatedAt = new Date();
  next();
});

// Generate PO ID
purchaseOrderSchema.statics.generatePOId = async function() {
  const count = await this.countDocuments();
  const poNumber = String(count + 1).padStart(4, '0');
  return `PO-${poNumber}`;
};

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

module.exports = PurchaseOrder;

