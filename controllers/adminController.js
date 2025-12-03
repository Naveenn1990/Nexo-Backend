const Admin = require("../models/admin");
const Partner = require("../models/PartnerModel");
const User = require("../models/User");
const booking = require("../models/booking");
const Review = require("../models/Review"); // Assuming Review model is defined in a separate file
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ServiceCategory = require("../models/ServiceCategory");
const Service = require("../models/Service");
const SubService = require("../models/SubService");
const path = require('path');
const SubCategory = require("../models/SubCategory"); // Assuming SubCategory model is defined in a separate file
const PartnerProfile = require("../models/PartnerProfile");
const mongoose = require("mongoose");
const { uploadFile2 } = require("../middleware/aws");
const Notification = require("../models/Notification");
const dayjs = require("dayjs");
const { PaymentTransaction } = require("../models/RegisterFee");
const { sendPartnerNotification, sendAdminNotification } = require("../services/notificationService");



exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if admin or subadmin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token with role and permissions
    const token = jwt.sign(
      {
        adminId: admin._id,
        role: admin.role,
        permissions: admin.permissions,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Prepare admin data for response
    const adminData = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      createdBy: admin.createdBy,
      notifications: admin.notifications,
    };

    res.status(200).json({
      message: `${admin.role} logged in successfully`,
      token,
      admin: adminData,
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    res.status(500).json({ message: "Login failed" });
  }
};



exports.createMainAdmin = async (req, res) => {
  try {
    // Check if a main admin already exists
    const existingMainAdmin = await Admin.findOne({ role: "admin" });
    if (existingMainAdmin) {
      return res.status(400).json({ message: "Main admin already exists" });
    }

    // Main admin details
    const { email, password, name } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // All permissions set to true
    const allPermissions = {
      dashboard: true,
      subadmin: true,
      banner: true,
      categories: true,
      subCategories: true,
      services: true,
      subServices: true,
      offers: true,
      productInventory: true,
      booking: true,
      refundRequest: true,
      reviews: true,
      customer: true,
      providerVerification: true,
      verifiedProvider: true,
      enquiry: true,
      complaintToken: true,
      providerregisterfee: true,
      transaction: true,
      referralAmount: true,
    };

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create main admin
    const mainAdmin = new Admin({
      email,
      password: hashedPassword,
      name,
      role: "admin",
      permissions: allPermissions,
    });

    await mainAdmin.save();

    res.status(201).json({
      message: "Main admin created successfully",
      mainAdmin: {
        name: mainAdmin.name,
        email: mainAdmin.email,
        role: mainAdmin.role,
        permissions: mainAdmin.permissions,
      },
    });
  } catch (error) {
    console.error("Create Main Admin Error:", error);
    res.status(500).json({ message: "Error creating main admin" });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    if (req.admin.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    // console.log("req.body : " , req.body)
    const { email, password, name, permissions } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Subadmin already exists" });
    }

    const validModules = [
      "dashboard",
      "subadmin",
      "banner",
      "categories",
      "subCategories",
      "services",
      "subServices",
      "offers",
      "orders",
      "productInventory",
      "booking",
      "refundRequest",
      "reviews",
      'transaction',
      "promotionalVideo",
      "customer",
      "providerVerification",
      "verifiedProvider",
      "enquiry",
      "complaintToken",
      "providerregisterfee",
      "referralAmount",
    ];

    const filteredPermissions = {};
    validModules.forEach((module) => {
      filteredPermissions[module] = permissions?.[module] || false;
    });

    // console.log("filteredPermissions : " , filteredPermissions)

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new subadmin
    const subadmin = new Admin({
      email,
      password: hashedPassword,
      name,
      role: "subadmin",
      permissions: filteredPermissions,
      // createdBy: req.admin._id, // Tracks which admin created this subadmin
    });

    // console.log("subadmin : " , subadmin)

    await subadmin.save();

    res.status(201).json({
      message: "Subadmin created successfully",
      subadmin
    });
  } catch (error) {
    console.error("Create Subadmin Error:", error);
    res.status(500).json({ message: "Error creating subadmin" });
  }
};

// Get all Admin profiles
exports.getProfiles = async (req, res, next) => {
  try {
    // console.log("Getting profile for admin:", req.admin._id);

    // if (!req.admin || !req.admin._id) {
    //   throw new Error("User not authenticated");
    // }

    const admins = await Admin.find()
    // .select("-password -tempOTP -tempOTPExpiry")
    // .lean();

    if (!admins) {
      console.log("Admin : ", admins)
      const error = new Error("Admin not found");
      error.statusCode = 404;
      throw error;
    }
    res.json({
      success: true,
      admins,
    });
  } catch (error) {
    console.error("Get Profile Error:", {
      error: error.message,
      stack: error.stack,
      // adminId: req.admin?._id,
    });

    next(error);
  }
};

// Get Admin profile
exports.getProfile = async (req, res, next) => {
  try {
    console.log("Getting profile for admin:", req.admin._id);

    if (!req.admin || !req.admin._id) {
      throw new Error("User not authenticated");
    }

    const admin = await Admin.findById(req.admin._id)
      .select("-password -tempOTP -tempOTPExpiry")
      .lean();

    if (!admin) {
      console.log("Admin : ", admin)
      const error = new Error("Admin not found");
      error.statusCode = 404;
      throw error;
    }
    res.json({
      success: true,
      admin,
    });
  } catch (error) {
    console.error("Get Profile Error:", {
      error: error.message,
      stack: error.stack,
      // adminId: req.admin?._id,
    });

    next(error);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { subadminId } = req.params; // Get subadmin ID from URL
    const { name, email, password, permissions } = req.body;
    console.log("Req Body : ", req.body)

    // Find subadmin by ID and ensure they exist
    const subadmin = await Admin.findById(subadminId);
    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    // Update fields if provided
    if (name) subadmin.name = name;
    if (email) subadmin.email = email;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      subadmin.password = hashedPassword;
    }

    // Update permissions if provided (deep merge to allow partial updates)
    if (permissions) {
      Object.keys(permissions).forEach((key) => {
        if (subadmin.permissions.hasOwnProperty(key)) {
          subadmin.permissions[key] = permissions[key];
        }
      });
    }

    // Save updated subadmin
    await subadmin.save();

    res.status(200).json({
      message: "Subadmin updated successfully",
      subadmin,
    });
  } catch (error) {
    console.error("Update Subadmin Error:", error);
    res.status(500).json({ message: "Failed to update subadmin" });
  }
};

