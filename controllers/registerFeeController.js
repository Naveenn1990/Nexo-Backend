const { PricingSettings,PlanFeature ,HelpContent  } = require('../models/RegisterFee');
const Joi = require('joi');

// Validation schema
const pricingValidationSchema = Joi.object({
  registrationFee: Joi.number().min(0).required(),
  securityDeposit: Joi.number().min(0).required(),
  toolkitPrice: Joi.number().min(0).required(),
  originalPrice: Joi.number().min(0).required(),
  specialOfferActive: Joi.boolean(),
  specialOfferText: Joi.string().allow(''),
  commissionRate: Joi.number().min(0).max(100).required(),
  freeCommissionThreshold: Joi.number().min(0).required(),
  refundPolicy: Joi.string().required()
});

const featureValidationSchema = Joi.object({
  feature: Joi.string().trim().min(1).required(),
  isActive: Joi.boolean(),
  order: Joi.number().integer().min(0)
});


// Get current pricing settings
const getPricingSettings = async (req, res) => {
  try {
    let settings = await PricingSettings.findOne();

    if (!settings) {
      // Create default settings if none exist
      settings = new PricingSettings({
        registrationFee: 500,
        securityDeposit: 1000,
        securityDepositOptions: [
          { amount: 500, label: "Basic Plan", description: "₹500 security deposit for basic services", default: false },
          { amount: 1000, label: "Standard Plan", description: "₹1000 security deposit for standard services", default: true },
          { amount: 2000, label: "Premium Plan", description: "₹2000 security deposit for premium services", default: false }
        ],
        toolkitPrice: 2499,
        originalPrice: 3000,
        specialOfferActive: true,
        specialOfferText: "Get your services job commission-free under service amount 1000 with this plan",
        commissionRate: 15,
        freeCommissionThreshold: 1000,
        refundPolicy: "Registration fees are non-refundable once payment is processed",
        registrationFeeRefundable: false,
        securityDepositRefundable: false,
        toolkitPriceRefundable: false
      });
      await settings.save();
    }

    // Ensure refundable fields are always included and properly typed
    const settingsObj = settings.toObject();

    // Force security deposit options to be included
    const defaultSecurityDepositOptions = [
      { amount: 500, label: "Basic Plan", description: "₹500 security deposit for basic services", default: false },
      { amount: 1000, label: "Standard Plan", description: "₹1000 security deposit for standard services", default: true },
      { amount: 2000, label: "Premium Plan", description: "₹2000 security deposit for premium services", default: false }
    ];

    const responseData = {
      ...settingsObj,
      registrationFee: settingsObj.registrationFee || 500,
      securityDeposit: settingsObj.securityDeposit || 1000,
      securityDepositOptions: settingsObj.securityDepositOptions && settingsObj.securityDepositOptions.length > 0
        ? settingsObj.securityDepositOptions
        : defaultSecurityDepositOptions,
      toolkitPrice: settingsObj.toolkitPrice || 2499,
      registrationFeeRefundable: settingsObj.registrationFeeRefundable !== undefined ? Boolean(settingsObj.registrationFeeRefundable) : false,
      securityDepositRefundable: settingsObj.securityDepositRefundable !== undefined ? Boolean(settingsObj.securityDepositRefundable) : false,
      toolkitPriceRefundable: settingsObj.toolkitPriceRefundable !== undefined ? Boolean(settingsObj.toolkitPriceRefundable) : false
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pricing settings',
      error: error.message
    });
  }
};

// Update pricing settings
const updatePricingSettings = async (req, res) => {
  try {
 
    // Validate business logic
    if (req.body.registrationFee >= req.body.originalPrice) {
      return res.status(400).json({
        success: false,
        message: 'Registration fee must be less than original price'
      });
    }

    // Deactivate current settings
   const settings= await PricingSettings.findOneAndUpdate({},req.body,{new:true});


    res.json({
      success: true,
      message: 'Pricing settings updated successfully',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating pricing settings',
      error: error.message
    });
  }
};

