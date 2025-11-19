const Lead = require('../models/Lead');
const Booking = require('../models/booking');
const Partner = require('../models/PartnerModel');
const ServiceCategory = require('../models/ServiceCategory');
const Service = require('../models/Service');
const SubService = require('../models/SubService');
const User = require('../models/User');

// Get all leads with filters
exports.getAllLeads = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      city, 
      allocationStrategy,
      startDate,
      endDate
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Status filter - handle both enum values and display names
    if (status && status !== 'all') {
      // Convert display name to enum value if needed
      const statusMap = {
        'Pending': 'pending',
        'Awaiting Bid': 'awaiting_bid',
        'Bidding': 'bidding',
        'Assigned': 'assigned',
        'Converted': 'converted',
        'Escalated': 'escalated',
        'Cancelled': 'cancelled',
        'Expired': 'expired'
      };
      query.status = statusMap[status] || status;
    }

    if (city && city.trim()) {
      query.city = { $regex: city.trim(), $options: 'i' };
    }

    if (allocationStrategy && allocationStrategy !== 'all') {
      query.allocationStrategy = allocationStrategy;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Log the query for debugging
    console.log('📊 Lead Query:', JSON.stringify(query, null, 2));
    console.log('📊 Query params received:', { status, city, allocationStrategy, startDate, endDate });
    
    const total = await Lead.countDocuments(query);
    console.log('📊 Total leads found:', total);
    
    // Also log total leads without any filters for comparison
    const totalAllLeads = await Lead.countDocuments({});
    console.log('📊 Total leads in database (no filters):', totalAllLeads);

    const leads = await Lead.find(query)
      .populate('user', 'name phone email')
      .populate('category', 'name')
      .populate('service', 'name')
      .populate('subService', 'name')
      .populate('assignedPartner', 'profile.name phone')
      .populate('bids.partner', 'profile.name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    console.log('📊 Raw leads count:', leads.length);
    if (leads.length > 0) {
      console.log('📊 Sample lead:', {
        leadId: leads[0].leadId,
        status: leads[0].status,
        city: leads[0].city,
        category: leads[0].category,
        metadata: leads[0].metadata,
        createdAt: leads[0].createdAt
      });
    } else {
      console.log('⚠️ No leads returned from query. Query was:', JSON.stringify(query, null, 2));
      // Try to find any leads to see what's in the database
      const anyLead = await Lead.findOne({}).lean();
      if (anyLead) {
        console.log('📊 Found a lead in database (not matching query):', {
          leadId: anyLead.leadId,
          status: anyLead.status,
          city: anyLead.city,
          metadata: anyLead.metadata
        });
      } else {
        console.log('⚠️ No leads found in database at all');
      }
    }

    // Format leads for frontend
    const formattedLeads = leads.map(lead => {
      // Extract partner details from metadata
      const partnerName = lead.metadata?.partnerName || lead.metadata?.customerName || null;
      const partnerPhone = lead.metadata?.partnerPhone || lead.metadata?.customerPhone || null;
      const partnerEmail = lead.metadata?.partnerEmail || lead.metadata?.customerEmail || null;
      const partnerId = lead.metadata?.partnerId || lead.metadata?.partnerRegistrationId || null;
      
      // Determine source
      const source = lead.metadata?.createdBy === 'plan_subscription' ? 'Plan Subscription' : 
                     lead.metadata?.createdBy === 'partner_registration' ? 'Partner Registration' :
                     lead.metadata?.createdBy === 'customer_enquiry' ? 'Customer Enquiry' :
                     lead.booking ? 'Booking' : 'Manual';
      
      return {
        id: lead._id,
        leadId: lead.leadId,
        service: lead.subService?.name || lead.service?.name || lead.category?.name || 'Unknown Service',
        city: lead.city,
        value: `₹${lead.value.toLocaleString('en-IN')}`,
        allocationStrategy: lead.allocationStrategy?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Rule Based',
        assignedPartner: lead.assignedPartner?.profile?.name || lead.assignedPartner?.phone || 'Unassigned',
        status: lead.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Pending',
        createdAt: lead.createdAt,
        bids: lead.bids?.length || 0,
        // Include metadata
        metadata: lead.metadata || {},
        // Add source indicator
        source: source,
        // Partner details (for partner registrations and plan subscriptions)
        partnerName: partnerName,
        partnerPhone: partnerPhone,
        partnerEmail: partnerEmail,
        partnerId: partnerId,
        // Customer details (for customer enquiries)
        customerName: lead.metadata?.customerName || null,
        customerPhone: lead.metadata?.customerPhone || null,
        customerEmail: lead.metadata?.customerEmail || null,
        // Description
        description: lead.metadata?.description || ''
      };
    });

    console.log('📊 Formatted leads count:', formattedLeads.length);
    console.log('📊 Response pagination:', {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    });

    res.json({
      success: true,
      data: formattedLeads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leads',
      error: error.message
    });
  }
};