// Delete Subadmin by ID
exports.deleteProfile = async (req, res) => {
  try {
    const { subadminId } = req.params;

    // Find and delete subadmin
    const deletedSubadmin = await Admin.findOneAndDelete({
      _id: subadminId,
      role: "subadmin",
    });

    if (!deletedSubadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    res.status(200).json({
      message: "Subadmin deleted successfully",
      deletedSubadmin,
    });
  } catch (error) {
    console.error("Delete Subadmin Error:", error);
    res.status(500).json({ message: "Failed to delete subadmin" });
  }
};

// Get Dashboard Analytics
exports.getDashboardAnalytics = async (req, res) => {
  try {
    // Get partner counts by status
    const partnerStatusCounts = await Partner.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get KYC stats
    const kycStats = await Partner.aggregate([
      {
        $group: {
          _id: "$kycStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRegistrations = await Partner.find({
      createdAt: { $gte: sevenDaysAgo },
    })
      .select("phone profile.name status createdAt")
      .sort({ createdAt: -1 })
      .limit(10);

    // Get daily registration counts for the last 7 days
    const dailyRegistrations = await Partner.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get KYC verification stats
    const kycVerificationStats = await Partner.aggregate([
      {
        $match: {
          kycDetails: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$kycDetails.isVerified",
          count: { $sum: 1 },
          avgVerificationTime: {
            $avg: {
              $cond: [
                { $and: ["$kycDetails.verifiedAt", "$kycDetails.submittedAt"] },
                {
                  $subtract: [
                    "$kycDetails.verifiedAt",
                    "$kycDetails.submittedAt",
                  ],
                },
                null,
              ],
            },
          },
        },
      },
    ]);

    res.json({
      partnerStats: {
        total: partnerStatusCounts.reduce((acc, curr) => acc + curr.count, 0),
        byStatus: Object.fromEntries(
          partnerStatusCounts.map(({ _id, count }) => [_id, count])
        ),
      },
      kycStats: {
        total: kycStats.reduce((acc, curr) => acc + curr.count, 0),
        byStatus: Object.fromEntries(
          kycStats.map(({ _id, count }) => [_id, count])
        ),
        verificationStats: {
          verified:
            kycVerificationStats.find((stat) => stat._id === true)?.count || 0,
          pending:
            kycVerificationStats.find((stat) => stat._id === false)?.count || 0,
          avgVerificationTime:
            kycVerificationStats.find((stat) => stat._id === true)
              ?.avgVerificationTime || 0,
        },
      },
      registrationStats: {
        recentPartners: recentRegistrations,
        dailyTrend: dailyRegistrations,
      },
    });
  } catch (error) {
    console.error("Dashboard Analytics Error:", error);
    res.status(500).json({ message: "Error fetching dashboard analytics" });
  }
};

// Get Dashboard Counts - Optimized for quick loading
exports.getDashboardCounts = async (req, res) => {
  try {
    // Use Promise.all to fetch all counts in parallel for better performance
    const [
      usersCount,
      partnersCount,
      bookingsCount,
      subServicesCount,
      monthlyBookingData,
      monthlyRevenueData,
      bookingStats
    ] = await Promise.all([
      // Users count
      User.countDocuments(),
      
      // Partners count
      Partner.countDocuments(),
      
      // Bookings count
      booking.countDocuments(),
      
      // Sub-services count (try both approaches)
      Promise.all([
        SubService.countDocuments().catch(() => 0),
        Service.aggregate([
          { $unwind: "$subServices" },
          { $count: "total" }
        ]).then(result => result[0]?.total || 0).catch(() => 0)
      ]).then(([subServiceCount, embeddedCount]) => {
        // Use the higher count or SubService count if available
        return subServiceCount > 0 ? subServiceCount : embeddedCount;
      }).catch(() => 0),
      
      // Monthly booking data for charts (last 6 months)
      booking.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),
      
      // Monthly revenue data for charts (last 6 months)
      booking.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            revenue: { $sum: "$amount" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),
      
      // Booking status statistics
      booking.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Process monthly data for charts
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                       "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Create a map for quick lookup
    const monthlyBookingMap = {};
    monthlyBookingData.forEach(item => {
      const monthKey = `${item._id.year}-${item._id.month}`;
      monthlyBookingMap[monthKey] = item.count;
    });
    
    const monthlyRevenueMap = {};
    monthlyRevenueData.forEach(item => {
      const monthKey = `${item._id.year}-${item._id.month}`;
      monthlyRevenueMap[monthKey] = item.revenue || 0;
    });

    // Generate last 6 months data
    const currentDate = new Date();
    const lastSixMonths = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const monthName = monthNames[date.getMonth()];
      
      lastSixMonths.push({
        month: monthName,
        bookings: monthlyBookingMap[monthKey] || 0,
        revenue: monthlyRevenueMap[monthKey] || 0
      });
    }

    // Process booking statistics
    const bookingStatusStats = {
      completed: 0,
      pending: 0,
      cancelled: 0,
      total: bookingsCount
    };
    
    bookingStats.forEach(stat => {
      if (stat._id === 'completed') bookingStatusStats.completed = stat.count;
      else if (stat._id === 'pending') bookingStatusStats.pending = stat.count;
      else if (stat._id === 'cancelled') bookingStatusStats.cancelled = stat.count;
    });

    res.json({
      success: true,
      data: {
        counts: {
          users: usersCount,
          partners: partnersCount,
          bookings: bookingsCount,
          subServices: subServicesCount
        },
        charts: {
          monthlyBookings: lastSixMonths.map(item => ({
            month: item.month,
            bookings: item.bookings
          })),
          monthlyRevenue: lastSixMonths.map(item => ({
            month: item.month,
            revenue: item.revenue
          })),
          bookingStats: [bookingStatusStats]
        },
        bookingStats: bookingStatusStats
      }
    });
  } catch (error) {
    console.error("Dashboard Counts Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching dashboard counts",
      error: error.message 
    });
  }
};

// Get pending KYC verifications
// Get pending KYC verifications
exports.getPendingKYC = async (req, res) => {
  try {
    const pendingPartners = await Partner.find({
      kyc: { $exists: true },
      "kyc.status": "Pending", // Ensuring we fetch only pending verifications
    }).select("phone profile kyc createdAt");

    const formattedPartners = pendingPartners.map((partner) => ({
      id: partner._id,
      phone: partner.phone,
      name: partner.profile?.name || "N/A",
      email: partner.profile?.email || "N/A",
      createdAt: partner.createdAt,
      KYC: {
        status: partner.kyc?.status || "Pending",
        panCard: partner.kyc?.panCard || "Not Uploaded",
        aadhaar: partner.kyc?.aadhaar || "Not Uploaded",
        drivingLicence: partner.kyc?.drivingLicence || "Not Uploaded",
        bill: partner.kyc?.bill || "Not Uploaded",
      },
    }));

    res.json({
      count: pendingPartners.length,
      partners: formattedPartners,
    });
  } catch (error) {
    console.error("Pending KYC Error:", error);
    res.status(500).json({ message: "Error fetching pending KYC verifications" });
  }
};


// Get partner KYC details
exports.getPartnerKYC = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const partner = await Partner.findById(partnerId)
      .select('phone profile kycDetails createdAt')
      .populate('profile');

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found"
      });
    }

    res.json({
      success: true,
      data: {
        partnerId: partner._id,
        phone: partner.phone,
        profile: partner.profile,
        kycDetails: partner.kycDetails,
        createdAt: partner.createdAt
      }
    });
  } catch (error) {
    console.error("Get Partner KYC Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching partner KYC details"
    });
  }
};

// Verify partner KYC
exports.verifyPartnerKYC = async (req, res) => {
  try {
    const { partnerId } = req.params;
    console.log("Received Partner ID:", partnerId);

    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ success: false, message: "Invalid Partner ID format" });
    }

    const partner = await Partner.findById(partnerId);
    console.log("Fetched Partner:", partner);

    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }
    partner.kyc.status = 'approved'
    await partner.save()

    // Send notification to partner
    await sendPartnerNotification(
      partnerId,
      'KYC Approved',
      `Your KYC verification has been approved. You can now start accepting bookings.`,
      'success',
      '/android-chrome-192x192.png'
    );

    // Notify admin who verified
    if (req.admin) {
      await sendAdminNotification(
        req.admin._id,
        'KYC Verified',
        `Partner ${partner.profile?.name || partner.phone} KYC has been verified.`,
        'info',
        '/android-chrome-192x192.png'
      );
    }

    res.json({ success: true, message: "Partner found", partner });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};



