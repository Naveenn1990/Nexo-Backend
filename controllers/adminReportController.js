const Booking = require("../models/booking");
const Partner = require("../models/PartnerModel");
const User = require("../models/User");
const { PaymentTransaction } = require("../models/RegisterFee");

// Get revenue analytics
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateQuery = {};
    
    if (startDate && endDate) {
      dateQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get payment transactions (fees collected from partners - this is actual revenue)
    let paymentTransactions = [];
    try {
      paymentTransactions = await PaymentTransaction.find(dateQuery).lean();
    } catch (err) {
      console.error("Error fetching PaymentTransaction:", err);
      // Continue with empty array if PaymentTransaction fails
    }
    
    // Get booking revenue (payments from customers)
    let bookingRevenue = 0;
    let bookingCount = 0;
    try {
      const bookingQuery = { paymentStatus: 'completed' };
      if (startDate && endDate) {
        bookingQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      const completedBookings = await Booking.find(bookingQuery).select('amount payamount').lean();
      bookingRevenue = completedBookings.reduce((sum, b) => sum + (b.payamount || b.amount || 0), 0);
      bookingCount = completedBookings.length;
    } catch (err) {
      console.error("Error fetching Booking revenue:", err);
      // Continue with 0 if Booking fails
    }
    
    // Calculate revenue from payment transactions (fees collected)
    const feeRevenue = paymentTransactions
      .filter(t => t.status === 'success')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    // Total revenue = fees from partners + booking payments from customers
    const totalRevenue = feeRevenue + bookingRevenue;
    
    // Count transactions
    const successfulFeeTransactions = paymentTransactions.filter(t => t.status === 'success').length;
    const failedFeeTransactions = paymentTransactions.filter(t => t.status === 'failed').length;
    const totalTransactions = paymentTransactions.length;
    
    const analytics = {
      totalRevenue: totalRevenue || 0,
      transactionCount: totalTransactions || 0,
      successfulTransactions: successfulFeeTransactions || 0,
      failedTransactions: failedFeeTransactions || 0,
      averageTransactionValue: totalTransactions > 0 ? 
        (feeRevenue / totalTransactions) : 0,
      feeRevenue: feeRevenue || 0,
      bookingRevenue: bookingRevenue || 0,
      bookingCount: bookingCount || 0
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error("Error in getRevenueAnalytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching revenue analytics",
      error: error.message
    });
  }
};

// Get partner performance
exports.getPartnerPerformance = async (req, res) => {
  try {
    const partners = await Partner.find()
      .select('phone profile.name profile.rating wallet completedBookings cancelledBookings')
      .lean();
    
    // Get wallet data for each partner
    const PartnerWallet = require("../models/PartnerWallet");
    const wallets = await PartnerWallet.find().lean();
    // PartnerWallet uses 'partner' field (ObjectId), convert to string for mapping
    const walletMap = new Map();
    wallets.forEach(w => {
      if (w.partner) {
        // w.partner is an ObjectId when using .lean()
        const partnerId = w.partner.toString();
        walletMap.set(partnerId, w);
      }
    });
    
    const performance = partners.map(partner => {
      const partnerId = partner._id.toString();
      const wallet = walletMap.get(partnerId);
      const completed = partner.completedBookings || 0;
      const cancelled = partner.cancelledBookings || 0;
      const total = completed + cancelled;
      
      return {
        partnerId: partnerId,
        name: partner.profile?.name || partner.phone || 'Unknown',
        rating: partner.profile?.rating || 0,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
        totalEarnings: wallet?.balance || 0,
        completedBookings: completed,
        cancelledBookings: cancelled
      };
    });

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error("Error in getPartnerPerformance:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching partner performance",
      error: error.message
    });
  }
};

// Get user analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    
    // Get users registered in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    // Get booking statistics
    const totalBookings = await Booking.countDocuments();
    const bookingsPerUser = totalUsers > 0 ? (totalBookings / totalUsers) : 0;

    const analytics = {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      newUsers: newUsers || 0,
      bookingsPerUser: bookingsPerUser || 0,
      userRetentionRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100) : 0
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error("Error in getUserAnalytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user analytics",
      error: error.message
    });
  }
};

