const SubscriptionPlan = require('../models/SubscriptionPlan');

// Get all subscription plans (public - for home page)
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription plans',
      error: error.message
    });
  }
};

// Get all subscription plans (admin - includes inactive)
exports.getAllPlansAdmin = async (req, res) => {
  try {
    console.log('📊 Admin fetching subscription plans...');
    const plans = await SubscriptionPlan.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    console.log(`✅ Found ${plans.length} subscription plan(s) for admin`);
    if (plans.length > 0) {
      console.log('   Plans:', plans.map(p => `${p.name} (₹${p.price})`).join(', '));
    }

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('❌ Error fetching subscription plans (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription plans',
      error: error.message
    });
  }
};

// Get plan by ID
exports.getPlanById = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error fetching subscription plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription plan',
      error: error.message
    });
  }
};

// Create subscription plan
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

    const plan = new SubscriptionPlan({
      name,
      price,
      priceDisplay: priceDisplay || `₹${price}`,
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
      message: 'Subscription plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating subscription plan',
      error: error.message
    });
  }
};

// Update subscription plan
exports.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const updateData = req.body;

    // If priceDisplay is not provided but price is, generate priceDisplay
    if (updateData.price !== undefined && !updateData.priceDisplay) {
      updateData.priceDisplay = `₹${updateData.price}`;
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      planId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    res.json({
      success: true,
      message: 'Subscription plan updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating subscription plan',
      error: error.message
    });
  }
};

// Delete subscription plan
exports.deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await SubscriptionPlan.findByIdAndDelete(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    res.json({
      success: true,
      message: 'Subscription plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting subscription plan',
      error: error.message
    });
  }
};