// Get all partners
exports.getAllPartners = async (req, res) => {
  try {
    // Extract query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || ''; // Optional: filter by status (active, pending, suspended, etc.)

    // Build search query
    const query = {};
    
    if (search) {
      query.$or = [
        { 'profile.name': { $regex: search, $options: 'i' } },
        { 'profile.email': { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } },
        { 'profile.city': { $regex: search, $options: 'i' } },
        { 'profile.pincode': { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by status if provided
    if (status) {
      if (status === 'approved' || status === 'active') {
        query['kyc.status'] = 'approved';
      } else if (status === 'pending') {
        query['kyc.status'] = { $in: ['pending', null] };
      } else if (status === 'rejected') {
        query['kyc.status'] = 'rejected';
      } else if (status === 'suspended') {
        query.status = 'suspended';
      }
    }

    // Get total count for pagination
    const total = await Partner.countDocuments(query);

    // Fetch partners with pagination
    const partners = await Partner.find(query)
      .populate("bookings")
      .populate("category")
      .populate("subcategory")
      .populate("service")
      .populate("kyc")
      .populate("mgPlan", "name price leads commission leadFee minWalletBalance")
      .populate("reviews.user", "name email")
      .populate("reviews.booking")
      .select("-tempOTP")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    // Process each partner
    const formattedPartners = await Promise.all(
      partners.map(async (partner) => {
        // Month-wise booking count
        const bookingCounts = await booking.aggregate([
          { $match: { partner: partner._id } },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]);

        const monthWiseBookings = {};
        bookingCounts.forEach((entry) => {
          const monthName = new Date(entry._id.year, entry._id.month - 1).toLocaleString("default", { month: "long" });
          monthWiseBookings[monthName] = entry.count;
        });

        // Calculate earnings from completed bookings
        const completedBookings = await booking.find({
          partner: partner._id,
          status: "completed",
        }).populate({
          path: "subService",
          select: "name price duration description commission",
        });

        let totalEarnings = 0;
        let transactions = completedBookings.map((booking) => {
          const subService = booking.subService;

          const totalAmount = booking.amount || 0;
          const commissionPercentage = subService ? subService.commission || 0 : 0;
          const commissionAmount = (commissionPercentage / 100) * totalAmount;
          const partnerEarnings = totalAmount - commissionAmount;
          totalEarnings += partnerEarnings;

          return {
            bookingId: booking._id,
            subService: subService?.name || "N/A",
            totalAmount,
            commissionPercentage,
            commissionAmount,
            partnerEarnings,
            paymentMode: booking.paymentMode,
            status: booking.status,
            completedAt: booking.completedAt,
          };
        });

        return {
          Profile: {
            id: partner._id,
            name: partner.profile?.name || "N/A",
            email: partner.profile?.email || "N/A",
            phone: partner.phone,
            address: partner.profile?.address || "N/A",
            landmark: partner.profile?.landmark || "N/A",
            pincode: partner.profile?.pincode || "N/A",
            experience: partner.experience || "N/A",
            qualification: partner.qualification || "N/A",
            partnerType: partner.partnerType || "individual",
            modeOfService: partner.modeOfService || "N/A",
            profileCompleted: partner.profileCompleted,
            agentName: partner.agentName,
            profilePicture: partner.profilePicture ? `/uploads/profiles/${partner.profilePicture}` : "N/A",
            createdAt: partner.createdAt,
            updatedAt: partner.updatedAt,
            KYC: {
              status: partner?.kyc?.status || partner?.status || "pending",
              panCard: partner.kyc?.panCard ? `/uploads/kyc/${partner.kyc?.panCard}` : "Not Uploaded",
              aadhaar: partner.kyc?.aadhaar ? `/uploads/kyc/${partner.kyc?.aadhaar}` : "Not Uploaded",
              drivingLicence: partner.kyc?.drivingLicence ? `/uploads/kyc/${partner.kyc?.drivingLicence}` : "Not Uploaded",
              bill: partner.kyc?.bill ? `/uploads/kyc/${partner.kyc.bill}` : "Not Uploaded",
            },
          },
          Bookings: partner.bookings.length > 0 ? partner.bookings : "No bookings",
          Reviews: partner.reviews.length > 0 ? partner.reviews : "No reviews",
          Services: partner.service.length > 0 ? partner.service : "No services",
          MonthWiseBookingCount: monthWiseBookings,
          completedBookings: completedBookings,
          Earnings: {
            totalEarnings,
            transactions,
          },
          registerAmount: partner.registerAmount || 0,
          payId: partner.payId || "N/A",
          paidBy: partner.paidBy || "N/A",
          mgPlan: partner.mgPlan || null,
          mgPlanLeadQuota: partner.mgPlanLeadQuota || 0,
          mgPlanLeadsUsed: partner.mgPlanLeadsUsed || 0,
          mgPlanSubscribedAt: partner.mgPlanSubscribedAt || null,
          mgPlanExpiresAt: partner.mgPlanExpiresAt || null,
          mgPlanHistory: partner.mgPlanHistory || [],
        };
      })
    );

    res.json({ 
      partners: formattedPartners, 
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Get Partners Error:", error);
    res.status(500).json({ message: "Error fetching partners" });
  }
};

// Get partner revenue statistics
exports.getPartnerRevenueStats = async (req, res) => {
  try {
    // Calculate total registration fees from PaymentTransaction collection
    const registrationTransactions = await PaymentTransaction.find({
      feeType: 'registration',
      status: 'success'
    }).lean();
    
    const totalRegistrationFees = registrationTransactions.reduce((sum, txn) => {
      return sum + (txn.amount || 0);
    }, 0);

    // Get all partners for security deposit, toolkit, and MG Plan revenue calculation
    const allPartners = await Partner.find({})
      .select('securityDeposit toolkitPrice mgPlanHistory')
      .lean();

    // Calculate total security deposit fees from Partner model
    let totalSecurityDepositFromPartners = allPartners.reduce((sum, partner) => {
      return sum + (partner.securityDeposit || 0);
    }, 0);

    // Calculate total toolkit fees from Partner model
    let totalToolkitFromPartners = allPartners.reduce((sum, partner) => {
      return sum + (partner.toolkitPrice || 0);
    }, 0);

    // Also check PaymentTransaction metadata for security deposit and toolkit
    // (in case they're stored there instead of Partner model)
    const allTransactions = await PaymentTransaction.find({
      status: 'success'
    }).lean();

    let totalSecurityDepositFromTransactions = 0;
    let totalToolkitFromTransactions = 0;

    allTransactions.forEach((txn) => {
      if (txn.metadata && txn.metadata.priceBreakdown) {
        totalSecurityDepositFromTransactions += txn.metadata.priceBreakdown.securityDeposit || 0;
        totalToolkitFromTransactions += txn.metadata.priceBreakdown.toolkitPrice || 0;
      }
    });

    // Use whichever source has data (prefer Partner model, fallback to transactions)
    const totalSecurityDeposit = totalSecurityDepositFromPartners > 0 
      ? totalSecurityDepositFromPartners 
      : totalSecurityDepositFromTransactions;
    
    const totalToolkitFees = totalToolkitFromPartners > 0 
      ? totalToolkitFromPartners 
      : totalToolkitFromTransactions;

    // Calculate total MG Plan revenue
    const totalMGPlanRevenue = allPartners.reduce((sum, partner) => {
      if (partner.mgPlanHistory && Array.isArray(partner.mgPlanHistory)) {
        const mgPlanTotal = partner.mgPlanHistory.reduce((planSum, plan) => {
          return planSum + (plan.price || 0);
        }, 0);
        return sum + mgPlanTotal;
      }
      return sum;
    }, 0);

    // Calculate total partner earnings from completed bookings
    const completedBookings = await booking.find({ status: "completed" })
      .populate('subService', 'commission')
      .lean();

    let totalPartnerEarnings = 0;
    completedBookings.forEach((bkg) => {
      const totalAmount = bkg.amount || 0;
      const commissionPercentage = bkg.subService?.commission || 0;
      const commissionAmount = (commissionPercentage / 100) * totalAmount;
      const partnerEarnings = totalAmount - commissionAmount;
      totalPartnerEarnings += partnerEarnings;
    });

    // Total revenue = Registration + Security Deposit + Toolkit + MG Plans + Partner Earnings
    const totalRevenue = totalRegistrationFees + totalSecurityDeposit + totalToolkitFees + totalMGPlanRevenue + totalPartnerEarnings;

    res.json({
      success: true,
      stats: {
        totalRegistrationFees,
        totalSecurityDeposit,
        totalToolkitFees,
        totalMGPlanRevenue,
        totalPartnerEarnings,
        totalRevenue
      }
    });
  } catch (error) {
    console.error("Get Partner Revenue Stats Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching partner revenue statistics" 
    });
  }
};

// Get partner details
// Get partner details along with earnings and transactions
exports.getPartnerDetails = async (req, res) => {
  try {
    const { partnerId } = req.params;

    // Fetch partner details with all populated data
    const partner = await Partner.findById(partnerId)
      .select("-tempOTP")
      .populate({
        path: "bookings",
        populate: [
          {
            path: "subService",
            model: "SubService",
            select: "name price duration description commission",
          },
          {
            path: "user",
            model: "User",
            select: "name phone email",
          },
          {
            path: "service",
            select: "name",
          },
          {
            path: "subCategory",
            select: "name",
          },
          {
            path: "category",
            select: "name",
          },
        ],
      })
      .populate({
        path: "category",
        select: "name description icon",
      })
      .populate({
        path: "subcategory",
        select: "name description",
      })
      .populate({
        path: "service",
        select: "name description basePrice duration",
      })
      .populate({
        path: "mgPlan",
        select: "name price leads commission leadFee minWalletBalance refundPolicy validityType validityMonths",
      })
      .populate({
        path: "hubs",
        select: "name areas city state description status",
      })
      .select("-__v");

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Fetch completed bookings for earnings
    const completedBookings = partner.bookings.filter(
      (booking) => booking.status === "completed"
    );

    let totalEarnings = 0;
    let transactions = completedBookings.map((booking) => {
      const subService = booking.subService;
      const totalAmount = booking.amount;
      const commissionAmount = ((subService?.commission || 0) / 100) * totalAmount;
      const partnerEarnings = totalAmount - commissionAmount;
      totalEarnings += partnerEarnings;

      return {
        bookingId: booking._id,
        user: booking.user,
        subService: subService?.name || "N/A",
        service: booking.service?.name,
        subCategory: booking.subCategory?.name,
        category: booking.category?.name,
        totalAmount,
        commissionPercentage: (subService?.commission || 0),
        commissionAmount,
        partnerEarnings,
        paymentMode: booking.paymentMode,
        status: booking.status,
        completedAt: booking.completedAt,
      };
    });

    // Include terms data if it exists
    const partnerData = partner.toObject();
    if (partnerData.terms) {
      partnerData.terms = partnerData.terms;
    } else if (partnerData.partnerTerms) {
      partnerData.terms = partnerData.partnerTerms;
    }
    
    // Ensure categoryNames is included and properly formatted
    if (!partnerData.categoryNames || partnerData.categoryNames.length === 0) {
      // Extract category names from populated category objects
      if (partnerData.category && partnerData.category.length > 0) {
        partnerData.categoryNames = partnerData.category
          .map(cat => cat?.name || cat?.description)
          .filter(Boolean);
      }
    }
    
    // If hubs array is empty or not populated, but serviceHubs has data, use serviceHubs
    if ((!partnerData.hubs || partnerData.hubs.length === 0) && partnerData.serviceHubs && partnerData.serviceHubs.length > 0) {
      console.log('Using serviceHubs as fallback for hubs display');
      // Map serviceHubs to a format compatible with the hubs display
      partnerData.displayHubs = partnerData.serviceHubs.map(sh => ({
        _id: sh.hubId || sh._id,
        name: sh.name,
        areas: sh.pinCodes ? [{
          areaName: 'Service Area',
          pinCodes: sh.pinCodes
        }] : []
      }));
    } else if (partnerData.hubs && partnerData.hubs.length > 0) {
      partnerData.displayHubs = partnerData.hubs;
    }
    
    // Log for debugging
    console.log('Partner Details Response:', {
      partnerId: partnerData._id,
      categoryCount: partnerData.category?.length || 0,
      categoryNamesCount: partnerData.categoryNames?.length || 0,
      categoryNames: partnerData.categoryNames,
      paymentData: {
        registerAmount: partnerData?.profile?.registerAmount || 0,
        payId: partnerData?.profile?.payId || "N/A",
        paidBy: partnerData?.profile?.paidBy || "N/A",
        registerdFee: partnerData?.profile?.registerdFee || false,
        paymentApproved: partnerData?.profile?.paymentApproved || false,
        securityDeposit: partnerData?.profile?.securityDeposit || 0,
        toolkitPrice: partnerData?.profile?.toolkitPrice || 0
      },
      // partnerData
    });
    
    res.json({ partner: partnerData, totalEarnings, transactions });
  } catch (error) {
    console.error("Get Partner Details Error:", error);
    res.status(500).json({ message: "Error fetching partner details" });
  }
};

//get partner details 
exports.getPartnerProfile = async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Partner ID is missing",
      });
    }

    const partnerId = new mongoose.Types.ObjectId(id);

    const profile = await Partner.findOne({ _id: partnerId })
      .populate("category", "name description")
      .populate("service", "name description basePrice duration")
      // .populate("subcategory")
      .populate("subcategory", "name description")


    // console.log("Fetched Profile:", profile);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.json({
      success: true,
      profile: {
        city: profile.profile.city,
        id: profile._id,
        name: profile.profile?.name || "N/A",
        email: profile.profile?.email || "N/A",
        phone: profile.phone,
        whatsappNumber: profile.whatsappNumber,
        qualification: profile.qualification,
        experience: profile.experience,
        subcategory: profile.subcategory,
        category: profile.category,
        service: profile.service,
        modeOfService: profile.modeOfService,
        profilePicture: profile.profilePicture,
        status: profile.profileCompleted ? "Completed" : "Incomplete",
        drive: profile.drive,
        tempoTraveller: profile.tempoTraveller
      },
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
    });
  }
};

