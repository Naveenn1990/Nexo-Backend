const Booking = require('../models/booking');
const Partner = require('../models/PartnerModel');
const MGPlan = require('../models/MGPlan');
const User = require('../models/User');

// Get customer bookings with partner-wise details
const getCustomerBookingsPartnerWise = async (req, res) => {
  try {
    const { dateRange, status, partnerType } = req.query;
    
    // Build date filter
    let dateFilter = {};
    const now = new Date();
    
    switch (dateRange) {
      case 'today':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          }
        };
        break;
      case 'week':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = {
          createdAt: {
            $gte: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()),
            $lt: new Date()
          }
        };
        break;
      case 'month':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          }
        };
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        dateFilter = {
          createdAt: {
            $gte: quarterStart,
            $lt: new Date()
          }
        };
        break;
      default:
        // 'all' - no date filter
        break;
    }

    // Build partner filter
    let partnerFilter = {};
    if (partnerType && partnerType !== 'all') {
      partnerFilter.partnerType = partnerType;
    }

    // Get all partners with their MG plans
    const partners = await Partner.find(partnerFilter)
      .populate('mgPlan', 'name price leads commission leadFee')
      .select('profile phone partnerType mgPlan mgPlanLeadQuota mgPlanLeadsUsed mgPlanSubscribedAt mgPlanExpiresAt')
      .lean();

    // Get bookings for each partner
    const partnersWithBookings = await Promise.all(
      partners.map(async (partner) => {
        // Build booking filter
        let bookingFilter = {
          partner: partner._id,
          ...dateFilter
        };

        if (status && status !== 'all') {
          bookingFilter.status = status;
        }

        // Get all bookings for this partner
        const bookings = await Booking.find(bookingFilter)
          .populate('user', 'name phone email')
          .select('status amount scheduledDate scheduledTime serviceName createdAt')
          .sort({ createdAt: -1 })
          .lean();

        // Calculate statistics
        const totalBookings = bookings.length;
        const completedBookings = bookings.filter(b => b.status === 'completed').length;
        const totalRevenue = bookings
          .filter(b => b.status === 'completed')
          .reduce((sum, b) => sum + (b.amount || 0), 0);

        // Get recent bookings (last 5)
        const recentBookings = bookings.slice(0, 5);

        return {
          ...partner,
          totalBookings,
          completedBookings,
          totalRevenue,
          recentBookings,
          // Calculate remaining leads
          remainingLeads: partner.mgPlan ? 
            Math.max(0, partner.mgPlanLeadQuota - partner.mgPlanLeadsUsed) : 0
        };
      })
    );

    // Filter out partners with no bookings if needed
    const filteredPartners = partnersWithBookings.filter(partner => 
      dateRange === 'all' || partner.totalBookings > 0
    );

    // Sort by total bookings descending
    filteredPartners.sort((a, b) => b.totalBookings - a.totalBookings);

    res.json({
      success: true,
      data: filteredPartners,
      summary: {
        totalPartners: filteredPartners.length,
        totalBookings: filteredPartners.reduce((sum, p) => sum + p.totalBookings, 0),
        totalRevenue: filteredPartners.reduce((sum, p) => sum + p.totalRevenue, 0),
        totalLeadsUsed: filteredPartners.reduce((sum, p) => sum + (p.mgPlanLeadsUsed || 0), 0),
        totalRemainingLeads: filteredPartners.reduce((sum, p) => sum + p.remainingLeads, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching customer bookings partner-wise:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer bookings',
      error: error.message
    });
  }
};

// Get detailed partner booking history
const getPartnerBookingDetails = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // Build filter
    let filter = { partner: partnerId };
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Get bookings with pagination
    const bookings = await Booking.find(filter)
      .populate('user', 'name phone email addresses')
      .select('status amount scheduledDate scheduledTime serviceName location createdAt completedAt review')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const totalBookings = await Booking.countDocuments(filter);

    // Get partner details
    const partner = await Partner.findById(partnerId)
      .populate('mgPlan', 'name price leads commission leadFee')
      .select('profile phone partnerType mgPlan mgPlanLeadQuota mgPlanLeadsUsed')
      .lean();

    res.json({
      success: true,
      data: {
        partner,
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalBookings / limit),
          totalBookings,
          hasNext: page * limit < totalBookings,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching partner booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch partner booking details',
      error: error.message
    });
  }
};

// Get booking analytics for dashboard
const getBookingAnalytics = async (req, res) => {
  try {
    const { dateRange = 'month' } = req.query;
    
    // Build date filter
    let dateFilter = {};
    const now = new Date();
    
    switch (dateRange) {
      case 'week':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = {
          createdAt: {
            $gte: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())
          }
        };
        break;
      case 'month':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1)
          }
        };
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        dateFilter = {
          createdAt: {
            $gte: quarterStart
          }
        };
        break;
    }

    // Get booking statistics
    const [
      totalBookings,
      completedBookings,
      pendingBookings,
      cancelledBookings,
      totalRevenue,
      partnersWithBookings
    ] = await Promise.all([
      Booking.countDocuments(dateFilter),
      Booking.countDocuments({ ...dateFilter, status: 'completed' }),
      Booking.countDocuments({ ...dateFilter, status: { $in: ['pending', 'confirmed'] } }),
      Booking.countDocuments({ ...dateFilter, status: 'cancelled' }),
      Booking.aggregate([
        { $match: { ...dateFilter, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Booking.distinct('partner', { ...dateFilter, partner: { $exists: true } })
    ]);

    // Get top performing partners
    const topPartners = await Booking.aggregate([
      { $match: { ...dateFilter, status: 'completed', partner: { $exists: true } } },
      {
        $group: {
          _id: '$partner',
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$amount' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'partners',
          localField: '_id',
          foreignField: '_id',
          as: 'partner'
        }
      },
      { $unwind: '$partner' },
      {
        $project: {
          partnerName: '$partner.profile.name',
          phone: '$partner.phone',
          totalBookings: 1,
          totalRevenue: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalBookings,
          completedBookings,
          pendingBookings,
          cancelledBookings,
          totalRevenue: totalRevenue[0]?.total || 0,
          activePartners: partnersWithBookings.length,
          completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0
        },
        topPartners
      }
    });

  } catch (error) {
    console.error('Error fetching booking analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking analytics',
      error: error.message
    });
  }
};

module.exports = {
  getCustomerBookingsPartnerWise,
  getPartnerBookingDetails,
  getBookingAnalytics
};