// Get lead analytics/stats
exports.getLeadAnalytics = async (req, res) => {
  try {
    // Get active leads (pending, awaiting_bid, bidding)
    const activeLeads = await Lead.countDocuments({
      status: { $in: ['pending', 'awaiting_bid', 'bidding'] }
    });

    // Get high-value leads awaiting bids (value > 50000)
    const highValueLeads = await Lead.countDocuments({
      status: 'awaiting_bid',
      value: { $gt: 50000 }
    });

    // Calculate conversion rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalLeads30d = await Lead.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const convertedLeads30d = await Lead.countDocuments({
      status: 'converted',
      createdAt: { $gte: thirtyDaysAgo }
    });

    const conversionRate = totalLeads30d > 0 
      ? ((convertedLeads30d / totalLeads30d) * 100).toFixed(1)
      : 0;

    // Calculate average allocation time
    const allocatedLeads = await Lead.find({
      allocationTime: { $exists: true, $ne: null }
    }).select('createdAt allocationTime').lean();

    let totalAllocationTime = 0;
    let count = 0;

    allocatedLeads.forEach(lead => {
      if (lead.createdAt && lead.allocationTime) {
        const timeDiff = lead.allocationTime - lead.createdAt;
        totalAllocationTime += timeDiff;
        count++;
      }
    });

    const avgAllocationTimeMs = count > 0 ? totalAllocationTime / count : 0;
    const avgMinutes = Math.floor(avgAllocationTimeMs / 60000);
    const avgSeconds = Math.floor((avgAllocationTimeMs % 60000) / 1000);
    const avgAllocationTime = count > 0 ? `${avgMinutes}m ${avgSeconds}s` : '0m 0s';

    // Calculate bid participation (average bids per lead)
    const leadsWithBids = await Lead.aggregate([
      {
        $match: {
          'bids.0': { $exists: true }
        }
      },
      {
        $project: {
          bidCount: { $size: '$bids' }
        }
      },
      {
        $group: {
          _id: null,
          avgBids: { $avg: '$bidCount' },
          totalLeads: { $sum: 1 }
        }
      }
    ]);

    const bidParticipation = leadsWithBids.length > 0 && leadsWithBids[0].avgBids
      ? leadsWithBids[0].avgBids.toFixed(1)
      : '0.0';

    // Get unique cities count
    const uniqueCities = await Lead.distinct('city');
    const cityCount = uniqueCities.length;

    res.json({
      success: true,
      data: {
        active: activeLeads,
        conversion: `${conversionRate}%`,
        allocationTime: avgAllocationTime,
        bidParticipation: `${bidParticipation} bids/lead`,
        highValueLeads: highValueLeads,
        totalLeads30d: totalLeads30d,
        convertedLeads30d: convertedLeads30d,
        cityCount: cityCount
      }
    });
  } catch (error) {
    console.error('Error fetching lead analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching lead analytics',
      error: error.message
    });
  }
};

// Get all bids
exports.getAllBids = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, leadId } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (leadId) {
      query.leadId = leadId;
    }

    // Get leads with bids
    const leadsQuery = {};
    if (status && status !== 'all') {
      leadsQuery['bids.status'] = status;
    }

    const leads = await Lead.find({
      ...query,
      ...leadsQuery,
      'bids.0': { $exists: true }
    })
      .populate('bids.partner', 'profile.name phone')
      .populate('subService', 'name')
      .populate('service', 'name')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Flatten bids
    const allBids = [];
    leads.forEach(lead => {
      lead.bids.forEach(bid => {
        if (!status || status === 'all' || bid.status === status) {
          allBids.push({
            id: bid._id,
            lead: lead.leadId,
            leadId: lead._id,
            partner: bid.partner?.profile?.name || bid.partner?.phone || 'Unknown',
            partnerId: bid.partner?._id,
            amount: `₹${bid.bidAmount.toLocaleString('en-IN')}`,
            score: bid.score || 0,
            eta: bid.eta || 'N/A',
            status: bid.status?.charAt(0).toUpperCase() + bid.status?.slice(1) || 'Pending',
            submittedAt: bid.submittedAt
          });
        }
      });
    });

    res.json({
      success: true,
      data: allBids,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: allBids.length,
        pages: Math.ceil(allBids.length / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bids',
      error: error.message
    });
  }
};

