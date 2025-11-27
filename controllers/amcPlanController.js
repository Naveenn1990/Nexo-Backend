const AMCPlan = require('../models/AMCPlan');

// Get all AMC plans (public - for CorporateAMC page)
// Returns all plans including inactive ones
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await AMCPlan.find({})
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching AMC plans:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching AMC plans',
      error: error.message
    });
  }
};

// Get all AMC plans (admin - includes inactive)
exports.getAllPlansAdmin = async (req, res) => {
  try {
    console.log('📊 Admin fetching AMC plans...');
    const plans = await AMCPlan.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    console.log(`✅ Found ${plans.length} AMC plan(s) for admin`);
    if (plans.length > 0) {
      console.log('   Plans:', plans.map(p => `${p.name} (${p.priceDisplay || `₹${p.price}`})`).join(', '));
    }

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('❌ Error fetching AMC plans (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching AMC plans',
      error: error.message
    });
  }
};

// Get plan by ID
exports.getPlanById = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await AMCPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'AMC plan not found'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error fetching AMC plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching AMC plan',
      error: error.message
    });
  }
};

// Create AMC plan
exports.createPlan = async (req, res) => {
  try {
    const {
      name,
      price,
      priceDisplay,
      features,
      description,
      isActive,
      displayOrder,
      highlight,
      highlightText,
      whatsappNumber,
      metadata
    } = req.body;

    // Validate required fields
    if (!name || price === undefined || !features || !Array.isArray(features)) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and features are required'
      });
    }

    const plan = new AMCPlan({
      name,
      price,
      priceDisplay: priceDisplay || `₹${price.toLocaleString('en-IN')}`,
      features,
      description: description || '',
      isActive: isActive !== undefined ? isActive : true,
      displayOrder: displayOrder || 0,
      highlight: highlight || false,
      highlightText: highlightText || '',
      whatsappNumber: whatsappNumber || '',
      metadata: metadata || {}
    });

    await plan.save();

    res.status(201).json({
      success: true,
      message: 'AMC plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error creating AMC plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating AMC plan',
      error: error.message
    });
  }
};

// Update AMC plan
exports.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const updateData = req.body;

    // If priceDisplay is not provided but price is, generate priceDisplay
    if (updateData.price !== undefined && !updateData.priceDisplay) {
      updateData.priceDisplay = `₹${updateData.price.toLocaleString('en-IN')}`;
    }

    const plan = await AMCPlan.findByIdAndUpdate(
      planId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'AMC plan not found'
      });
    }

    res.json({
      success: true,
      message: 'AMC plan updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error updating AMC plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating AMC plan',
      error: error.message
    });
  }
};

// Delete AMC plan
exports.deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await AMCPlan.findByIdAndDelete(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'AMC plan not found'
      });
    }

    res.json({
      success: true,
      message: 'AMC plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting AMC plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting AMC plan',
      error: error.message
    });
  }
};

