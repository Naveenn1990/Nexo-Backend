const AMCContract = require('../models/AMCContract');
const AMCPlan = require('../models/AMCPlan');
const Partner = require('../models/PartnerModel');
const User = require('../models/User');

// Create a new AMC contract
exports.createAMCContract = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      partnerId,
      planId,
      startDate,
      duration,
      durationUnit,
      totalAmount,
      paymentTerms,
      specialTerms,
      status
    } = req.body;

    // Validate required fields
    if (!customerName || !customerPhone || !customerAddress || !partnerId || !planId || !startDate || !totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
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

    // Verify AMC plan exists
    const plan = await AMCPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'AMC Plan not found'
      });
    }

    // Check if customer is a registered user
    let userId = null;
    const existingUser = await User.findOne({ phone: customerPhone });
    if (existingUser) {
      userId = existingUser._id;
    }

    // Create the contract
    const contract = new AMCContract({
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        address: customerAddress,
        userId: userId
      },
      partnerId,
      planId,
      planDetails: {
        name: plan.name,
        price: plan.price,
        features: plan.features,
        includedServices: plan.includedServices,
        serviceFrequency: plan.serviceFrequency
      },
      startDate: new Date(startDate),
      duration: duration || 12,
      durationUnit: durationUnit || 'months',
      totalAmount: parseFloat(totalAmount),
      paymentTerms: paymentTerms || 'monthly',
      specialTerms,
      status: status || 'draft',
      createdBy: req.admin._id
    });

    await contract.save();

    // Populate the contract with partner and plan details
    const populatedContract = await AMCContract.findById(contract._id)
      .populate('partnerId', 'profile phone')
      .populate('planId', 'name price planType')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'AMC Contract created successfully',
      data: populatedContract
    });

  } catch (error) {
    console.error('Error creating AMC contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create AMC contract',
      error: error.message
    });
  }
};

// Get all AMC contracts
exports.getAMCContracts = async (req, res) => {
  try {
    const { status, partnerId, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (partnerId) {
      filter.partnerId = partnerId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Fetch contracts with pagination
    const contracts = await AMCContract.find(filter)
      .populate('partnerId', 'profile phone')
      .populate('planId', 'name price planType')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalContracts = await AMCContract.countDocuments(filter);

    res.json({
      success: true,
      data: contracts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalContracts / limit),
        totalContracts,
        hasNext: page * limit < totalContracts,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching AMC contracts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AMC contracts',
      error: error.message
    });
  }
};

// Get a specific AMC contract
exports.getAMCContract = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await AMCContract.findById(contractId)
      .populate('partnerId', 'profile phone')
      .populate('planId', 'name price planType features includedServices')
      .populate('createdBy', 'name email');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'AMC Contract not found'
      });
    }

    res.json({
      success: true,
      data: contract
    });

  } catch (error) {
    console.error('Error fetching AMC contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AMC contract',
      error: error.message
    });
  }
};

// Update AMC contract
exports.updateAMCContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.contractNumber;
    delete updateData.createdBy;
    delete updateData.createdAt;

    const contract = await AMCContract.findByIdAndUpdate(
      contractId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('partnerId', 'profile phone')
      .populate('planId', 'name price planType')
      .populate('createdBy', 'name email');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'AMC Contract not found'
      });
    }

    res.json({
      success: true,
      message: 'AMC Contract updated successfully',
      data: contract
    });

  } catch (error) {
    console.error('Error updating AMC contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update AMC contract',
      error: error.message
    });
  }
};

// Delete AMC contract
exports.deleteAMCContract = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await AMCContract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'AMC Contract not found'
      });
    }

    // Check if contract can be deleted (only draft contracts should be deletable)
    if (contract.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active contracts. Please suspend or cancel first.'
      });
    }

    await AMCContract.findByIdAndDelete(contractId);

    res.json({
      success: true,
      message: 'AMC Contract deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting AMC contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete AMC contract',
      error: error.message
    });
  }
};

// Get contract statistics
exports.getContractStats = async (req, res) => {
  try {
    const stats = await AMCContract.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalContracts = await AMCContract.countDocuments();
    const activeContracts = await AMCContract.countDocuments({ status: 'active' });
    const totalRevenue = await AMCContract.aggregate([
      { $match: { status: { $in: ['active', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalContracts,
        activeContracts,
        totalRevenue: totalRevenue[0]?.total || 0,
        statusBreakdown: stats
      }
    });

  } catch (error) {
    console.error('Error fetching contract stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract statistics',
      error: error.message
    });
  }
};

// Activate contract
exports.activateContract = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await AMCContract.findByIdAndUpdate(
      contractId,
      { 
        status: 'active',
        startDate: new Date() // Update start date to current date when activated
      },
      { new: true }
    )
      .populate('partnerId', 'profile phone')
      .populate('planId', 'name price planType');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'AMC Contract not found'
      });
    }

    res.json({
      success: true,
      message: 'AMC Contract activated successfully',
      data: contract
    });

  } catch (error) {
    console.error('Error activating AMC contract:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate AMC contract',
      error: error.message
    });
  }
};