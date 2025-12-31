const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  address: { type: String, required: true },
  landmark: { type: String, default: "" },
  pincode: { type: String },
}, { _id: false });

// Function to generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubService",
      required: false  // Made optional for service bookings
    },
    // Popular Service reference for AiSensy integration
    popularService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PopularService",
      required: false
    },
    // New fields for service booking flow
    serviceName: { type: String },
    serviceData: { type: mongoose.Schema.Types.Mixed },
    cartItems: [{ type: mongoose.Schema.Types.Mixed }],
    cartTotal: { type: Number }, // Original cart total before GST and discounts
    customerDetails: {
      name: String,
      email: String,
      phone: String
    },
    specialInstructions: { type: String },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number },
    txnid: { type: String },
    paymentDetails: { type: mongoose.Schema.Types.Mixed },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceCategory" },
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true },
    location: { type: locationSchema, required: true },
    amount: { type: Number, required: true },
    payamount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
    },
    paymentMode: {
      type: String,
      enum: ["credit card", "cash", "paypal", "bank transfer", "phonepe", "upi", 'online'],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in_progress", "completed", "cancelled", "accepted", "rejected", "paused", "temp"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    cancellationReason: String,
    cancellationTime: Date,
    review: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      createdAt: Date,
      video: String, // Optional video review
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner", // Assigned when the partner accepts the booking
    },
    teamMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeamMember", // Team member who completed the booking
    },

    acceptedAt: Date,
    completedAt: Date,
    otp: {
      type: String,
    },
    otpGeneratedAt: {
      type: Date,
    },
    otpActive: {
      type: Boolean,
      default: false,
    },
    pauseDetails: {
      nextScheduledDate: Date,
      nextScheduledTime: String,
      pauseReason: String,
      pausedAt: Date,
    },
    photos: [{ type: String }],
    videos: [{ type: String }],
    remark: { type: String }, // Partner remark when completing the job

    // **New Field: Partner Cart (Stores selected products before approval)**
    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: {
          type: String,
        },
        price: {
          type: Number,
          default: 0,
        },
        amount: {
          type: Number,
          default: 0,
        },
        description: {
          type: String,
        },
        image: {
          type: String,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
        approved: {
          type: Boolean,
          default: false, // User approval required
        },
        addedByPartner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Partner",
        }
      }
    ],
    chat: [],
    reviewPrice: {
      type: Number,
      default: 50
    },
      usewallet: {
      type: Number,
      default: 0
    },
    lat: { type: String },
    lng: { type: String },
    rideStart: { type: Boolean, default: false },
    currentBooking: { type: Boolean, default: false },
    
    // Temporary booking fields for payment flow
    isTemporary: { type: Boolean, default: false },
    expiresAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save middleware to handle OTP generation
bookingSchema.pre('save', function (next) {
  // Generate OTP when partner accepts booking (status changes to 'accepted')
  if (this.isModified('status') && this.status === 'accepted' && this.partner) {
    this.otp = generateOTP();
    this.otpGeneratedAt = new Date();
    this.otpActive = true;
    this.acceptedAt = new Date();
  }

  // Generate OTP for existing accepted bookings that don't have OTP
  if (this.status === 'accepted' && this.partner && (!this.otp || this.otp === '')) {
    this.otp = generateOTP();
    this.otpGeneratedAt = new Date();
    this.otpActive = true;
    if (!this.acceptedAt) {
      this.acceptedAt = new Date();
    }
  }

  // Stop OTP generation when booking is completed
  if (this.isModified('status') && this.status === 'completed') {
    this.otpActive = false;
    this.completedAt = new Date();
  }

  next();
});

// Method to regenerate OTP (for daily changes)
bookingSchema.methods.regenerateOTP = function () {
  if (this.otpActive && this.status === 'accepted') {
    this.otp = generateOTP();
    this.otpGeneratedAt = new Date();
    return this.save();
  }
  return Promise.reject(new Error('OTP can only be regenerated for accepted bookings'));
};

// Method to check if OTP should be regenerated (daily check)
bookingSchema.methods.shouldRegenerateOTP = function () {
  if (!this.otpActive || !this.otpGeneratedAt) return false;

  const now = new Date();
  const otpDate = new Date(this.otpGeneratedAt);

  // Check if it's a new day
  return now.toDateString() !== otpDate.toDateString();
};

// Static method to regenerate daily OTPs
bookingSchema.statics.regenerateDailyOTPs = async function () {
  try {
    const activeBookings = await this.find({
      otpActive: true,
      status: { $in: ["confirmed", "in_progress", "accepted", "paused"] },
    });

    const updates = [];
    for (const booking of activeBookings) {
      if (booking.shouldRegenerateOTP()) {
        booking.otp = generateOTP();
        booking.otpGeneratedAt = new Date();
        updates.push(booking.save());
      }
    }

    await Promise.all(updates);
    console.log(`Regenerated OTPs for ${updates.length} bookings`);
  } catch (error) {
    console.error('Error regenerating daily OTPs:', error);
  }
};

// Static method to generate OTPs for existing bookings without OTP
bookingSchema.statics.generateMissingOTPs = async function () {
  try {
    const bookingsWithoutOTP = await this.find({
      status: { $in: ["confirmed", "in_progress", "accepted", "paused"] },
      partner: { $exists: true },
      $or: [
        { otp: { $exists: false } },
        { otp: '' },
        { otp: null }
      ]
    });

    const updates = [];
    for (const booking of bookingsWithoutOTP) {
      booking.otp = generateOTP();
      booking.otpGeneratedAt = new Date();
      booking.otpActive = true;
      if (!booking.acceptedAt) {
        booking.acceptedAt = new Date();
      }
      updates.push(booking.save());
    }

    await Promise.all(updates);
    console.log(`Generated OTPs for ${updates.length} existing bookings`);
    return updates.length;
  } catch (error) {
    console.error('Error generating missing OTPs:', error);
    throw error;
  }
};

// Remove any existing indexes
bookingSchema.on("index", function (err) {
  if (err) {
    console.error("Booking index error: %s", err);
  } else {
    console.info("Booking indexing complete");
  }
});

// Indexes for performance optimization
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ subService: 1 });
bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ partner: 1 }); // Index added to efficiently fetch partner's bookings
bookingSchema.index({ otpActive: 1, status: 1 }); // Index for OTP operations
bookingSchema.index({ isTemporary: 1, expiresAt: 1 }); // Index for temporary booking cleanup
bookingSchema.index({ txnid: 1 }); // Index for transaction lookup

// Check if model already exists before defining
const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

module.exports = Booking;