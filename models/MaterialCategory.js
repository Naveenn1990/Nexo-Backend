const mongoose = require('mongoose');

const materialCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    required: true,
    trim: true
  },
  items: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    priceMin: {
      type: Number,
      default: null
    },
    priceMax: {
      type: Number,
      default: null
    },
    stock: {
      type: Number,
      default: 0
    },
    unit: {
      type: String,
      default: 'pieces',
      enum: ['pieces', 'kg', 'grams', 'liters', 'ml', 'meters', 'cm', 'feet', 'inches', 'sqft', 'sqm', 'boxes', 'packets', 'rolls', 'sets', 'pairs', 'units']
    },
    sku: {
      type: String,
      default: ''
    },
    brand: {
      type: String,
      default: ''
    },
    specifications: {
      type: String,
      default: ''
    },
    minOrderQuantity: {
      type: Number,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    }
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
}, {
  timestamps: true,
  collection: 'materialcategories'
});

const MaterialCategory = mongoose.model('MaterialCategory', materialCategorySchema);

module.exports = MaterialCategory;

