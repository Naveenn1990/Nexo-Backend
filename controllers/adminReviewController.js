 const Review = require('../models/Review'); // Adjust the path as necessary

exports.getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate('subService', 'name') // Populate sub-service name
            .populate('partner', 'name') // Populate partner/provider name
            .lean(); // Convert to plain JS objects for better performance

        return res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews.map(review => ({
                rating: review.rating,
                comment: review.comment,
                subServiceName: review.subService?.name || 'N/A',
                partnerName: review.partner?.name || 'N/A',
            }))
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching reviews',
            error: error.message
        });
    }
};
