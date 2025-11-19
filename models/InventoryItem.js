const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unit: {
    type: String,
    default: 'units',
    trim: true
  },
  status: {
    type: String,
    enum: ['Critical', 'Low', 'Healthy'],
    default: 'Healthy'
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
  leadTime: {
    type: Number,
    required: true,
    min: 0,
    default: 0 // in days
  },
  unitPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  reorderLevel: {
    type: Number,
    min: 0,
    default: 10
  },
  minStockLevel: {
    type: Number,
    min: 0,
    default: 5
  },
  description: {
    type: String,
    trim: true
  },
  history: [{
    action: {
      type: String,
      enum: ['created', 'stock_added', 'stock_removed', 'updated', 'status_changed'],
      required: true
    },
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    quantity: Number,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    notes: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
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
  collection: 'inventoryitems'
});

// Index for faster queries
inventoryItemSchema.index({ sku: 1 });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ location: 1 });
inventoryItemSchema.index({ status: 1 });

// Pre-save middleware to update status based on stock and track history
inventoryItemSchema.pre('save', function(next) {
  const previousStatus = this.status;
  
  if (this.stock <= this.minStockLevel) {
    this.status = 'Critical';
  } else if (this.stock <= this.reorderLevel) {
    this.status = 'Low';
  } else {
    this.status = 'Healthy';
  }

  // Track status change in history
  if (this.isNew) {
    // New item - add creation history
    if (!this.history) {
      this.history = [];
    }
    this.history.push({
      action: 'created',
      newValue: {
        stock: this.stock,
        status: this.status
      },
      timestamp: new Date()
    });
  } else if (previousStatus && previousStatus !== this.status) {
    // Status changed - add to history
    if (!this.history) {
      this.history = [];
    }
    this.history.push({
      action: 'status_changed',
      previousValue: previousStatus,
      newValue: this.status,
      timestamp: new Date()
    });
  }

  this.updatedAt = new Date();
  next();
});

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

module.exports = InventoryItem;