// Update Partner KYC Status
exports.updatePartnerStatus = async (req, res) => {
  try {
    const { partnerId } = req.params;
    let { status, remarks } = req.body;

    console.log(req.body, "req body");

    // Clean and normalize status
    status = status?.trim().toLowerCase();

    // Validate status
    const validStatuses = ["pending", "approved", "rejected"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Check if partner exists
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found"
      });
    }

    // Perform update to nested kyc fields
    const updatedPartner = await Partner.findByIdAndUpdate(
      partnerId,
      {
        $set: {
          'kyc.status': status,
          'kyc.remarks': remarks || ''
        }
      },
      { new: true, runValidators: true }
    );

    // Send notification to partner based on status
    let notificationTitle, notificationMessage, notificationType;
    if (status === 'approved') {
      notificationTitle = 'KYC Approved';
      notificationMessage = `Your KYC verification has been approved. You can now start accepting bookings.${remarks ? ` Remarks: ${remarks}` : ''}`;
      notificationType = 'success';
    } else if (status === 'rejected') {
      notificationTitle = 'KYC Rejected';
      notificationMessage = `Your KYC verification has been rejected.${remarks ? ` Reason: ${remarks}` : ' Please contact support for more information.'}`;
      notificationType = 'alert';
    } else {
      notificationTitle = 'KYC Status Updated';
      notificationMessage = `Your KYC status has been updated to ${status}.${remarks ? ` Remarks: ${remarks}` : ''}`;
      notificationType = 'info';
    }

    await sendPartnerNotification(
      partnerId,
      notificationTitle,
      notificationMessage,
      notificationType,
      '/android-chrome-192x192.png'
    );

    // Notify admin who updated
    if (req.admin) {
      await sendAdminNotification(
        req.admin._id,
        'KYC Status Updated',
        `Partner ${updatedPartner.profile?.name || updatedPartner.phone} KYC status changed to ${status}.`,
        'info',
        '/android-chrome-192x192.png'
      );
    }

    res.json({
      success: true,
      message: `KYC status updated to "${status}" successfully`,
      data: {
        partnerId: updatedPartner._id,
        kycStatus: updatedPartner.kyc.status,
        kycRemarks: updatedPartner.kyc.remarks
      }
    });
  } catch (error) {
    console.error("Update Partner Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating KYC status",
      error: error.message
    });
  }
};


