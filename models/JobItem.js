const mongoose = require('mongoose');

const jobItemSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: true,
    index: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    default: null // null for manual items
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    trim: true,
    default: ''
  },
  isManual: {
    type: Boolean,
    default: false // true for manually added items, false for inventory items
  },
  usedAt: {
    type: Date,
    default: null // when the item was actually used in the job
  },
  status: {
    type: String,
    enum: ['pending', 'used', 'returned', 'cancelled'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  // Audit fields
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
jobItemSchema.index({ jobId: 1, partnerId: 1 });
jobItemSchema.index({ partnerId: 1, createdAt: -1 });
jobItemSchema.index({ category: 1 });
jobItemSchema.index({ status: 1 });

// Virtual for formatted total price
jobItemSchema.virtual('formattedTotalPrice').get(function() {
  return `₹${this.totalPrice.toLocaleString('en-IN')}`;
});

// Virtual for formatted unit price
jobItemSchema.virtual('formattedUnitPrice').get(function() {
  return `₹${this.unitPrice.toLocaleString('en-IN')}`;
});

// Pre-save middleware to update totalPrice
jobItemSchema.pre('save', function(next) {
  if (this.isModified('quantity') || this.isModified('unitPrice')) {
    this.totalPrice = this.quantity * this.unitPrice;
  }
  this.updatedAt = new Date();
  next();
});

// Static method to get job items summary
jobItemSchema.statics.getJobSummary = async function(jobId, partnerId) {
  const items = await this.find({ jobId, partnerId });
  
  return {
    totalItems: items.length,
    totalCost: items.reduce((sum, item) => sum + item.totalPrice, 0),
    itemsByStatus: items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {}),
    itemsByCategory: items.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { count: 0, totalCost: 0 };
      }
      acc[category].count++;
      acc[category].totalCost += item.totalPrice;
      return acc;
    }, {})
  };
};

// Static method to get partner's total spending on items
jobItemSchema.statics.getPartnerSpending = async function(partnerId, startDate, endDate) {
  const match = { partnerId };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$totalPrice' },
        totalItems: { $sum: 1 },
        avgItemCost: { $avg: '$totalPrice' }
      }
    }
  ]);

  return result[0] || { totalSpent: 0, totalItems: 0, avgItemCost: 0 };
};

module.exports = mongoose.model('JobItem', jobItemSchema);