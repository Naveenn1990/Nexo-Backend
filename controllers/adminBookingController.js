const Booking = require('../models/booking');  // Make sure this path is correct
const Quotation = require('../models/Quotation');

exports.getAllBookings = async (req, res) => {
    try {
        console.log('getAllBookings controller called');

        // Extract pagination parameters
        const {
            page = 1,
            limit = 10,
            status,
            fromDate,
            toDate,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Convert to numbers
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build query for filtering
        const query = {};
        
        // Add status filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // Add date range filter
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) {
                query.createdAt.$gte = new Date(fromDate);
            }
            if (toDate) {
                query.createdAt.$lte = new Date(toDate);
            }
        }

        // Add search filter - we'll use aggregation for complex search
        let searchStage = null;
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            searchStage = {
                $match: {
                    $or: [
                        { 'user.name': searchRegex },
                        { 'user.phone': searchRegex },
                        { 'user.email': searchRegex },
                        { 'partner.profile.name': searchRegex },
                        { 'partner.profile.phone': searchRegex },
                        { 'subService.service.name': searchRegex },
                        { 'location.address': searchRegex },
                        { 'location.pincode': searchRegex }
                    ]
                }
            };
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Step 1: Get total count for pagination
        const total = await Booking.countDocuments(query);

        // Step 2: Aggregate monthly booking counts (for analytics)
        const monthlyCounts = await Booking.aggregate([
            {
                $group: {
                    _id: { 
                        year: { $year: "$createdAt" }, 
                        month: { $month: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            { 
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]);

        // Step 3: Format the monthly data
        const monthWiseBookingCount = {};
        monthlyCounts.forEach(entry => {
            const monthName = new Date(entry._id.year, entry._id.month - 1)
                .toLocaleString('default', { month: 'long' });
            monthWiseBookingCount[`${monthName} ${entry._id.year}`] = entry.count;
        });

        // Step 4: Fetch bookings with pagination
        let bookings;
        let searchTotal = total; // For search, we need to recalculate total

        if (searchStage) {
            // Use aggregation for search functionality
            const aggregationPipeline = [
                { $match: query }, // Apply basic filters first
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'partners',
                        localField: 'partner',
                        foreignField: '_id',
                        as: 'partner'
                    }
                },
                { $unwind: { path: '$partner', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'subservices',
                        localField: 'subService',
                        foreignField: '_id',
                        as: 'subService'
                    }
                },
                { $unwind: { path: '$subService', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'services',
                        localField: 'subService.service',
                        foreignField: '_id',
                        as: 'subService.service'
                    }
                },
                { $unwind: { path: '$subService.service', preserveNullAndEmptyArrays: true } },
                searchStage, // Apply search filter after populating
                { $sort: sort },
                {
                    $facet: {
                        data: [
                            { $skip: skip },
                            { $limit: limitNum }
                        ],
                        totalCount: [
                            { $count: "count" }
                        ]
                    }
                }
            ];

            const result = await Booking.aggregate(aggregationPipeline);
            bookings = result[0].data || [];
            searchTotal = result[0].totalCount[0]?.count || 0;

            // Manually populate remaining fields for aggregated results
            await Booking.populate(bookings, [
                {
                    path: "partner",
                    select: 'profile.name profile.email profile.phone profilePicture phone'
                },
                {
                    path: "teamMember",
                    select: 'name phone role partner',
                    populate: {
                        path: "partner",
                        select: 'profile.name profile.email profile.phone'
                    }
                },
                // {
                //     path: "cart.product"
                // },
                {
                    path: "cart.addedByPartner",
                    select: "profile.name profile.email"
                }
            ]);
        } else {
            // Use regular find for non-search queries
            bookings = await Booking.find(query)
                .populate({
                    path: "user",
                    select: 'name email phone profilePicture addresses'
                })
                .populate({
                    path: "subService",
                    populate: {
                        path: "service",
                        populate: {
                            path: "subCategory",
                            populate: {
                                path: "category",
                                select: "name",
                            },
                        },
                    },
                })
                .populate({
                    path: "partner",
                    select: 'profile.name profile.email profile.phone profilePicture phone'
                })
                .populate({
                    path: "teamMember",
                    select: 'name phone role partner',
                    populate: {
                        path: "partner",
                        select: 'profile.name profile.email profile.phone'
                    }
                })
                // .populate({
                //     path: "cart.product"
                // })
                .populate({
                    path: "cart.addedByPartner",
                    select: "profile.name profile.email"
                })
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .lean();
        }

        // Step 4.5: Fetch quotations for each booking
        const bookingIds = bookings.map(b => b._id);
        const quotations = await Quotation.find({ booking: { $in: bookingIds } })
            .populate('booking', 'bookingId _id')
            .populate('partner', 'profile.name phone')
            .populate('user', 'name email phone')
            .lean();
        
        // Create a map of bookingId -> quotations
        const quotationsByBooking = {};
        quotations.forEach(quotation => {
            const bookingId = quotation.booking.toString();
            if (!quotationsByBooking[bookingId]) {
                quotationsByBooking[bookingId] = [];
            }
            quotationsByBooking[bookingId].push(quotation);
        });

        // Step 5: Format the bookings
        const formattedBookings = bookings.map(booking => {
            // Debug: Log booking structure for service name issues
            if (!booking.serviceName && !booking.subService?.service?.name && !booking.subService?.name) {
                console.log('🔍 Booking with missing service name:', {
                    id: booking._id,
                    serviceName: booking.serviceName,
                    subService: booking.subService,
                    serviceData: booking.serviceData,
                    cartItems: booking.cartItems,
                    // Log all available fields to understand the structure
                    allFields: Object.keys(booking),
                    // Check if there are any service-related fields
                    serviceFields: Object.keys(booking).filter(key => key.toLowerCase().includes('service'))
                });
            } else {
                // Log successful service name resolution
                console.log('✅ Service name resolved for booking:', {
                    id: booking._id,
                    resolvedServiceName: booking.serviceName || 
                                       booking.subService?.service?.name || 
                                       booking.subService?.name || 
                                       booking.serviceData?.name ||
                                       (booking.cartItems && booking.cartItems.length > 0 ? booking.cartItems[0].name : 'fallback')
                });
            }
            
            // Partner name handling - preserve original names, only clean if corrupted
            let partnerName = 'Still not assigned';
            let partnerPhone = 'N/A';
            
            if (booking.partner) {
                // Get the partner name and phone
                const rawPartnerName = booking.partner.profile?.name || '';
                const rawPartnerPhone = booking.partner.profile?.phone || booking.partner.phone || '';
                
                partnerPhone = rawPartnerPhone || 'N/A';
                
                if (rawPartnerName) {
                    // Only clean if the name actually contains phone numbers or is corrupted
                    let cleanName = rawPartnerName.trim();
                    let needsCleaning = false;
                    
                    // Check if name contains phone number (only clean if it does)
                    if (rawPartnerPhone && cleanName.includes(rawPartnerPhone)) {
                        needsCleaning = true;
                        cleanName = cleanName.replace(new RegExp(rawPartnerPhone, 'g'), '').trim();
                    }
                    
                    // Check if name contains other phone-like patterns
                    if (/\b\d{10}\b/.test(cleanName) || /\+91\s*\d{10}/.test(cleanName)) {
                        needsCleaning = true;
                        cleanName = cleanName.replace(/\b\d{10}\b/g, '').trim();
                        cleanName = cleanName.replace(/\+91\s*\d{10}/g, '').trim();
                    }
                    
                    // Only apply aggressive cleaning if we detected corruption
                    if (needsCleaning) {
                        cleanName = cleanName.replace(/\b\d{7,}\b/g, '').trim();
                        cleanName = cleanName.replace(/\s+/g, ' ').trim();
                        cleanName = cleanName.replace(/^[-\s]+|[-\s]+$/g, '').trim();
                    }
                    
                    // Use cleaned name if valid, otherwise use original
                    if (cleanName && cleanName.length >= 2 && !cleanName.match(/^\d+$/) && !cleanName.match(/^[^a-zA-Z]*$/)) {
                        partnerName = cleanName;
                    } else if (!needsCleaning && rawPartnerName.length >= 2) {
                        // If no cleaning was needed and original name is reasonable, use it
                        partnerName = rawPartnerName;
                    } else if (rawPartnerPhone) {
                        // Only use generic name if original was corrupted
                        partnerName = `Service Partner (${rawPartnerPhone.slice(-4)})`;
                    } else {
                        partnerName = 'Service Partner';
                    }
                } else if (rawPartnerPhone) {
                    // If no name but has phone, create a meaningful name
                    partnerName = `Service Partner (${rawPartnerPhone.slice(-4)})`;
                }
            }
            
            return {
                _id: booking._id,
                booking,
                customerName: booking.user?.name || 'N/A',
                customerEmail: booking.user?.email || 'N/A',
                customerPhone: booking.user?.phone || 'N/A',
                serviceName: (() => {
                    // First try the direct serviceName field
                    if (booking.serviceName) return booking.serviceName;
                    
                    // Try serviceData (this contains the main service info)
                    if (booking.serviceData) {
                        if (typeof booking.serviceData === 'object' && booking.serviceData.name) {
                            return booking.serviceData.name;
                        }
                        if (typeof booking.serviceData === 'string') {
                            try {
                                const parsed = JSON.parse(booking.serviceData);
                                if (parsed.name) return parsed.name;
                            } catch (e) {
                                // Not JSON, might be a plain string
                            }
                        }
                    }
                    
                    // Try to get from cart items array (this is where the actual booked items are)
                    if (booking.cartItems && booking.cartItems.length > 0) {
                        // If there's only one item, use its name
                        if (booking.cartItems.length === 1) {
                            const item = booking.cartItems[0];
                            if (item.name) return item.name;
                            if (item.serviceName) return item.serviceName;
                        } else {
                            // If multiple items, create a descriptive name
                            const itemNames = booking.cartItems
                                .map(item => item.name || item.serviceName)
                                .filter(name => name)
                                .slice(0, 2); // Take first 2 items
                            
                            if (itemNames.length > 0) {
                                const serviceName = itemNames.join(', ');
                                return booking.cartItems.length > 2 
                                    ? `${serviceName} + ${booking.cartItems.length - 2} more`
                                    : serviceName;
                            }
                        }
                    }
                    
                    // Try subService as fallback
                    if (booking.subService?.service?.name) return booking.subService.service.name;
                    if (booking.subService?.name) return booking.subService.name;
                    
                    // Final fallback
                    return 'Service Booking';
                })(),
                categoryName: booking.subService?.service?.subCategory?.category?.name || 'N/A',
                partner: booking.partner,
                partnerId: booking.partner?._id || 'N/A',
                partnerName: partnerName,
                partnerEmail: (booking.partner?.profile?.email && typeof booking.partner.profile.email === 'string') 
                    ? booking.partner.profile.email.trim() 
                    : 'N/A',
                partnerPhone: partnerPhone,
                partnerAddress: (booking.partner?.profile?.address && typeof booking.partner.profile.address === 'string') 
                    ? booking.partner.profile.address.trim() 
                    : 'N/A',
                partnerProfilePicture: booking.partner?.profilePicture || 'N/A',
                amount: booking.amount || 0,
                totalAmount: booking.totalAmount || booking.amount || 0,
                gstAmount: booking.gstAmount || 0,
                cartItems: booking.cartItems || [],
                cartTotal: booking.cartTotal || booking.amount || 0,
                paymentMode: booking.paymentMode || 'N/A',
                paymentStatus: booking.paymentStatus || 'N/A',
                status: booking.status || 'N/A',
                scheduledDate: booking.scheduledDate,
                scheduledTime: booking.scheduledTime,
                chat: booking.chat,
                quotations: quotationsByBooking[booking._id.toString()] || [], // Add quotations
                remark: booking.remark || null, // Add partner remark
                pauseDetails: booking.pauseDetails || null, // Add pause details
                photos: booking.photos || [], // Add photos
                videos: booking.videos || [], // Add videos
                completedAt: booking.completedAt || null, // Add completion date
                customerDetails: booking.customerDetails || null, // Add customer details
                specialInstructions: booking.specialInstructions || null, // Add special instructions
                location: {
                    address: booking.location?.address || 'N/A',
                    landmark: booking.location?.landmark || 'N/A',
                    pincode: booking.location?.pincode || 'N/A'
                },
                createdAt: booking.createdAt
            };
        });

        // Calculate pagination info using search total if applicable
        const actualTotal = searchStage ? searchTotal : total;
        const totalPages = Math.ceil(actualTotal / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        console.log('Formatted bookings:', formattedBookings.length);

        return res.status(200).json({
            success: true,
            monthlyBookingCount: monthWiseBookingCount,
            count: formattedBookings.length,
            data: formattedBookings,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: actualTotal,
                itemsPerPage: limitNum,
                hasNextPage,
                hasPrevPage,
                startIndex: skip + 1,
                endIndex: Math.min(skip + limitNum, actualTotal)
            }
        });

    } catch (error) {
        console.error('Admin Get All Bookings Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
};
