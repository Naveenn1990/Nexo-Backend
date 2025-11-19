const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  partner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: true
  },
  bidAmount: {
    type: Number,
    required: true,
    min: 0
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  eta: {
    type: String, // Estimated time of arrival in minutes or hours
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const leadSchema = new mongoose.Schema({
  leadId: {
    type: String,
    unique: true,
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false // Optional for manual leads
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for manual leads
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory'
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  subService: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubService'
  },
  city: {
    type: String,
    required: true
  },
  location: {
    address: String,
    landmark: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  allocationStrategy: {
    type: String,
    enum: ['instant_assign', 'tiered_bid', 'rule_based', 'manual'],
    default: 'rule_based'
  },
  assignedPartner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner'
  },
  status: {
    type: String,
    enum: ['pending', 'awaiting_bid', 'bidding', 'assigned', 'converted', 'escalated', 'cancelled', 'expired'],
    default: 'pending'
  },
  bids: [bidSchema],
  acceptedBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid'
  },
  allocationTime: {
    type: Date
  },
  convertedAt: {
    type: Date
  },
  expiryTime: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Generate unique lead ID
leadSchema.pre('save', async function(next) {
  // Only generate if leadId is not already set
  if (!this.leadId || this.leadId.trim() === '') {
    try {
      let leadId;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 20; // Increased attempts
      
      // Use mongoose.model to get the Lead model
      // This should work as the model is already registered
      const LeadModel = mongoose.models.Lead || this.constructor;
      
      while (!isUnique && attempts < maxAttempts) {
        // Generate a more unique ID with timestamp
        const timestamp = Date.now().toString().slice(-6);
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        leadId = `LD-${timestamp}-${randomNum}`;
        
        try {
          const exists = await LeadModel.findOne({ leadId: leadId });
          if (!exists) {
            isUnique = true;
          }
        } catch (queryErr) {
          // If query fails, try a different approach
          console.warn('Query error while checking leadId uniqueness:', queryErr);
          // Continue to next attempt
        }
        
        attempts++;
      }
      
      if (!isUnique) {
        // Fallback: use timestamp + random to ensure uniqueness
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 10000);
        leadId = `LD-${timestamp}-${randomNum}`;
        console.warn('Using fallback leadId generation:', leadId);
      }
      
      this.leadId = leadId;
      console.log('Generated leadId:', leadId);
    } catch (err) {
      console.error('Error in pre-save hook for leadId generation:', err);
      // Fallback: generate a simple ID to prevent validation error
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 10000);
      this.leadId = `LD-${timestamp}-${randomNum}`;
      console.warn('Using emergency fallback leadId:', this.leadId);
    }
  }
  next();
});

// Index for faster queries
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ city: 1, status: 1 });
leadSchema.index({ assignedPartner: 1 });
leadSchema.index({ 'bids.partner': 1 });

const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;

