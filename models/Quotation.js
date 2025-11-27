const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
}, { _id: false });

const quotationSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  partner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: true
  },
  quotationNumber: {
    type: String,
    unique: true,
    required: false // Will be auto-generated in pre-save hook
  },
  items: [quotationItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  // Customer approval status
  customerStatus: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  customerResponseAt: Date,
  customerRejectionReason: String,
  // Admin approval status
  adminStatus: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  adminResponseAt: Date,
  adminRejectionReason: String,
  adminReviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  // Overall status
  status: {
    type: String,
    enum: ['pending', 'customer_accepted', 'customer_rejected', 'admin_accepted', 'admin_rejected', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  validTill: {
    type: Date,
    required: true
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Indexes for performance
quotationSchema.index({ booking: 1 });
quotationSchema.index({ user: 1 });
quotationSchema.index({ partner: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ customerStatus: 1 });
quotationSchema.index({ adminStatus: 1 });

// Pre-save middleware to generate quotation number
// Use 'validate' hook to ensure it runs before validation
quotationSchema.pre('validate', async function(next) {
  try {
    // Always generate quotation number for new documents or if missing
    if (!this.quotationNumber) {
      const Counter = require('./Counter');
      
      console.log('[Quotation] Generating quotation number...');
      const counter = await Counter.findOneAndUpdate(
        { _id: 'quotation' },
        { $inc: { sequence: 1 } },
        { upsert: true, new: true }
      );
      
      if (!counter || counter.sequence === undefined) {
        throw new Error('Failed to get counter for quotation number');
      }
      
      this.quotationNumber = `QT${String(counter.sequence).padStart(6, '0')}`;
      console.log(`[Quotation] ✅ Generated quotation number: ${this.quotationNumber}`);
    }
    
    next();
  } catch (error) {
    console.error('[Quotation] ❌ Error in pre-validate hook:', error);
    console.error('[Quotation] Error details:', error.message, error.stack);
    next(error);
  }
});

// Pre-save hook for status updates
quotationSchema.pre('save', async function(next) {
  try {
    // Update overall status based on customer and admin statuses
    if (this.customerStatus === 'rejected' || this.adminStatus === 'rejected') {
      this.status = 'rejected';
    } else if (this.customerStatus === 'accepted' && this.adminStatus === 'accepted') {
      this.status = 'approved';
    } else if (this.customerStatus === 'accepted' && this.adminStatus === 'pending') {
      this.status = 'customer_accepted';
    } else if (this.adminStatus === 'accepted' && this.customerStatus === 'pending') {
      this.status = 'admin_accepted';
    } else if (this.customerStatus === 'rejected') {
      this.status = 'customer_rejected';
    } else if (this.adminStatus === 'rejected') {
      this.status = 'admin_rejected';
    }
    
    next();
  } catch (error) {
    console.error('[Quotation] ❌ Error in pre-save hook:', error);
    next(error);
  }
});

module.exports = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