// Get pricing history
const getPricingHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const history = await PricingSettings.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PricingSettings.countDocuments();

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pricing history',
      error: error.message
    });
  }
};

// Calculate pricing metrics
const getPricingMetrics = async (req, res) => {
  try {
    const settings = await PricingSettings.findOne({ isActive: true });
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'No active pricing settings found'
      });
    }

    const metrics = {
      currentPrice: settings.registrationFee,
      originalPrice: settings.originalPrice,
      savings: settings.originalPrice - settings.registrationFee,
      discountPercentage: Math.round(((settings.originalPrice - settings.registrationFee) / settings.originalPrice) * 100),
      commissionRate: settings.commissionRate,
      freeCommissionThreshold: settings.freeCommissionThreshold,
      specialOfferActive: settings.specialOfferActive
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error calculating pricing metrics',
      error: error.message
    });
  }
};


const getFeatures = async (req, res) => {
  try {
    const features = await PlanFeature.find()
      .sort({ order: 1, createdAt: 1 });

    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching features',
      error: error.message
    });
  }
};

// Get active features only
const getActiveFeatures = async (req, res) => {
  try {
    const features = await PlanFeature.find({ isActive: true })
      .sort({ order: 1, createdAt: 1 });

    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching active features',
      error: error.message
    });
  }
};

// Create new feature
const createFeature = async (req, res) => {
  try {
    const { error, value } = featureValidationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    // Check if feature already exists
    const existingFeature = await PlanFeature.findOne({ 
      feature: new RegExp(`^${value.feature}$`, 'i') 
    });

    if (existingFeature) {
      return res.status(409).json({
        success: false,
        message: 'Feature already exists'
      });
    }

    // Set order if not provided
    if (!value.order) {
      const lastFeature = await PlanFeature.findOne().sort({ order: -1 });
      value.order = lastFeature ? lastFeature.order + 1 : 0;
    }

    const feature = new PlanFeature(value);
    await feature.save();

    res.status(201).json({
      success: true,
      message: 'Feature created successfully',
      data: feature
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating feature',
      error: error.message
    });
  }
};

// Update feature
const updateFeature = async (req, res) => {
  try {
    const { id } = req.params;
   
    const feature = await PlanFeature.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }

    res.json({
      success: true,
      message: 'Feature updated successfully',
      data: feature
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating feature',
      error: error.message
    });
  }
};

// Delete feature
const deleteFeature = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id)
    const feature = await PlanFeature.findByIdAndDelete(id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }

    res.json({
      success: true,
      message: 'Feature deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting feature',
      error: error.message
    });
  }
};

// Reorder features
const reorderFeatures = async (req, res) => {
  try {
    const { features } = req.body;

    if (!Array.isArray(features)) {
      return res.status(400).json({
        success: false,
        message: 'Features must be an array'
      });
    }

    // Update order for each feature
    const updatePromises = features.map((item, index) => {
      return PlanFeature.findByIdAndUpdate(
        item.id,
        { order: index },
        { new: true }
      );
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Features reordered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reordering features',
      error: error.message
    });
  }
};

// Toggle feature status
const toggleFeatureStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const feature = await PlanFeature.findById(id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }

    feature.isActive = !feature.isActive;
    await feature.save();

    res.json({
      success: true,
      message: `Feature ${feature.isActive ? 'activated' : 'deactivated'} successfully`,
      data: feature
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling feature status',
      error: error.message
    });
  }
};


// Validation schema
const helpValidationSchema = Joi.object({
  question: Joi.string().trim().min(1).required(),
  answer: Joi.string().trim().min(1).required(),
  isActive: Joi.boolean(),
  order: Joi.number().integer().min(0),
  category: Joi.string().trim().default('general')
});

