const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  priceDisplay: {
    type: String,
    default: '' // e.g., "₹99" - for display purposes
  },
  features: [{
    type: String,
    required: true
  }],
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0 // For ordering plans in display
  },
  highlight: {
    type: Boolean,
    default: false // For highlighting a plan (e.g., "Pro" plan)
  },
  highlightText: {
    type: String,
    default: '' // Optional highlight text
  },
  whatsappNumber: {
    type: String,
    default: '' // Optional WhatsApp number for this plan
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for active plans
subscriptionPlanSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