// Create manual lead (without booking)
exports.createManualLead = async (req, res) => {
  try {
    const {
      partnerId,
      category,
      service,
      subService,
      city,
      address,
      landmark,
      pincode,
      value,
      allocationStrategy,
      priority,
      description
    } = req.body;

    if (!partnerId || !category || !city || !value) {
      return res.status(400).json({
        success: false,
        message: 'Partner ID, category, city, and value are required'
      });
    }

    // Verify partner exists
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    // Create lead without booking
    const lead = new Lead({
      user: null, // Manual lead may not have a user
      category: category,
      service: service || null,
      subService: subService || null,
      city: city,
      location: {
        address: address || '',
        landmark: landmark || '',
        pincode: pincode || '',
        coordinates: {
          lat: 0,
          lng: 0
        }
      },
      value: parseFloat(value),
      allocationStrategy: allocationStrategy || 'rule_based',
      priority: priority || 'medium',
      status: 'awaiting_bid',
      expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata: {
        description: description || '',
        createdBy: 'admin',
        manualLead: true
      }
    });

    await lead.save();

    res.json({
      success: true,
      message: 'Lead created successfully',
      data: lead
    });
  } catch (error) {
    console.error('Error creating manual lead:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating lead',
      error: error.message
    });
  }
};

// Create lead from booking
exports.createLeadFromBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Check if lead already exists for this booking
    const existingLead = await Lead.findOne({ booking: bookingId });
    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: 'Lead already exists for this booking',
        data: existingLead
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate('user')
      .populate('category')
      .populate('service')
      .populate('subService');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Extract city from location
    const city = booking.location?.address 
      ? booking.location.address.split(',').pop().trim() 
      : 'Unknown';

    // Create lead
    const lead = new Lead({
      booking: bookingId,
      user: booking.user._id,
      category: booking.category?._id,
      service: booking.service?._id,
      subService: booking.subService?._id,
      city: city,
      location: {
        address: booking.location?.address || '',
        landmark: booking.location?.landmark || '',
        pincode: booking.location?.pincode || '',
        coordinates: {
          lat: booking.lat || 0,
          lng: booking.lng || 0
        }
      },
      value: booking.amount || booking.payamount || 0,
      allocationStrategy: 'rule_based',
      status: 'awaiting_bid',
      expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    });

    await lead.save();

    res.json({
      success: true,
      message: 'Lead created successfully',
      data: lead
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating lead',
      error: error.message
    });
  }
};

// Update lead status
exports.updateLeadStatus = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { status, assignedPartner } = req.body;

    const updateData = {};
    if (status) {
      updateData.status = status;
      if (status === 'assigned' || status === 'converted') {
        updateData.allocationTime = new Date();
      }
      if (status === 'converted') {
        updateData.convertedAt = new Date();
      }
    }
    if (assignedPartner) {
      updateData.assignedPartner = assignedPartner;
    }

    const lead = await Lead.findByIdAndUpdate(
      leadId,
      updateData,
      { new: true }
    )
      .populate('assignedPartner', 'profile.name phone');

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.json({
      success: true,
      message: 'Lead updated successfully',
      data: lead
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating lead',
      error: error.message
    });
  }
};

// Accept bid
exports.acceptBid = async (req, res) => {
  try {
    const { leadId, bidId } = req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    const bid = lead.bids.id(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Update bid status
    bid.status = 'accepted';
    
    // Reject other bids
    lead.bids.forEach(b => {
      if (b._id.toString() !== bidId) {
        b.status = 'rejected';
      }
    });

    // Update lead
    lead.status = 'assigned';
    lead.assignedPartner = bid.partner;
    lead.acceptedBid = bid._id;
    lead.allocationTime = new Date();

    await lead.save();

    res.json({
      success: true,
      message: 'Bid accepted successfully',
      data: lead
    });
  } catch (error) {
    console.error('Error accepting bid:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting bid',
      error: error.message
    });
  }
};