// Get all help content
const getHelpContent = async (req, res) => {
  try {
    const { category, active } = req.query;
    
    let query = {};
    if (category) query.category = category;
    if (active !== undefined) query.isActive = active === 'true';

    const helpContent = await HelpContent.find(query)
      .sort({ order: 1, createdAt: 1 });

    res.json({
      success: true,
      data: helpContent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching help content',
      error: error.message
    });
  }
};

// Get active help content only
const getActiveHelpContent = async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = { isActive: true };
    if (category) query.category = category;

    const helpContent = await HelpContent.find(query)
      .sort({ order: 1, createdAt: 1 });

    res.json({
      success: true,
      data: helpContent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching active help content',
      error: error.message
    });
  }
};

// Create new help content
const createHelpContent = async (req, res) => {
  try {
    const { error, value } = helpValidationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    // Check if similar question already exists
    const existingHelp = await HelpContent.findOne({ 
      question: new RegExp(`^${value.question}$`, 'i') 
    });

    if (existingHelp) {
      return res.status(409).json({
        success: false,
        message: 'Similar question already exists'
      });
    }

    // Set order if not provided
    if (!value.order) {
      const lastHelp = await HelpContent.findOne().sort({ order: -1 });
      value.order = lastHelp ? lastHelp.order + 1 : 0;
    }

    const helpContent = new HelpContent(value);
    await helpContent.save();

    res.status(201).json({
      success: true,
      message: 'Help content created successfully',
      data: helpContent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating help content',
      error: error.message
    });
  }
};

// Update help content
const updateHelpContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = helpValidationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    // Check if similar question exists (excluding current)
    const existingHelp = await HelpContent.findOne({ 
      question: new RegExp(`^${value.question}$`, 'i'),
      _id: { $ne: id }
    });

    if (existingHelp) {
      return res.status(409).json({
        success: false,
        message: 'Similar question already exists'
      });
    }

    const helpContent = await HelpContent.findByIdAndUpdate(
      id,
      value,
      { new: true, runValidators: true }
    );

    if (!helpContent) {
      return res.status(404).json({
        success: false,
        message: 'Help content not found'
      });
    }

    res.json({
      success: true,
      message: 'Help content updated successfully',
      data: helpContent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating help content',
      error: error.message
    });
  }
};

// Delete help content
const deleteHelpContent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const helpContent = await HelpContent.findByIdAndDelete(id);

    if (!helpContent) {
      return res.status(404).json({
        success: false,
        message: 'Help content not found'
      });
    }

    res.json({
      success: true,
      message: 'Help content deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting help content',
      error: error.message
    });
  }
};

// Toggle help content status
const toggleHelpStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const helpContent = await HelpContent.findById(id);

    if (!helpContent) {
      return res.status(404).json({
        success: false,
        message: 'Help content not found'
      });
    }

    helpContent.isActive = !helpContent.isActive;
    await helpContent.save();

    res.json({
      success: true,
      message: `Help content ${helpContent.isActive ? 'activated' : 'deactivated'} successfully`,
      data: helpContent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling help content status',
      error: error.message
    });
  }
};

// Get help categories
const getHelpCategories = async (req, res) => {
  try {
    const categories = await HelpContent.distinct('category');
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching help categories',
      error: error.message
    });
  }
};

// Search help content
const searchHelpContent = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchResults = await HelpContent.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { question: { $regex: query, $options: 'i' } },
            { answer: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    }).sort({ order: 1, createdAt: 1 });

    res.json({
      success: true,
      data: searchResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching help content',
      error: error.message
    });
  }
};


module.exports = {
  getPricingSettings,
  updatePricingSettings,
  getPricingHistory,
  getPricingMetrics,
   getFeatures,
  getActiveFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  reorderFeatures,
  toggleFeatureStatus,
  getHelpContent,
  getActiveHelpContent,
  createHelpContent,
  updateHelpContent,
  deleteHelpContent,
  toggleHelpStatus,
  getHelpCategories,
  searchHelpContent,
};