const Booking = require('../models/booking');  // Make sure this path is correct

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
        const bookings = await Booking.find(query)
            .populate({
                path: "user", // Populate user details
                select: 'name email phone profilePicture addresses'
            })
            .populate({
                path: "subService",
                populate: {
                    path: "service", // SubService -> Service
                    populate: {
                        path: "subCategory", // Service -> SubCategory
                        populate: {
                            path: "category", // SubCategory -> ServiceCategory
                            select: "name",
                        },
                    },
                },
            })
            .populate({
                path: "partner", // Populate partner details
                select: 'profile.name profile.email profile.phone profilePicture'
            })
            .populate({
                path: "teamMember", // Populate team member details
                select: 'name phone role partner',
                populate: {
                    path: "partner",
                    select: 'profile.name profile.email profile.phone'
                }
            })
            .populate({
                path: "cart.product", // Populate product details inside cart
            })
            .populate({
                path: "cart.addedByPartner", // Populate partner who added the product
                select: "profile.name profile.email", // Select specific fields
            })
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean(); // Convert to plain JS objects for better performance

        // Step 5: Format the bookings
        const formattedBookings = bookings.map(booking => ({
            _id: booking._id,
            booking,
            customerName: booking.user?.name || 'N/A',
            customerEmail: booking.user?.email || 'N/A',
            customerPhone: booking.user?.phone || 'N/A',
            serviceName: booking.subService?.service?.name || 'N/A',
            categoryName: booking.subService?.service?.subCategory?.category?.name || 'N/A',
            partner: booking.partner,
            partnerId: booking.partner?._id || 'N/A',
            partnerName: booking.partner?.profile?.name || 'Still not assigned',
            partnerEmail: booking.partner?.profile?.email || 'N/A',
            partnerPhone: booking.partner?.profile?.phone || 'N/A',
            partnerAddress: booking.partner?.profile?.address || 'N/A',
            partnerProfilePicture: booking.partner?.profilePicture || 'N/A',
            amount: booking.amount || 0,
            paymentMode: booking.paymentMode || 'N/A',
            status: booking.status || 'N/A',
            scheduledDate: booking.scheduledDate,
            scheduledTime: booking.scheduledTime,
            chat: booking.chat,
            booking,
            location: {
                address: booking.location?.address || 'N/A',
                landmark: booking.location?.landmark || 'N/A',
                pincode: booking.location?.pincode || 'N/A'
            },
            createdAt: booking.createdAt
        }));

        // Calculate pagination info
        const totalPages = Math.ceil(total / limitNum);
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
                totalItems: total,
                itemsPerPage: limitNum,
                hasNextPage,
                hasPrevPage,
                startIndex: skip + 1,
                endIndex: Math.min(skip + limitNum, total)
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