// Submit service enquiry (public endpoint)
exports.submitServiceEnquiry = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      category,
      service,
      subService,
      city,
      address,
      landmark,
      pincode,
      description,
      estimatedBudget
    } = req.body;

    if (!name || !phone || !category || !city) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, category, and city are required'
      });
    }

    // Check if user exists, if not create a guest user
    let user = await User.findOne({ phone });
    if (!user) {
      user = new User({
        phone,
        name,
        email: email || '',
        isVerified: false,
        isProfileComplete: false
      });
      await user.save();
    } else {
      // Update user details if provided
      if (name && !user.name) user.name = name;
      if (email && !user.email) user.email = email;
      await user.save();
    }

    // Create a booking for the enquiry
    // Note: Booking model requires subService, but for enquiries we might not have it
    // Use service as subService if subService is not provided
    const bookingSubService = subService || service || category;
    
    // Ensure address is not empty (required by Booking model)
    const bookingAddress = address || city || 'Address not provided';
    
    // Ensure amount is valid (required by Booking model)
    const bookingAmount = estimatedBudget ? Math.max(0, parseFloat(estimatedBudget) || 0) : 0;

    const booking = new Booking({
      user: user._id,
      category: category,
      service: service || null,
      subService: bookingSubService, // Required field - use service or category as fallback
      location: {
        address: bookingAddress, // Required field
        landmark: landmark || '',
        pincode: pincode || ''
      },
      amount: bookingAmount, // Required field
      payamount: 0,
      status: 'pending',
      paymentMode: 'cash',
      scheduledDate: new Date(),
      scheduledTime: '00:00'
    });

    await booking.save();

    // Extract city from location or use provided city
    const leadCity = city || (address ? address.split(',').pop().trim() : 'Unknown');

    // Ensure value is a valid number (minimum 0)
    const leadValue = estimatedBudget ? Math.max(0, parseFloat(estimatedBudget) || 0) : 0;

    // Generate a unique leadId as fallback (pre-save hook should also generate it)
    const generateLeadId = () => {
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 10000);
      return `LD-${timestamp}-${randomNum}`;
    };

    // Create lead from booking
    const lead = new Lead({
      leadId: generateLeadId(), // Set initial leadId (pre-save hook will regenerate if needed)
      booking: booking._id,
      user: user._id,
      category: category,
      service: service || null,
      subService: subService || null,
      city: leadCity,
      location: {
        address: address || '',
        landmark: landmark || '',
        pincode: pincode || '',
        coordinates: {
          lat: 0,
          lng: 0
        }
      },
      value: leadValue,
      allocationStrategy: 'rule_based',
      priority: 'medium',
      status: 'awaiting_bid',
      expiryTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: {
        description: description || '',
        createdBy: 'customer_enquiry',
        customerName: name,
        customerPhone: phone,
        customerEmail: email || '',
        estimatedBudget: leadValue,
        fromLeadMarketplace: true
      }
    });

    await lead.save();

    res.json({
      success: true,
      message: 'Service enquiry submitted successfully. We will contact you soon.',
      data: {
        leadId: lead.leadId,
        bookingId: booking._id
      }
    });
  } catch (error) {
    console.error('Error submitting service enquiry:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    
    // Provide more detailed error message
    let errorMessage = 'Error submitting service enquiry';
    if (error.message) {
      errorMessage += ': ' + error.message;
    }
    if (error.name === 'ValidationError') {
      errorMessage = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Sync bookings to leads (create leads from pending bookings)
exports.syncBookingsToLeads = async (req, res) => {
  try {
    // Get all pending bookings without leads
    const bookings = await Booking.find({
      status: { $in: ['pending', 'confirmed'] },
      partner: { $exists: false }
    })
      .populate('user')
      .populate('category')
      .populate('service')
      .populate('subService')
      .lean();

    const createdLeads = [];
    const errors = [];

    for (const booking of bookings) {
      try {
        // Check if lead already exists
        const existingLead = await Lead.findOne({ booking: booking._id });
        if (existingLead) {
          continue;
        }

        // Extract city from location
        const city = booking.location?.address 
          ? booking.location.address.split(',').pop().trim() 
          : 'Unknown';

        // Create lead
        const lead = new Lead({
          booking: booking._id,
          user: booking.user?._id,
          category: booking.category?._id,
          service: booking.service?._id,
          subService: booking.subService?._id,
          city: city,
          location: {
            address: booking.location?.address || '',
            landmark: booking.location?.landmark || '',
            pincode: booking.location?.pincode || '',
            coordinates: {
              lat: booking.lat || 0,
              lng: booking.lng || 0
            }
          },
          value: booking.amount || booking.payamount || 0,
          allocationStrategy: 'rule_based',
          status: 'awaiting_bid',
          expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        await lead.save();
        createdLeads.push(lead.leadId);
      } catch (err) {
        errors.push({ bookingId: booking._id, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Synced ${createdLeads.length} bookings to leads`,
      data: {
        created: createdLeads.length,
        leads: createdLeads,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error syncing bookings to leads:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing bookings to leads',
      error: error.message
    });
  }
};

