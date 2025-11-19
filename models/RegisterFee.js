const mongoose = require('mongoose');

// Pricing Settings Schema
const pricingSettingsSchema = new mongoose.Schema({
  registrationFee: {
    type: Number,
    required: true,
    min: 0,
    default: 500
  },
  securityDeposit: {
    type: Number,
    required: true,
    min: 0,
    default: 1000
  },
  toolkitPrice: {
    type: Number,
    required: true,
    min: 0,
    default: 2499
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  specialOfferActive: {
    type: Boolean,
    default: false
  },
  specialOfferText: {
    type: String,
    default: ''
  },
  commissionRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  freeCommissionThreshold: {
    type: Number,
    required: true,
    min: 0
  },
  refundPolicy: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  registrationFeeRefundable: {
    type: Boolean,
    default: false
  },
  securityDepositRefundable: {
    type: Boolean,
    default: false
  },
  toolkitPriceRefundable: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Plan Features Schema
const planFeatureSchema = new mongoose.Schema({
  feature: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Help Content Schema
const helpContentSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    default: 'general'
  }
}, {
  timestamps: true
});

// Stats Schema
const statsSchema = new mongoose.Schema({
  totalPartners: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  successfulPayments: {
    type: Number,
    default: 0
  },
  failedPayments: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Payment Transaction Schema
const paymentTransactionSchema = new mongoose.Schema({
  partnerId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'netbanking', 'wallet', 'whatsapp'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    required: true
  },
  phonepeTransactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  feeType: {
    type: String,
    enum: ['registration', 'security_deposit', 'toolkit', 'mg_plan', 'lead_fee', 'other'],
    default: 'other'
  },
  description: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Create models
const PricingSettings = mongoose.model('PricingSettings', pricingSettingsSchema);
const PlanFeature = mongoose.model('PlanFeature', planFeatureSchema);
const HelpContent = mongoose.model('HelpContent', helpContentSchema);
const Stats = mongoose.model('Stats', statsSchema);
const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);

module.exports = {
  PricingSettings,
  PlanFeature,
  HelpContent,
  Stats,
  PaymentTransaction
};