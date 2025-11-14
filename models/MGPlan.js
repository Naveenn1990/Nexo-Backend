const mongoose = require('mongoose');

const mgPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['Silver', 'Gold', 'Platinum'],
    unique: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  leads: {
    type: Number,
    required: true,
    min: 0
  },
  commission: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  leadFee: {
    type: Number,
    default: 50,
    min: 0
  },
  minWalletBalance: {
    type: Number,
    default: 20,
    min: 0
  },
  description: {
    type: String,
    default: ''
  },
  refundPolicy: {
    type: String,
    default: 'Refund eligible if guaranteed leads not delivered within plan period.'
  },
  features: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: ''
  },
  validityType: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly', 'custom'],
    default: 'monthly'
  },
  validityMonths: {
    type: Number,
    default: 1,
    min: 1
  }
}, {
  timestamps: true
});

// Ensure only one default plan exists
mgPlanSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await mongoose.model('MGPlan').updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('MGPlan', mgPlanSchema);

