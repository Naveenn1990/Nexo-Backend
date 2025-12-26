const mongoose = require('mongoose');

const amcContractSchema = new mongoose.Schema({
  // Contract identification
  contractNumber: {
    type: String,
    unique: true
    // Will be generated in pre-save middleware
  },
  
  // Customer information
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Optional if customer is a registered user
  },
  
  // Partner assignment
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: true
  },
  
  // AMC Plan reference
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AMCPlan',
    required: true
  },
  planDetails: {
    name: String,
    price: Number,
    features: [String],
    includedServices: [String],
    serviceFrequency: Object
  },
  
  // Contract timeline
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
    // Will be calculated in pre-save middleware
  },
  duration: {
    type: Number,
    required: true,
    default: 12
  },
  durationUnit: {
    type: String,
    enum: ['months', 'years'],
    default: 'months'
  },
  
  // Financial terms
  totalAmount: {
    type: Number,
    required: true
  },
  paymentTerms: {
    type: String,
    enum: ['monthly', 'quarterly', 'half-yearly', 'yearly', 'upfront'],
    default: 'monthly'
  },
  
  // Contract status
  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'suspended', 'expired', 'cancelled'],
    default: 'draft'
  },
  
  // Additional terms
  specialTerms: {
    type: String
  },
  
  // Service tracking
  servicesCompleted: [{
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    serviceName: String,
    completedDate: Date,
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
    rating: Number,
    feedback: String
  }],
  
  // Payment tracking
  payments: [{
    amount: Number,
    paymentDate: Date,
    paymentMethod: String,
    transactionId: String,
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' }
  }],
  
  // Contract management
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  
  // Renewal information
  renewalReminders: [{
    reminderDate: Date,
    sent: { type: Boolean, default: false },
    method: { type: String, enum: ['email', 'sms', 'whatsapp'] }
  }],
  
  // Contract documents
  documents: [{
    name: String,
    url: String,
    uploadDate: Date,
    type: { type: String, enum: ['contract', 'invoice', 'receipt', 'other'] }
  }]
}, {
  timestamps: true
});

// Generate contract number before saving
amcContractSchema.pre('save', async function(next) {
  if (!this.contractNumber) {
    const count = await mongoose.model('AMCContract').countDocuments();
    const year = new Date().getFullYear();
    this.contractNumber = `AMC${year}${String(count + 1).padStart(4, '0')}`;
  }
  
  // Calculate end date based on start date and duration
  if (this.startDate && this.duration && this.durationUnit) {
    const startDate = new Date(this.startDate);
    if (this.durationUnit === 'years') {
      this.endDate = new Date(startDate.setFullYear(startDate.getFullYear() + this.duration));
    } else {
      this.endDate = new Date(startDate.setMonth(startDate.getMonth() + this.duration));
    }
  }
  
  next();
});

// Indexes for better performance
amcContractSchema.index({ contractNumber: 1 });
amcContractSchema.index({ 'customer.phone': 1 });
amcContractSchema.index({ partnerId: 1 });
amcContractSchema.index({ planId: 1 });
amcContractSchema.index({ status: 1 });
amcContractSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('AMCContract', amcContractSchema);