const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema({
  areaName: {
    type: String,
    required: true,
    trim: true
  },
  pinCodes: {
    type: [String],
    required: true,
    validate: {
      validator: function(pins) {
        return pins.length > 0 && pins.every(pin => /^\d{6}$/.test(pin.trim()));
      },
      message: 'Each area must have at least one valid 6-digit pin code'
    }
  }
}, { _id: true });

const hubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  areas: {
    type: [areaSchema],
    default: [],
    validate: {
      validator: function(areas) {
        return areas.length > 0;
      },
      message: 'Hub must have at least one area'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  assignedPartners: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for faster queries
hubSchema.index({ name: 1 });
hubSchema.index({ 'areas.pinCodes': 1 });
hubSchema.index({ status: 1 });

// Method to get all pin codes from all areas
hubSchema.methods.getAllPinCodes = function() {
  return this.areas.reduce((allPins, area) => {
    return [...allPins, ...area.pinCodes];
  }, []);
};

// Method to find area by pin code
hubSchema.methods.findAreaByPinCode = function(pinCode) {
  return this.areas.find(area => area.pinCodes.includes(pinCode));
};

// Static method to find hub by pin code
hubSchema.statics.findByPinCode = async function(pinCode) {
  return this.findOne({
    'areas.pinCodes': pinCode,
    status: 'active'
  });
};

// Static method to find all hubs by pin code
hubSchema.statics.findAllByPinCode = async function(pinCode) {
  return this.find({
    'areas.pinCodes': pinCode,
    status: 'active'
  });
};

const Hub = mongoose.model('Hub', hubSchema);

module.exports = Hub;

