const mongoose = require('mongoose');

const amcPlanSchema = new mongoose.Schema({
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
    default: '' // e.g., "₹2,500" - for display purposes
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
    default: false // For highlighting a plan (e.g., "Standard" plan)
  },
  highlightText: {
    type: String,
    default: '' // Optional highlight text
  },
  whatsappNumber: {
    type: String,
    default: '' // Optional WhatsApp number for this plan
  },
  planType: {
    type: String,
    enum: ['individual', 'business', 'corporate'],
    default: 'business',
    required: true
  },
  targetCustomer: {
    type: String,
    default: '' // Description of target customer (e.g., "Small businesses", "Homeowners")
  },
  duration: {
    type: Number,
    default: 12 // Plan duration (e.g., 12 months, 1 year)
  },
  durationUnit: {
    type: String,
    enum: ['months', 'years'],
    default: 'months'
  },
  includedServices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PopularService' // References to popular services
  }],
  serviceFrequency: {
    type: mongoose.Schema.Types.Mixed,
    default: {} // Object mapping service IDs to frequency (e.g., { "serviceId": "4" } for quarterly)
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for active plans
amcPlanSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('AMCPlan', amcPlanSchema);

