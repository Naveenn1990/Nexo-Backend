const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  icon: {
    type: String,
    default: 'FaMapMarkerAlt' // Default icon name
  },
  image: {
    type: String, // URL to city image
    default: null
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
citySchema.index({ isEnabled: 1, displayOrder: 1 });
citySchema.index({ name: 1 });

module.exports = mongoose.model('City', citySchema);