// Create Service Category
exports.createServiceCategory = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('File:', req.file);

    const { name, description } = req.body;

    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: "Name and description are required",
        receivedData: { name, description }
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Icon image is required"
      });
    }

    // Create icon path
    const iconPath = await uploadFile2(req.file, "category");

    const category = new ServiceCategory({
      name: name.trim(),
      description: description.trim(),
      icon: iconPath,
      status: true
    });

    console.log('Category to save:', category);

    const savedCategory = await category.save();
    console.log('Saved category:', savedCategory);

    res.status(201).json({
      success: true,
      message: "Service category created successfully",
      category: savedCategory
    });
  } catch (error) {
    console.error("Create Service Category Error Details:", {
      error: error.message,
      stack: error.stack,
      name: error.name
    });

    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A category with this name already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating service category",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create Service
exports.createService = async (req, res) => {
  try {
    // console.log('Request body:', req.body);
    // console.log('File:', req.file);

    const { name, description, category, basePrice, duration } = req.body;

    // Validate required fields
    if (!name || !description || !category || !basePrice || !duration) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        receivedData: { name, description, category, basePrice, duration }
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Icon image is required"
      });
    }

    // Validate category exists
    const serviceCategory = await ServiceCategory.findById(category);
    if (!serviceCategory) {
      return res.status(404).json({
        success: false,
        message: "Service category not found"
      });
    }

    // Create icon path
    const iconPath = await uploadFile2(req.file, "service");


    const service = new Service({
      category,
      name: name.trim(),
      description: description.trim(),
      icon: iconPath,
      basePrice: Number(basePrice),
      duration: Number(duration),
      status: 'active',
      tags: [],
      subServices: []
    });

    console.log('Service to save:', service);

    const savedService = await service.save();
    console.log('Saved service:', savedService);

    // Update category with the new service
    serviceCategory.services = serviceCategory.services || [];
    serviceCategory.services.push(savedService._id);
    await serviceCategory.save();

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      service: savedService
    });
  } catch (error) {
    console.error("Create Service Error Details:", {
      error: error.message,
      stack: error.stack,
      name: error.name
    });

    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A service with this name already exists in this category"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating service",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Add Sub-Service
exports.addSubService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, description, basePrice, duration } = req.body;



    if (!req.file) {
      return res.status(400).json({ message: "Icon is required" });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    let icon = await uploadFile2(req.file, "subservice");

    service.subServices.push({
      name,
      description,
      icon: icon,
      basePrice,
      duration
    });

    await service.save();
    res.status(201).json({ message: "Sub-service added successfully", service });
  } catch (error) {
    console.error("Add Sub-Service Error:", error);
    res.status(500).json({ message: "Failed to add sub-service" });
  }
};

// Get All Service Categories
exports.getAllServiceCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ status: true });
    res.json(categories);
  } catch (error) {
    console.error("Get Service Categories Error:", error);
    res.status(500).json({ message: "Failed to fetch service categories" });
  }
};

// Get Services by Category
exports.getServicesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const services = await Service.find({ category: categoryId, status: true });
    res.json(services);
  } catch (error) {
    console.error("Get Services Error:", error);
    res.status(500).json({ message: "Failed to fetch services" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      page = 1,
      limit = 5
    } = req.query;

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (status && status !== 'all') {
      query.status = status;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Get users with pagination
    const users = await User.find(query)
      .select('name email phone addresses status selectedAddress createdAt')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const userIds = users.map(user => user._id);

    // Get booking stats for the paginated users
    const bookingStats = await booking.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 },
          lastBookingDate: { $max: '$createdAt' }
        }
      }
    ]);

    const bookingMap = {};
    bookingStats.forEach(item => {
      bookingMap[item._id.toString()] = {
        count: item.count,
        lastBookingDate: item.lastBookingDate
      };
    });

    const formattedUsers = users.map((user, index) => {
      const bookingData = bookingMap[user._id.toString()] || {};
      return {
        slNo: skip + index + 1, // Adjusted for pagination
        _id: user._id,
        customerName: user.name,
        phoneNo: user.phone,
        email: user.email,
        address: user.addresses || "N/A",
        noOfBookings: bookingData.count || 0,
        lastBookingDate: bookingData.lastBookingDate
          ? dayjs(bookingData.lastBookingDate).format('DD MMM YYYY, hh:mm A')
          : "N/A",
        accountStatus: user.status,
        createdAt: user.createdAt,
        selectedAddress: user.selectedAddress || 'N/A'
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage,
        hasPrevPage,
        startIndex: skip + 1,
        endIndex: Math.min(skip + limitNum, total)
      },
      message: "Users fetched successfully"
    });

  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message
    });
  }
};


// Get bookings for a specific user
exports.getUserBookings = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get all bookings for the user with populated service details
    const bookings = await booking.find({ user: userId })
      .populate('service', 'name description icon basePrice duration')
      .populate('subService', 'name description icon price duration')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "User bookings fetched successfully",
      data: bookings
    });

  } catch (error) {
    console.error("Get User Bookings Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user bookings",
      error: error.message
    });
  }
};

// Complete a booking
exports.completeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Find the booking
    const bookingToComplete = await booking.findById(bookingId);
    if (!bookingToComplete) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // Check if booking is already completed
    if (bookingToComplete.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Booking is already completed"
      });
    }

    // Check if booking is cancelled
    if (bookingToComplete.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: "Cannot complete a cancelled booking"
      });
    }

    // Update booking status to completed
    bookingToComplete.status = 'completed';
    bookingToComplete.completedAt = new Date();
    await bookingToComplete.save();

    res.status(200).json({
      success: true,
      message: "Booking marked as completed",
      data: bookingToComplete
    });

  } catch (error) {
    console.error("Complete Booking Error:", error);
    res.status(500).json({
      success: false,
      message: "Error completing booking",
      error: error.message
    });
  }
};
// Get all team members (for admin)
exports.getAllTeamMembers = async (req, res) => {
  try {
    const TeamMember = require("../models/TeamMember");
    const { status = 'active' } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const teamMembers = await TeamMember.find(query)
      .populate({
        path: "partner",
        select: 'phone profile'
      })
      .populate("categories", "name")
      .populate("hubs", "name city state")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: teamMembers,
      count: teamMembers.length
    });
  } catch (error) {
    console.error("Get All Team Members Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching team members",
      error: error.message
    });
  }
};

//Assigned Booking

exports.assignedbooking = async (req, res) => {
  try {
    const { partnerId, bookingId, teamMemberId } = req.body;
    const book = await booking.findById(bookingId).populate("subService");
    // console.log("partnerId ,bookingId", partnerId, bookingId)
    if (!book) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // If team member is provided, assign to team member (which also sets partner)
    if (teamMemberId) {
      const TeamMember = require("../models/TeamMember");
      const teamMember = await TeamMember.findById(teamMemberId).populate('partner');
      if (!teamMember) {
        return res.status(404).json({ message: "Team member not found" });
      }
      book.teamMember = teamMemberId;
      book.partner = teamMember.partner._id || teamMember.partner;
    } else if (partnerId) {
      // Assign directly to partner
      book.partner = partnerId;
      book.teamMember = null; // Clear team member if assigning to partner directly
    } else {
      return res.status(400).json({ message: "Either partnerId or teamMemberId is required" });
    }

    const assignedPartnerId = partnerId || (teamMember?.partner?._id || teamMember?.partner);
    
    // Send notification to partner
    await sendPartnerNotification(
      assignedPartnerId,
      'New Booking Assigned',
      `You have been assigned a new booking: ${book.subService?.name || 'Service'}. Booking ID: ${bookingId}`,
      'job',
      '/android-chrome-192x192.png'
    );

    // Notify admin
    if (req.admin) {
      const partner = await Partner.findById(assignedPartnerId);
      await sendAdminNotification(
        req.admin._id,
        'Booking Assigned',
        `Booking ${bookingId} has been assigned to partner ${partner?.profile?.name || partner?.phone || 'Unknown'}.`,
        'info',
        '/android-chrome-192x192.png'
      );
    }

    book.status = "accepted"
    await book.save();

    res.json({ message: "Job accepted successfully", book });
  } catch (error) {
    console.error("Accept Job Error:", error);
    res.status(500).json({ message: "Error accepting job" });
  }
};
// Get all reviews
// Get all reviews
exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user') // Populate customer details
      .populate('subService') // Populate subService details
      .populate({
        path: 'booking', // Populate booking
        populate: {
          path: 'partner', // Populate partner from the booking
          // Select fields from partner
        }
      });

    // Format the response to include desired fields
    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      customer: {
        name: review.user?.name || 'Unknown',
        email: review.user?.email || 'Unknown'
      },
      subService: review.subService
        ? {
          name: review.subService.name,
          description: review.subService.description
        }
        : null,
      date: review.createdAt,
      partner: review.booking?.partner
        ? {
          name: review.booking.partner.name,
          email: review.booking.partner.email
        }
        : null,
      rating: review.rating,
      comment: review.comment,
      status: review.status // ✅ Make sure the status is included
    }));

    res.status(200).json({
      success: true,
      message: 'Fetched all reviews successfully',
      data: reviews
      // data: formattedReviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching reviews'
    });
  }
};

