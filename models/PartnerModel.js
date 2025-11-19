const mongoose = require("mongoose");

// Partner Model
const partnerSchema = new mongoose.Schema(
  {
    bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    subService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubService",
    },

    kyc: {
      panCard: String,
      aadhaar: String,
      chequeImage: String,
      drivingLicence: String,
      bill: String,
      aadhaarback: String,
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      remarks: String,
    },
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String,
      chequeImage: String,
    },
    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceCategory",
        required: function () {
          return this.profileCompleted;
        },
      },
    ],
    categoryNames: {
      type: [String],
      default: []
    },
    subcategory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory",
        required: function () {
          return this.profileCompleted;
        },
      },
    ],
    service: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: function () {
          return this.profileCompleted;
        },
      },
    ],
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    whatsappNumber: String,
    qualification: String,
    experience: String,
    modeOfService: {
      type: String,
      enum: ["online", "offline", "both"],
      required: function () {
        return this.profileCompleted;
      },
      default: "offline",
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    profileStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    profile: {
      name: {
        type: String,
        required: function () {
          return this.profileCompleted;
        },
        trim: true,
      },
      email: {
        type: String,
        required: function () {
          return this.profileCompleted;
        },
        trim: true,
        lowercase: true,
      },
      address: {
        type: String,
        required: function () {
          return this.profileCompleted;
        },
      },
      landmark: {
        type: String,
        required: function () {
          return this.profileCompleted;
        },
      },
      pincode: {
        type: String,
        required: function () {
          return this.profileCompleted;
        },
      },
      registerAmount:{
        type: Number,
        default:0
      },
      payId:{
        type:String
      },
      paidBy:{
        type:String,
        default:"Self"
      },

      registerdFee:{
        type:Boolean,
        default:false  
      },
      city: {
        type: String,
      },
      gstNumber: {
        type: String,
        trim: true,
        uppercase: true,
      },
    },
    profilePicture: String,

    // Add OTP fields
    tempOTP: {
      type: String,
      select: false, // Ensure it is only retrieved when explicitly selected
    },
    otpExpiry: {
      type: Date,
      select: false, // Ensures it is fetched only when explicitly requested
    },
    fcmtoken: {
      type: String,
    },
    agentName: {
      type: String,
    },
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },

    },
    drive: {
      type: Boolean,
      default: false,
    },
    tempoTraveller: {
      type: Boolean,
      default: false,
    },
    referralCode: {
      type: String,
      unique: true,
      default: () => {
        return `NEXO${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      },
    },
    totalEarnRe:{
      type:Number,
      default:0
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
    },
    referredPartners: [{
      partner:{type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
    },
      name: String,
      phone: String,
    }],
    // MG Plan subscription
    mgPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MGPlan",
      default: null
    },
    mgPlanSubscribedAt: {
      type: Date,
      default: null
    },
    mgPlanExpiresAt: {
      type: Date,
      default: null
    },
    mgPlanLeadQuota: {
      type: Number,
      default: 0
    },
    mgPlanLeadsUsed: {
      type: Number,
      default: 0
    },
    mgPlanHistory: {
      type: [
        {
          plan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MGPlan"
          },
          planName: String,
          price: Number,
          leadsGuaranteed: Number,
          commissionRate: Number,
          leadFee: Number,
          subscribedAt: Date,
          expiresAt: Date,
          leadsConsumed: {
            type: Number,
            default: 0
          },
          refundStatus: {
            type: String,
            enum: ['pending', 'eligible', 'processed', 'expired'],
            default: 'pending'
          },
          refundNotes: String
        }
      ],
      default: []
    },
    leadAcceptancePaused: {
      type: Boolean,
      default: false
    },
    serviceHubs: {
      type: [
        {
          _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
          name: { type: String, required: true, trim: true },
          pinCodes: {
            type: [String],
            default: [],
            set: (pins) =>
              Array.from(
                new Set(
                  (pins || [])
                    .map((pin) => (pin || '').toString().trim())
                    .filter((pin) => pin.length > 0)
                )
              )
          },
          services: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service"
          }],
          isPrimary: {
            type: Boolean,
            default: false
          },
          createdAt: {
            type: Date,
            default: Date.now
          }
        }
      ],
      default: []
    },
    // Reference to Hub model for hub management
    hubs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hub"
    }],
    // Add Reviews Field
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
        rating: { type: Number, required: true },
        comment: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // Terms & Conditions acceptance
    terms: {
      accepted: {
        type: Boolean,
        default: false
      },
      signature: {
        type: String, // Base64 image or file path
        default: null
      },
      acceptedAt: {
        type: Date,
        default: null
      }
    },
  },
  { timestamps: true }
);

const Partner = mongoose.model("Partner", partnerSchema);
module.exports = Partner;
