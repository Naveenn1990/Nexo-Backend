const JobItem = require('../models/JobItem');
const MaterialCategory = require('../models/MaterialCategory');
const InventoryItem = require('../models/InventoryItem');
const Booking = require('../models/booking');
const { errorHandler } = require('../utils/ErrorHandl');

// Get all job items for a specific job
exports.getJobItems = async (req, res) => {
  try {
    const { jobId } = req.params;
    const partnerId = req.partner._id;

    // Verify the job belongs to the partner
    const booking = await Booking.findById(jobId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (booking.partnerId.toString() !== partnerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This job does not belong to you.'
      });
    }

    const jobItems = await JobItem.find({ jobId, partnerId })
      .populate('itemId', 'name description category')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: jobItems
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Add item to job
exports.addJobItem = async (req, res) => {
  try {
    const {
      jobId,
      itemId,
      itemName,
      quantity,
      unitPrice,
      totalPrice,
      description,
      category,
      isManual = false
    } = req.body;
    const partnerId = req.partner._id;

    // Validate required fields
    if (!jobId || !itemName || !quantity || unitPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Job ID, item name, quantity, and unit price are required'
      });
    }

    // Verify the job belongs to the partner
    const booking = await Booking.findById(jobId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (booking.partnerId.toString() !== partnerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This job does not belong to you.'
      });
    }

    // Calculate total price if not provided
    const calculatedTotalPrice = totalPrice || (quantity * unitPrice);

    const jobItem = await JobItem.create({
      jobId,
      partnerId,
      itemId: isManual ? null : itemId,
      itemName,
      quantity,
      unitPrice,
      totalPrice: calculatedTotalPrice,
      description,
      category,
      isManual
    });

    // Populate the created item
    const populatedJobItem = await JobItem.findById(jobItem._id)
      .populate('itemId', 'name description category');

    res.status(201).json({
      success: true,
      data: populatedJobItem
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Update job item
exports.updateJobItem = async (req, res) => {
  try {
    const { jobItemId } = req.params;
    const { quantity, unitPrice, totalPrice, description } = req.body;
    const partnerId = req.partner._id;

    const jobItem = await JobItem.findById(jobItemId);
    if (!jobItem) {
      return res.status(404).json({
        success: false,
        message: 'Job item not found'
      });
    }

    // Verify the job item belongs to the partner
    if (jobItem.partnerId.toString() !== partnerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This job item does not belong to you.'
      });
    }

    // Update fields
    if (quantity !== undefined) jobItem.quantity = quantity;
    if (unitPrice !== undefined) jobItem.unitPrice = unitPrice;
    if (description !== undefined) jobItem.description = description;
    
    // Recalculate total price if quantity or unit price changed
    if (quantity !== undefined || unitPrice !== undefined) {
      jobItem.totalPrice = totalPrice || (jobItem.quantity * jobItem.unitPrice);
    }

    jobItem.updatedAt = new Date();
    await jobItem.save();

    const populatedJobItem = await JobItem.findById(jobItem._id)
      .populate('itemId', 'name description category');

    res.status(200).json({
      success: true,
      data: populatedJobItem
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Delete job item
exports.deleteJobItem = async (req, res) => {
  try {
    const { jobItemId } = req.params;
    const partnerId = req.partner._id;

    const jobItem = await JobItem.findById(jobItemId);
    if (!jobItem) {
      return res.status(404).json({
        success: false,
        message: 'Job item not found'
      });
    }

    // Verify the job item belongs to the partner
    if (jobItem.partnerId.toString() !== partnerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This job item does not belong to you.'
      });
    }

    await JobItem.findByIdAndDelete(jobItemId);

    res.status(200).json({
      success: true,
      message: 'Job item deleted successfully'
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get job items summary (total cost, item count, etc.)
exports.getJobItemsSummary = async (req, res) => {
  try {
    const { jobId } = req.params;
    const partnerId = req.partner._id;

    // Verify the job belongs to the partner
    const booking = await Booking.findById(jobId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (booking.partnerId.toString() !== partnerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This job does not belong to you.'
      });
    }

    const jobItems = await JobItem.find({ jobId, partnerId });

    const summary = {
      totalItems: jobItems.length,
      totalCost: jobItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
      itemsByCategory: {},
      manualItems: jobItems.filter(item => item.isManual).length,
      inventoryItems: jobItems.filter(item => !item.isManual).length
    };

    // Group items by category
    jobItems.forEach(item => {
      const category = item.category || 'Uncategorized';
      if (!summary.itemsByCategory[category]) {
        summary.itemsByCategory[category] = {
          count: 0,
          totalCost: 0
        };
      }
      summary.itemsByCategory[category].count++;
      summary.itemsByCategory[category].totalCost += item.totalPrice || 0;
    });

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get all job items for partner (across all jobs)
exports.getAllPartnerJobItems = async (req, res) => {
  try {
    const partnerId = req.partner._id;
    const { page = 1, limit = 20, jobId, category } = req.query;

    const query = { partnerId };
    if (jobId) query.jobId = jobId;
    if (category) query.category = category;

    const jobItems = await JobItem.find(query)
      .populate('itemId', 'name description category')
      .populate('jobId', 'serviceType customerName createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await JobItem.countDocuments(query);

    res.status(200).json({
      success: true,
      data: jobItems,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    errorHandler(res, error);
  }
};