// Update review status
exports.updateReviewStatus = async (req, res) => {
  const { reviewId } = req.params;
  const { status } = req.body;
  console.log("Incoming Data :", req.params, req.body)

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: "Invalid status. Choose 'approved' or 'rejected'." });
  }

  try {
    const review = await Review.findByIdAndUpdate(
      reviewId,
      { status },
      { new: true }
    ).populate('partner', 'name').populate('booking', 'price date services');

    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    res.status(200).json({ message: `Review ${status} successfully`, review });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "Error updating review status", error: error.message });
  }
};


// Add Sub Category
exports.addSubCategory = async (req, res) => {
  // console.log("testing" , req.body , req.file)
  // console.log("Request Body:", req.body); // Log the request body
  // console.log("Uploaded File:", req.file); // Log the uploaded file

  const { name, category } = req.body; // Extracting name and category from the form data

  // Check if name and category are provided
  if (!name || !category) {
    console.log(name, category, "test")
    return res.status(400).json({ message: "Name and category are required." });
  }
  let image = await uploadFile2(req.file, "category");
  const subCategory = new SubCategory({
    name,
    category,
    image: image // Assuming the image is uploaded similarly
  });

  await subCategory.save();
  return res.status(201).json({ message: "Subcategory created successfully", subCategory });
};

// Update service category
exports.updateSubCategory = async (req, res) => {
  try {
    const { name } = req.body;
    let image = req.file ? await uploadFile2(req.file, "category") : undefined; // Handle uploaded file
    console.log(name, image);

    // Find the existing category
    const existingSubCategory = await SubCategory.findById(req.params.subcategoryId);
    if (!existingSubCategory) {
      return res.status(404).json({
        success: false,
        message: "Service category not found",
      });
    }

    // Prepare update object (only update fields that are provided)
    const updateData = {};
    if (name) updateData.name = name; // Update only if name is provided
    if (image) updateData.image = (image); // Update only if icon is uploaded

    // Perform the update
    const subCategory = await SubCategory.findByIdAndUpdate(
      req.params.subcategoryId,
      { $set: updateData },
      { new: true }
    );

    // console.log(category, "category");

    res.json({
      success: true,
      data: subCategory
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({
      success: false,
      message: "Error updating service category"
    });
  }
};

// Delete service category
exports.deleteSubCategory = async (req, res) => {
  try {
    const category = await SubCategory.findById(req.params.subcategoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Service category not found"
      });
    }



    // Use findByIdAndDelete instead of remove()
    await SubCategory.findByIdAndDelete(req.params.subcategoryId);

    res.json({
      success: true,
      message: "Sub Category deleted successfully"
    });
  } catch (error) {
    console.error("Delete SubCategory Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting SubCategory",
      error: error.message
    });
  }
};

// Update User Status
exports.updateUserStatus = async (req, res) => {
  const { userId, status } = req.body;
  if (!userId || (status !== 'active' && status !== 'inactive')) {
    console.log(userId, status)
    return res.status(400).json({ message: 'Invalid user ID or status' });
  }
  try {
    const user = await User.findByIdAndUpdate(userId, { status }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({ message: 'User status updated', user });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Get all fee transactions (Admin)
exports.getAllFeeTransactions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      feeType, 
      status, 
      startDate, 
      endDate,
      partnerId 
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};

    // Filter by feeType - ensure exact match and valid value
    if (feeType && feeType !== 'all' && feeType.trim() !== '') {
      const trimmedFeeType = feeType.trim();
      const validFeeTypes = ['registration', 'security_deposit', 'toolkit', 'mg_plan', 'lead_fee', 'other'];
      if (validFeeTypes.includes(trimmedFeeType)) {
        // Special logic for toolkit and security_deposit: check both feeType and priceBreakdown
        if (trimmedFeeType === 'toolkit' || trimmedFeeType === 'security_deposit') {
          // Use $or to check both feeType field and priceBreakdown in metadata
          query.$or = [
            { feeType: trimmedFeeType },
            { [`metadata.priceBreakdown.${trimmedFeeType === 'security_deposit' ? 'securityDeposit' : 'toolkitPrice'}`]: { $exists: true, $gt: 0 } }
          ];
          // Debug logging
          if (process.env.NODE_ENV === 'development') {
            console.log('Applying feeType filter with priceBreakdown check:', trimmedFeeType);
          }
        } else {
          // For other fee types, use standard feeType filter
          query.feeType = trimmedFeeType;
          // Debug logging
          if (process.env.NODE_ENV === 'development') {
            console.log('Applying feeType filter:', trimmedFeeType);
          }
        }
      } else {
        // Debug logging for invalid feeType
        if (process.env.NODE_ENV === 'development') {
          console.log('Invalid feeType received:', trimmedFeeType, 'Valid types:', validFeeTypes);
        }
      }
    }

    // Filter by status - ensure exact match and valid value
    if (status && status !== 'all' && status.trim() !== '') {
      const validStatuses = ['pending', 'success', 'failed', 'refunded'];
      if (validStatuses.includes(status.trim())) {
        query.status = status.trim();
      }
    }

    // Filter by partnerId
    if (partnerId && partnerId.trim() !== '') {
      query.partnerId = partnerId.trim();
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        // Set to start of the day (00:00:00) in local timezone
        const start = new Date(startDate + 'T00:00:00');
        query.createdAt.$gte = start;
      }
      if (endDate) {
        // Set to end of the day (23:59:59.999) in local timezone
        const end = new Date(endDate + 'T23:59:59.999');
        query.createdAt.$lte = end;
      }
    }
    
    // Debug logging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Fee Transactions Query:', JSON.stringify(query, null, 2));
    }

    // Get total count
    const total = await PaymentTransaction.countDocuments(query);

    // Get transactions with partner details
    // Use find with explicit query to ensure filters are applied correctly
    const transactions = await PaymentTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Debug: Log the actual results
    if (process.env.NODE_ENV === 'development' && (query.feeType || query.$or)) {
      const filterType = query.feeType || (query.$or ? 'priceBreakdown check' : 'unknown');
      console.log(`Found ${transactions.length} transactions with filter: ${filterType}`);
      if (transactions.length > 0) {
        console.log('Sample transaction feeTypes:', transactions.slice(0, 3).map(t => t.feeType));
        if (query.$or) {
          console.log('Sample priceBreakdowns:', transactions.slice(0, 3).map(t => ({
            feeType: t.feeType,
            hasSecurityDeposit: t.metadata?.priceBreakdown?.securityDeposit > 0,
            hasToolkit: t.metadata?.priceBreakdown?.toolkitPrice > 0
          })));
        }
      } else {
        console.log('No transactions found with filter:', filterType);
      }
    }

    // Populate partner information
    const transactionsWithPartner = await Promise.all(
      transactions.map(async (txn) => {
        try {
          const partner = await Partner.findById(txn.partnerId).select('phone profile.name profile.email').lean();
          const partnerName = partner?.profile?.name || partner?.name || 'Unknown';
          const partnerPhone = partner?.phone || txn.partnerId;
          const partnerEmail = partner?.profile?.email || partner?.email || '';
          
          return {
            ...txn,
            partner: {
              name: partnerName,
              phone: partnerPhone,
              email: partnerEmail
            }
          };
        } catch (err) {
          // Try to get name from metadata if available
          const partnerName = txn.metadata?.partnerName || 'Unknown';
          return {
            ...txn,
            partner: {
              name: partnerName,
              phone: txn.partnerId,
              email: txn.metadata?.partnerEmail || ''
            }
          };
        }
      })
    );

    // Calculate summary statistics
    const summary = await PaymentTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          successAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0] }
          }
        }
      }
    ]);

    const stats = summary[0] || {
      totalAmount: 0,
      totalCount: 0,
      successCount: 0,
      successAmount: 0
    };

    res.json({
      success: true,
      data: transactionsWithPartner,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      stats: {
        totalAmount: stats.totalAmount,
        totalCount: stats.totalCount,
        successCount: stats.successCount,
        successAmount: stats.successAmount,
        failedCount: stats.totalCount - stats.successCount
      }
    });
  } catch (error) {
    console.error('Error fetching fee transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fee transactions',
      error: error.message
    });
  }
};

