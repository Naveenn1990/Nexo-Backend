const mongoose = require('mongoose');

const sparePartOrderSchema = new mongoose.Schema({
  // Order identification
  orderId: {
    type: String,
    unique: true,
    required: true,
    default: () => `SPO${Date.now()}${Math.floor(Math.random() * 1000)}`
  },
  
  // Partner who placed the order
  partner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: true
  },
  
  // Order items (from partner's cart)
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Order totals
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Order status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // Payment information
  payment: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['payu', 'wallet', 'cod', 'bank_transfer'],
      default: 'payu'
    },
    transactionId: String,
    payuPaymentId: String,
    paymentDate: Date,
    amount: Number
  },
  
  // Delivery information
  delivery: {
    address: {
      name: String,
      phone: String,
      email: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    },
    expectedDate: Date,
    actualDate: Date,
    trackingNumber: String,
    courier: String
  },
  
  // Order notes and remarks
  notes: {
    customer: String,
    admin: String,
    internal: String
  },
  
  // Timestamps for status changes
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: String,
      enum: ['system', 'admin', 'partner'],
      default: 'system'
    },
    remarks: String
  }],
  
  // Invoice details
  invoice: {
    number: String,
    date: Date,
    url: String
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate totals
sparePartOrderSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    // Calculate subtotal
    this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
    
    // Calculate total amount (subtotal + tax + shipping)
    this.totalAmount = this.subtotal + (this.tax || 0) + (this.shippingCharges || 0);
    
    // Update payment amount if not set
    if (!this.payment.amount) {
      this.payment.amount = this.totalAmount;
    }
  }
  next();
});

// Add status to history when status changes
sparePartOrderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      updatedBy: 'system'
    });
  }
  next();
});

// Index for better query performance
sparePartOrderSchema.index({ partner: 1, createdAt: -1 });
sparePartOrderSchema.index({ orderId: 1 });
sparePartOrderSchema.index({ 'payment.transactionId': 1 });
sparePartOrderSchema.index({ status: 1 });

const SparePartOrder = mongoose.model('SparePartOrder', sparePartOrderSchema);

module.exports = SparePartOrder;