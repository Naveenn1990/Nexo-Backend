const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  planPrice: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentDetails: {
    txnId: String,
    payId: String,
    amount: Number,
    paymentDate: Date,
    paymentMethod: String
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  cancelledAt: Date,
  cancelReason: String
}, {
  timestamps: true
});

// Index for efficient queries
userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ endDate: 1, status: 1 });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