// Approve Partner Payment
exports.approvePartnerPayment = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { registerAmount, payId, paidBy, paymentApproved, approvedBy, approvedAt } = req.body;

    console.log('Approve Payment Request:', {
      partnerId,
      body: req.body,
      payId,
      registerAmount,
      paidBy
    });

    // Find the partner
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found"
      });
    }

    console.log('Partner before update:', {
      id: partner._id,
      currentPayId: partner.profile?.payId,
      currentRegisterAmount: partner.profile?.registerAmount,
      currentPaidBy: partner.profile?.paidBy
    });

    // Initialize profile if it doesn't exist
    if (!partner.profile) {
      partner.profile = {};
    }

    // Use set() method for nested fields to ensure Mongoose tracks changes
    if (registerAmount !== undefined) {
      partner.set('profile.registerAmount', registerAmount);
    }
    if (payId !== undefined && payId !== null && payId !== '') {
      partner.set('profile.payId', payId);
    }
    if (paidBy !== undefined) {
      partner.set('profile.paidBy', paidBy);
    }

    // Mark payment as approved
    partner.set('profile.registerdFee', true);

    // Add approval metadata
    partner.set('profile.paymentApproved', paymentApproved || true);
    partner.set('profile.approvedBy', approvedBy || 'Admin');
    partner.set('profile.approvedAt', approvedAt || new Date());

    console.log('Partner after update (before save):', {
      id: partner._id,
      newPayId: partner.get('profile.payId'),
      newRegisterAmount: partner.get('profile.registerAmount'),
      newPaidBy: partner.get('profile.paidBy'),
      registerdFee: partner.get('profile.registerdFee')
    });

    // Update profile completion status
    const hasBasicFields = partner.profile?.name &&
                          partner.profile?.email &&
                          partner.qualification &&
                          partner.experience;

    if (hasBasicFields) {
      partner.profileCompleted = true;
    }

    partner.set('profileStatus', 'active');
    partner.set('status', 'approved');

    await partner.save();

    console.log("Partner saved successfully:", {
      id: partner._id,
      savedPayId: partner.get('profile.payId'),
      savedRegisterAmount: partner.get('profile.registerAmount'),
      savedPaidBy: partner.get('profile.paidBy'),
      registerdFee: partner.get('profile.registerdFee')
    });
    
    // Verify by fetching fresh from DB
    const verifyPartner = await Partner.findById(partnerId);
    console.log("Verification from DB:", {
      id: verifyPartner._id,
      dbPayId: verifyPartner.profile?.payId,
      dbRegisterAmount: verifyPartner.profile?.registerAmount,
      dbPaidBy: verifyPartner.profile?.paidBy,
      dbRegisterdFee: verifyPartner.profile?.registerdFee
    });

    // Send notification to partner about payment approval
    const { sendPartnerNotification } = require("../services/notificationService");
    const totalAmount = (registerAmount || partner.registerAmount || 0) +
                       (partner.securityDeposit || 0) +
                       (partner.toolkitPrice || 0);

    await sendPartnerNotification(
      partner._id,
      '🎉 Payment Approved!',
      `Congratulations! Your payment of ₹${totalAmount.toLocaleString('en-IN')} has been approved. Your partner profile is now active and you can start accepting bookings.`,
      'success',
      '/android-chrome-192x192.png'
    );

    res.json({
      success: true,
      message: "Payment approved successfully",
      partner: {
        id: partner._id,
        registerAmount: partner?.profile?.registerAmount || 0,
        payId: partner?.profile?.payId || "N/A",
        paidBy: partner?.profile?.paidBy || "N/A" ,
        registerdFee: partner?.profile?.registerdFee || false ,
        paymentApproved: partner?.profile?.paymentApproved || false,
        approvedAt: partner?.profile?.approvedAt || new Date(),
        securityDeposit: partner?.profile?.securityDeposit || 0,
        toolkitPrice: partner?.profile?.toolkitPrice || 0
      }
    });

  } catch (error) {
    console.error("Approve Partner Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Error approving payment",
      error: error.message
    });
  }
};


// Update MG Plan Payment Details
exports.updateMGPlanPaymentDetails = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { paymentMethod, collectedBy, transactionId } = req.body;

    // Validate required fields
    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required"
      });
    }

    if (paymentMethod === 'cash' && !collectedBy) {
      return res.status(400).json({
        success: false,
        message: "Collected by is required for cash payments"
      });
    }

    if ((paymentMethod === 'online' || paymentMethod === 'upi') && !transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required for online/UPI payments"
      });
    }

    // Find the partner
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found"
      });
    }

    // Check if partner has an MG plan
    if (!partner.mgPlan) {
      return res.status(400).json({
        success: false,
        message: "Partner doesn't have an MG plan assigned"
      });
    }

    // Update the latest MG plan history entry with payment details
    if (partner.mgPlanHistory && partner.mgPlanHistory.length > 0) {
      const latestPlanIndex = partner.mgPlanHistory.length - 1;
      partner.mgPlanHistory[latestPlanIndex].paymentMethod = paymentMethod;
      
      if (paymentMethod === 'cash') {
        partner.mgPlanHistory[latestPlanIndex].collectedBy = collectedBy;
        partner.mgPlanHistory[latestPlanIndex].transactionId = undefined;
      } else {
        partner.mgPlanHistory[latestPlanIndex].transactionId = transactionId;
        partner.mgPlanHistory[latestPlanIndex].collectedBy = undefined;
      }
      
      partner.mgPlanHistory[latestPlanIndex].paymentUpdatedAt = new Date();
    }

    await partner.save();

    // Send notification to partner
    await sendPartnerNotification(
      partner._id,
      'Payment Details Updated',
      `Payment details for your MG plan have been updated successfully.`,
      'info',
      '/android-chrome-192x192.png'
    );

    res.json({
      success: true,
      message: "Payment details updated successfully",
      paymentDetails: {
        paymentMethod,
        ...(paymentMethod === 'cash' ? { collectedBy } : { transactionId })
      }
    });

  } catch (error) {
    console.error("Update MG Plan Payment Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating payment details",
      error: error.message
    });
  }
};