// Get category-wise revenue breakdown
exports.getCategoryRevenue = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateQuery = {};
    
    if (startDate && endDate) {
      dateQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const ServiceCategory = require("../models/ServiceCategory");

    // Get all categories
    const categories = await ServiceCategory.find().select('name _id').lean();
    
    // Get category-wise booking revenue
    const categoryRevenue = await Booking.aggregate([
      {
        $match: {
          ...dateQuery,
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: '$category',
          revenue: { $sum: { $ifNull: ['$payamount', '$amount'] } },
          bookingCount: { $sum: 1 }
        }
      }
    ]);

    // Get category-wise ratings from bookings (reviews are stored in bookings)
    const categoryRatings = await Booking.aggregate([
      {
        $match: {
          ...dateQuery,
          'review.rating': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$category',
          averageRating: { $avg: '$review.rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    // Get refunded bookings for penalties calculation
    const refundedBookings = await Booking.aggregate([
      {
        $match: {
          ...dateQuery,
          paymentStatus: 'refunded'
        }
      },
      {
        $group: {
          _id: '$category',
          refundedAmount: { $sum: { $ifNull: ['$payamount', '$amount'] } }
        }
      }
    ]);

    // Create maps for quick lookup
    const revenueMap = new Map();
    categoryRevenue.forEach(item => {
      revenueMap.set(item._id?.toString(), item);
    });

    const ratingMap = new Map();
    categoryRatings.forEach(item => {
      ratingMap.set(item._id?.toString(), item);
    });

    const refundMap = new Map();
    refundedBookings.forEach(item => {
      refundMap.set(item._id?.toString(), item);
    });

    // Build category breakdown
    const categoryBreakdown = categories.map(category => {
      const catId = category._id.toString();
      const revenueData = revenueMap.get(catId) || { revenue: 0, bookingCount: 0 };
      const ratingData = ratingMap.get(catId) || { averageRating: 0, reviewCount: 0 };
      const refundData = refundMap.get(catId) || { refundedAmount: 0 };

      const revenue = revenueData.revenue || 0;
      const penalties = refundData.refundedAmount || 0;
      const rating = ratingData.averageRating || 0;

      return {
        categoryId: catId,
        category: category.name,
        revenue: revenue,
        revenueFormatted: revenue >= 10000000 
          ? `₹${(revenue / 10000000).toFixed(1)}Cr` 
          : revenue >= 100000 
          ? `₹${(revenue / 100000).toFixed(1)}L` 
          : `₹${revenue.toLocaleString('en-IN')}`,
        penalties: penalties,
        penaltiesFormatted: penalties >= 100000 
          ? `₹${(penalties / 100000).toFixed(1)}L` 
          : `₹${penalties.toLocaleString('en-IN')}`,
        rating: rating > 0 ? parseFloat(rating.toFixed(1)) : 0,
        bookingCount: revenueData.bookingCount || 0
      };
    }).filter(cat => cat.revenue > 0 || cat.bookingCount > 0) // Only show categories with activity
      .sort((a, b) => b.revenue - a.revenue); // Sort by revenue descending

    res.json({
      success: true,
      data: categoryBreakdown
    });
  } catch (error) {
    console.error("Error in getCategoryRevenue:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching category revenue",
      error: error.message
    });
  }
};

// Get transaction report
exports.getTransactionReport = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const query = {};
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name email phone')
      .populate('category', 'name description')
      .populate('service', 'name description basePrice duration')
      .sort({ createdAt: -1 });

    const formattedBookings = bookings.map(booking => ({
      _id: booking._id,
      user: booking.user,
      category: booking.category,
      service: booking.service,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      location: booking.location,
      amount: booking.amount,
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      cancellationReason: booking.cancellationReason,
      cancelledAt: booking.cancelledAt
    }));

    res.json({
      success: true,
      data: formattedBookings,
      total: formattedBookings.length,
      message: "Bookings fetched successfully"
    });
  } catch (error) {
    console.error("Error in getTransactionReport:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message
    });
  }
};
