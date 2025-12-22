const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  profilePicture: {
    type: String,
  },
  name: {
    type: String,
    trim: true,
    required: false
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    required: false
  },
  password: {
    type: String,
    minlength: 6
  },
  selectedAddress:{
    type:String
  },
  addresses: [{
    address: { type: String, trim: true },
    lat: { type: String },
    lng: { type: String },
    landmark: { type: String, trim: true },
    addressType: { type: String, trim: true },
    pincode: { type: String, trim: true }
  }],
  tempOTP: String,
  tempOTPExpiry: Date,
  isVerified: {
    type: Boolean,
    default: false
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active'
  },
  // notifications:[],
  fcmToken: {type: String},
  // notifications: [{
  //   message: { type: String, required: true },
  //   booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  //   seen: { type: Boolean, default: false },
  //   date: { type: Date, default: Date.now }
  // }],

  // User reviews
  referalCode: {
    type: String,
    unique: true,
    default: () => {
      return `WAVEREU${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    }
  },
  
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  referredUsers: [{
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // referred user ID
    name: String,
    mobile: String
  }],
  
  // User type for different service categories
  userType: {
    type: String,
    enum: ['home', 'pg', 'company', 'other'],
    default: 'home'
  },
  
  // Company-specific fields (only for company users)
  companyDetails: {
    companyName: { type: String, trim: true },
    companySize: { 
      type: String, 
      enum: ['', 'small', 'medium', 'large', 'enterprise'],
      default: ''
    },
    industry: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    designation: { type: String, trim: true }
  },
  
  // AMC Plan subscription (for companies)
  amcSubscription: {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'AMCPlan' },
    planName: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: false },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    subscriptionDate: { type: Date, default: Date.now }
  },
  reviews: [
    {
      partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner" },
      booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
      rating: { type: Number, required: true },
      comment: { type: String, required: true },
      video: { type: String }, // Optional video field
      createdAt: { type: Date, default: Date.now }
    }
  ],
  
  // Payment-related fields
  pendingPayments: [{
    txnid: { type: String, required: true },
    mihpayid: { type: String },
    amount: { type: Number, required: true },
    productinfo: { type: String, required: true },
    status: { type: String, enum: ['initiated', 'success', 'failed'], default: 'initiated' },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
  }],
  
  // AMC Subscriptions (multiple plans possible)
  amcSubscriptions: [{
    planName: { type: String, required: true },
    amount: { type: Number, required: true },
    txnid: { type: String, required: true },
    mihpayid: { type: String },
    subscribedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
    assignedPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
    assignedPartnerName: { type: String },
    assignedAt: { type: Date }
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  try {
    if (this.isModified("password")) {
      this.password = await bcrypt.hash(this.password, 10);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