// Manual Partner Registration by Admin
exports.manualPartnerRegistration = async (req, res) => {
  // Set JSON content type immediately
  res.setHeader('Content-Type', 'application/json');
  
  try {
    console.log('=== Manual Partner Registration Started ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Files received:', req.files?.length || 0);
    
    const {
      phone,
      whatsappNumber,
      name,
      email,
      qualification,
      experience,
      partnerType,
      address,
      landmark,
      pincode,
      city,
      category,
      categoryNames,
      selectedHubs,
      modeOfService,
      bankDetails,
      registerAmount,
      securityDeposit,
      toolkitPrice,
      paymentApproved,
      registerdFee,
      paidBy,
      agentName,
      gstNumber,
      referralCode,
      profileStatus,
      termsAccepted,
      signature,
      selectedPlan,
      selectedPlanId
    } = req.body;
    
    console.log('Phone:', phone);
    console.log('Name:', name);
    console.log('Email:', email);

    // Validate required fields
    if (!phone || !name || !email || !address || !landmark || !pincode || !city) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing"
      });
    }

    // Check if partner with phone already exists
    const existingPartner = await Partner.findOne({ phone });
    if (existingPartner) {
      return res.status(400).json({
        success: false,
        message: "Partner with this phone number already exists"
      });
    }

    // Generate unique referral code if not provided
    const finalReferralCode = referralCode || `NEXO${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Parse JSON fields
    const parsedCategory = category ? (typeof category === 'string' ? JSON.parse(category) : category) : [];
    const parsedCategoryNames = categoryNames ? (typeof categoryNames === 'string' ? JSON.parse(categoryNames) : categoryNames) : [];
    const parsedSelectedHubs = selectedHubs ? (typeof selectedHubs === 'string' ? JSON.parse(selectedHubs) : selectedHubs) : [];
    const parsedBankDetails = bankDetails ? (typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails) : {};
    
    console.log('Parsed selectedHubs:', JSON.stringify(parsedSelectedHubs, null, 2));
    console.log('Number of hubs selected:', parsedSelectedHubs.length);

    // Handle file uploads
    const files = req.files || [];
    console.log('Files array:', files.map(f => ({ fieldname: f.fieldname, filename: f.filename, originalname: f.originalname })));
    
    const kycData = {
      status: 'approved' // Auto-approve for manual registration
    };
    
    let profilePicturePath = null;
    
    files.forEach(file => {
      console.log(`Processing file: ${file.fieldname} -> ${file.filename}`);
      if (file.fieldname === 'profilePicture') {
        profilePicturePath = file.filename;
        console.log('Profile picture set:', profilePicturePath);
      } else if (['panCard', 'aadhaar', 'aadhaarback', 'drivingLicence', 'bill', 'chequeImage'].includes(file.fieldname)) {
        kycData[file.fieldname] = file.filename;
        console.log(`KYC document ${file.fieldname} set:`, file.filename);
      }
    });
    
    console.log('Final KYC data:', kycData);
    console.log('Profile picture path:', profilePicturePath);

    // Create partner object
    const partnerData = {
      phone,
      whatsappNumber: whatsappNumber || phone,
      qualification,
      experience,
      partnerType: partnerType || 'individual',
      modeOfService: modeOfService || 'both',
      profileCompleted: true,
      profileStatus: profileStatus || 'active',
      profile: {
        name,
        email,
        address,
        landmark,
        pincode,
        city,
        gstNumber,
        registerAmount: registerAmount || 0,
        securityDeposit: securityDeposit || 0,
        toolkitPrice: toolkitPrice || 0,
        registerdFee: registerdFee === 'true' || registerdFee === true,
        paymentApproved: paymentApproved === 'true' || paymentApproved === true,
        paidBy: paidBy || 'Admin',
        approvedBy: 'Admin',
        approvedAt: (paymentApproved === 'true' || paymentApproved === true) ? new Date() : null
      },
      kyc: kycData,
      bankDetails: {
        accountNumber: parsedBankDetails.accountNumber || '',
        ifscCode: parsedBankDetails.ifscCode || '',
        accountHolderName: parsedBankDetails.accountHolderName || '',
        bankName: parsedBankDetails.bankName || ''
      },
      category: parsedCategory,
      categoryNames: parsedCategoryNames,
      // Store hub IDs in hubs array for reference
      hubs: parsedSelectedHubs.map(hub => hub.hubId).filter(Boolean),
      // Store detailed hub info in serviceHubs
      serviceHubs: parsedSelectedHubs.map(hub => {
        // Handle both formats: {hubId, name, pinCodes} or {name, pinCodes}
        const mappedHub = {
          hubId: hub.hubId || null,
          name: hub.name || '',
          pinCodes: Array.isArray(hub.pinCodes) ? hub.pinCodes : [],
          isPrimary: hub.isPrimary || false
        };
        console.log('Mapping hub:', JSON.stringify(hub), '-> serviceHub:', JSON.stringify(mappedHub));
        return mappedHub;
      }),
      agentName,
      referralCode: finalReferralCode,
      profilePicture: profilePicturePath,
      status: 'approved', // Auto-approve for manual registration
      approvedAt: new Date(),
      terms: {
        accepted: termsAccepted === 'true' || termsAccepted === true,
        signature: signature || null,
        acceptedAt: (termsAccepted === 'true' || termsAccepted === true) ? new Date() : null
      },
      // MG Plan will be set after partner creation if selected
      onboardingProgress: {
        step1: { completed: true, completedAt: new Date() },
        step2: { completed: true, completedAt: new Date() },
        step3: { completed: true, completedAt: new Date() },
        step4: { completed: true, completedAt: new Date() },
        step5: { completed: true, completedAt: new Date() },
        step6: { completed: true, completedAt: new Date() },
        step7: { completed: true, completedAt: new Date() },
        step8: { completed: true, completedAt: new Date() },
        step9: { completed: true, approved: true, approvedAt: new Date(), updatedAt: new Date() },
        step10: { completed: false },
        step11: { completed: true, completedAt: new Date() }
      }
    };

    // Create partner
    console.log('Creating partner with serviceHubs:', JSON.stringify(partnerData.serviceHubs, null, 2));
    const partner = new Partner(partnerData);
    await partner.save();
    console.log('Partner saved. ServiceHubs in DB:', JSON.stringify(partner.serviceHubs, null, 2));

    // Handle MG Plan subscription if selected
    if (selectedPlanId) {
      try {
        const MGPlan = require('../models/MGPlan');
        const plan = await MGPlan.findById(selectedPlanId);
        
        if (plan) {
          const subscribedAt = new Date();
          const expiresAt = new Date(subscribedAt);
          const validityMonths = plan.validityMonths || 1;
          expiresAt.setMonth(expiresAt.getMonth() + validityMonths);

          partner.mgPlan = selectedPlanId;
          partner.mgPlanLeadQuota = plan.leads || 0;
          partner.mgPlanLeadsUsed = 0;
          partner.mgPlanSubscribedAt = subscribedAt;
          partner.mgPlanExpiresAt = expiresAt;
          partner.leadAcceptancePaused = false;

          // Add to MG plan history
          partner.mgPlanHistory.push({
            plan: plan._id,
            planName: plan.name,
            price: plan.price,
            leadsGuaranteed: plan.leads,
            commissionRate: plan.commission,
            leadFee: plan.leadFee,
            subscribedAt: subscribedAt,
            expiresAt: expiresAt,
            leadsConsumed: 0,
            refundStatus: 'pending'
          });

          await partner.save();
          console.log('MG Plan assigned successfully:', plan.name);
        }
      } catch (planError) {
        console.error('Error assigning MG plan:', planError);
        // Don't fail the registration if MG plan assignment fails
      }
    }

    // Send notification to partner (if FCM token available)
    try {
      await sendPartnerNotification(
        partner._id,
        'Welcome to Nexo!',
        `Your partner account has been created successfully. You can now start accepting bookings.`,
        'success',
        '/android-chrome-192x192.png'
      );
    } catch (notifError) {
      console.error('Notification error:', notifError);
      // Don't fail the registration if notification fails
    }

    console.log('=== Partner Registration Successful ===');
    console.log('Partner ID:', partner._id);
    console.log('Partner Phone:', partner.phone);
    
    const responseData = {
      success: true,
      message: "Partner registered successfully",
      partner: {
        _id: partner._id,
        phone: partner.phone,
        name: partner.profile.name,
        email: partner.profile.email,
        referralCode: partner.referralCode,
        status: partner.status
      }
    };
    
    console.log('Sending response:', JSON.stringify(responseData));
    res.status(201).json(responseData);

  } catch (error) {
    console.error("=== Manual Partner Registration Error ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    
    // Ensure we always send a JSON response
    if (!res.headersSent) {
      // Set content type again in case it was changed
      res.setHeader('Content-Type', 'application/json');
      
      return res.status(500).json({
        success: false,
        message: "Error registering partner",
        error: error.message,
        errorName: error.name,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      console.error("Headers already sent, cannot send error response");
    }
  }
};
