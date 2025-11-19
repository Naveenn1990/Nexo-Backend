const mongoose = require('mongoose');

const featuredReviewSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  author: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    default: 5
  },
  authorRole: {
    type: String,
    default: '', // e.g., "Homeowner", "Business Owner", etc.
    maxlength: 50
  },
  authorLocation: {
    type: String,
    default: '', // e.g., "Mumbai", "Delhi", etc.
    maxlength: 50
  },
  serviceType: {
    type: String,
    default: '', // e.g., "AC Service", "Plumbing", etc.
    maxlength: 50
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false // For highlighting special reviews
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
  timestamps: true
});

// Index for active featured reviews
featuredReviewSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('FeaturedReview', featuredReviewSchema);

