const mongoose = require('mongoose');

const popularServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  icon: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  price: {
    type: String,
    trim: true,
    default: ''
  },
  basePrice: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  discountType: {
    type: String,
    enum: ['percentage', 'amount'],
    default: 'percentage'
  },
  cgst: {
    type: Number,
    default: 0
  },
  sgst: {
    type: Number,
    default: 0
  },
  serviceCharge: {
    type: Number,
    default: 0
  },
  serviceChargeType: {
    type: String,
    enum: ['percentage', 'amount'],
    default: 'amount'
  },
  trusted: {
    type: String,
    trim: true,
    default: 'Trusted by thousands of homes'
  },
  included: [{
    type: String,
    trim: true
  }],
  excluded: [{
    type: String,
    trim: true
  }],
  addOns: [{
    name: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    basePrice: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    cgst: {
      type: Number,
      default: 0
    },
    sgst: {
      type: Number,
      default: 0
    },
    serviceCharge: {
      type: Number,
      default: 0
    },
    price: {
      type: String,
      trim: true,
      default: ''
    },
    icon: {
      type: String,
      trim: true,
      default: 'FaTools'
    },
    included: [{
      type: String,
      trim: true
    }],
    excluded: [{
      type: String,
      trim: true
    }],
    subServices: [{
      name: {
        type: String,
        trim: true,
        default: ''
      },
      shortDescription: {
        type: String,
        trim: true,
        default: ''
      },
      price: {
        type: String,
        trim: true,
        default: ''
      },
      icon: {
        type: String,
        trim: true,
        default: 'FaTools'
      }
    }]
  }],
  order: {
    type: Number,
    default: 0
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
});

// Update the updatedAt field before saving
popularServiceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const PopularService = mongoose.model('PopularService', popularServiceSchema);

module.exports = PopularService;

