const mongoose = require('mongoose');

const inventoryThresholdSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  minStockLevel: {
    type: Number,
    required: true,
    min: 0,
    default: 5
  },
  reorderLevel: {
    type: Number,
    required: true,
    min: 0,
    default: 10
  },
  criticalLevel: {
    type: Number,
    required: true,
    min: 0,
    default: 3
  },
  autoReorder: {
    type: Boolean,
    default: false
  },
  autoReorderQuantity: {
    type: Number,
    min: 0,
    default: 20
  },
  leadTimeDays: {
    type: Number,
    min: 0,
    default: 7
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
  collection: 'inventorythresholds'
});

// Index
inventoryThresholdSchema.index({ category: 1 });

inventoryThresholdSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const InventoryThreshold = mongoose.model('InventoryThreshold', inventoryThresholdSchema);

module.exports = InventoryThreshold;

