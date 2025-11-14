const { PricingSettings } = require('../models/RegisterFee');
const Joi = require('joi');

// Validation schema for fee management
const feeValidationSchema = Joi.object({
  registrationFee: Joi.number().min(0).required(),
  securityDeposit: Joi.number().min(0).required(),
  toolkitPrice: Joi.number().min(0).required(),
  registrationFeeRefundable: Joi.boolean().optional(),
  securityDepositRefundable: Joi.boolean().optional(),
  toolkitPriceRefundable: Joi.boolean().optional()
});

// Get current fees
exports.getFees = async (req, res) => {
  try {
    let settings = await PricingSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = new PricingSettings({
        registrationFee: 500,
        securityDeposit: 1000,
        toolkitPrice: 2499,
        originalPrice: 3000,
        specialOfferActive: true,
        specialOfferText: "Get your services job commission-free under service amount 1000 with this plan",
        commissionRate: 15,
        freeCommissionThreshold: 1000,
        refundPolicy: "Registration fees are non-refundable once payment is processed"
      });
      await settings.save();
    }

    res.json({
      success: true,
      data: {
        registrationFee: settings.registrationFee || 500,
        securityDeposit: settings.securityDeposit || 1000,
        toolkitPrice: settings.toolkitPrice || 2499,
        registrationFeeRefundable: settings.registrationFeeRefundable !== undefined ? settings.registrationFeeRefundable : false,
        securityDepositRefundable: settings.securityDepositRefundable !== undefined ? settings.securityDepositRefundable : false,
        toolkitPriceRefundable: settings.toolkitPriceRefundable !== undefined ? settings.toolkitPriceRefundable : false
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching fees',
      error: error.message
    });
  }
};

// Update fees
exports.updateFees = async (req, res) => {
  try {
    const { error, value } = feeValidationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    // Update or create settings
    let settings = await PricingSettings.findOne();
    
    if (!settings) {
      settings = new PricingSettings({
        registrationFee: value.registrationFee,
        securityDeposit: value.securityDeposit,
        toolkitPrice: value.toolkitPrice,
        registrationFeeRefundable: value.registrationFeeRefundable !== undefined ? value.registrationFeeRefundable : false,
        securityDepositRefundable: value.securityDepositRefundable !== undefined ? value.securityDepositRefundable : false,
        toolkitPriceRefundable: value.toolkitPriceRefundable !== undefined ? value.toolkitPriceRefundable : false,
        originalPrice: value.registrationFee + value.securityDeposit + 500, // Default calculation
        specialOfferActive: false,
        commissionRate: 15,
        freeCommissionThreshold: 1000,
        refundPolicy: "Registration fees are non-refundable once payment is processed"
      });
    } else {
      settings.registrationFee = value.registrationFee;
      settings.securityDeposit = value.securityDeposit;
      settings.toolkitPrice = value.toolkitPrice;
      if (value.registrationFeeRefundable !== undefined) {
        settings.registrationFeeRefundable = value.registrationFeeRefundable;
      }
      if (value.securityDepositRefundable !== undefined) {
        settings.securityDepositRefundable = value.securityDepositRefundable;
      }
      if (value.toolkitPriceRefundable !== undefined) {
        settings.toolkitPriceRefundable = value.toolkitPriceRefundable;
      }
    }
    
    await settings.save();

    res.json({
      success: true,
      message: 'Fees updated successfully',
      data: {
        registrationFee: settings.registrationFee,
        securityDeposit: settings.securityDeposit,
        toolkitPrice: settings.toolkitPrice,
        registrationFeeRefundable: settings.registrationFeeRefundable,
        securityDepositRefundable: settings.securityDepositRefundable,
        toolkitPriceRefundable: settings.toolkitPriceRefundable
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating fees',
      error: error.message
    });
  }
};

