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
    priceMin: {
      type: Number,
      default: null
    },
    priceMax: {
      type: Number,
      default: null
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

