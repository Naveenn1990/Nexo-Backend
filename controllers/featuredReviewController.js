const FeaturedReview = require('../models/FeaturedReview');

// Get all featured reviews (public - for home page)
exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await FeaturedReview.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(12) // Limit to 12 reviews for homepage
      .lean();

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching featured reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured reviews',
      error: error.message
    });
  }
};

// Get all featured reviews (admin - includes inactive)
exports.getAllReviewsAdmin = async (req, res) => {
  try {
    const reviews = await FeaturedReview.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching featured reviews (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured reviews',
      error: error.message
    });
  }
};

// Get review by ID
exports.getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await FeaturedReview.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Featured review not found'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Error fetching featured review:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching featured review',
      error: error.message
    });
  }
};

// Create featured review
exports.createReview = async (req, res) => {
  try {
    const {
      text,
      author,
      rating,
      authorRole,
      authorLocation,
      serviceType,
      isActive,
      displayOrder,
      featured
    } = req.body;

    // Validate required fields
    if (!text || !author || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Text, author, and rating are required'
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const review = new FeaturedReview({
      text,
      author,
      rating: Number(rating),
      authorRole: authorRole || '',
      authorLocation: authorLocation || '',
      serviceType: serviceType || '',
      isActive: isActive !== undefined ? isActive : true,
      displayOrder: displayOrder || 0,
      featured: featured || false
    });

    await review.save();

    res.status(201).json({
      success: true,
      message: 'Featured review created successfully',
      data: review
    });
  } catch (error) {
    console.error('Error creating featured review:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating featured review',
      error: error.message
    });
  }
};

// Update featured review
exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const updateData = req.body;

    // Validate rating if provided
    if (updateData.rating !== undefined) {
      if (updateData.rating < 1 || updateData.rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }
      updateData.rating = Number(updateData.rating);
    }

    const review = await FeaturedReview.findByIdAndUpdate(
      reviewId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Featured review not found'
      });
    }

    res.json({
      success: true,
      message: 'Featured review updated successfully',
      data: review
    });
  } catch (error) {
    console.error('Error updating featured review:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating featured review',
      error: error.message
    });
  }
};

// Delete featured review
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await FeaturedReview.findByIdAndDelete(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Featured review not found'
      });
    }

    res.json({
      success: true,
      message: 'Featured review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting featured review:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting featured review',
      error: error.message
    });
  }
};

