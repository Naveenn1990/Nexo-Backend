const { PricingSettings } = require('../models/RegisterFee');
const Joi = require('joi');

// Validation schema for fee management
const feeValidationSchema = Joi.object({
  partnerType: Joi.string().valid('individual', 'franchise').optional(),
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

    // Return both individual and franchise fees
    res.json({
      success: true,
      data: {
        // Default/Individual fees (backward compatible)
        registrationFee: settings.registrationFee || 500,
        securityDeposit: settings.securityDeposit || 1000,
        toolkitPrice: settings.toolkitPrice || 2499,
        registrationFeeRefundable: settings.registrationFeeRefundable !== undefined ? settings.registrationFeeRefundable : false,
        securityDepositRefundable: settings.securityDepositRefundable !== undefined ? settings.securityDepositRefundable : false,
        toolkitPriceRefundable: settings.toolkitPriceRefundable !== undefined ? settings.toolkitPriceRefundable : false,
        // Individual partner fees
        individual: {
          registrationFee: settings.individualRegistrationFee || settings.registrationFee || 500,
          securityDeposit: settings.individualSecurityDeposit || settings.securityDeposit || 1000,
          toolkitPrice: settings.individualToolkitPrice || settings.toolkitPrice || 2499,
          registrationFeeRefundable: settings.individualRegistrationFeeRefundable !== undefined ? settings.individualRegistrationFeeRefundable : (settings.registrationFeeRefundable || false),
          securityDepositRefundable: settings.individualSecurityDepositRefundable !== undefined ? settings.individualSecurityDepositRefundable : (settings.securityDepositRefundable || false),
          toolkitPriceRefundable: settings.individualToolkitPriceRefundable !== undefined ? settings.individualToolkitPriceRefundable : (settings.toolkitPriceRefundable || false)
        },
        // Franchise partner fees
        franchise: {
          registrationFee: settings.franchiseRegistrationFee || settings.registrationFee || 500,
          securityDeposit: settings.franchiseSecurityDeposit || settings.securityDeposit || 1000,
          toolkitPrice: settings.franchiseToolkitPrice || settings.toolkitPrice || 2499,
          registrationFeeRefundable: settings.franchiseRegistrationFeeRefundable !== undefined ? settings.franchiseRegistrationFeeRefundable : (settings.registrationFeeRefundable || false),
          securityDepositRefundable: settings.franchiseSecurityDepositRefundable !== undefined ? settings.franchiseSecurityDepositRefundable : (settings.securityDepositRefundable || false),
          toolkitPriceRefundable: settings.franchiseToolkitPriceRefundable !== undefined ? settings.franchiseToolkitPriceRefundable : (settings.toolkitPriceRefundable || false)
        }
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

    const partnerType = value.partnerType || 'individual';

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
        originalPrice: value.registrationFee + value.securityDeposit + 500,
        specialOfferActive: false,
        commissionRate: 15,
        freeCommissionThreshold: 1000,
        refundPolicy: "Registration fees are non-refundable once payment is processed"
      });
    }

    // Update partner type specific fees
    if (partnerType === 'individual') {
      settings.individualRegistrationFee = value.registrationFee;
      settings.individualSecurityDeposit = value.securityDeposit;
      settings.individualToolkitPrice = value.toolkitPrice;
      if (value.registrationFeeRefundable !== undefined) {
        settings.individualRegistrationFeeRefundable = value.registrationFeeRefundable;
      }
      if (value.securityDepositRefundable !== undefined) {
        settings.individualSecurityDepositRefundable = value.securityDepositRefundable;
      }
      if (value.toolkitPriceRefundable !== undefined) {
        settings.individualToolkitPriceRefundable = value.toolkitPriceRefundable;
      }
      // Also update default fees for backward compatibility
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
    } else if (partnerType === 'franchise') {
      settings.franchiseRegistrationFee = value.registrationFee;
      settings.franchiseSecurityDeposit = value.securityDeposit;
      settings.franchiseToolkitPrice = value.toolkitPrice;
      if (value.registrationFeeRefundable !== undefined) {
        settings.franchiseRegistrationFeeRefundable = value.registrationFeeRefundable;
      }
      if (value.securityDepositRefundable !== undefined) {
        settings.franchiseSecurityDepositRefundable = value.securityDepositRefundable;
      }
      if (value.toolkitPriceRefundable !== undefined) {
        settings.franchiseToolkitPriceRefundable = value.toolkitPriceRefundable;
      }
    }
    
    await settings.save();

    res.json({
      success: true,
      message: `${partnerType === 'individual' ? 'Individual' : 'Franchise'} partner fees updated successfully`,
      data: {
        partnerType,
        registrationFee: value.registrationFee,
        securityDeposit: value.securityDeposit,
        toolkitPrice: value.toolkitPrice,
        registrationFeeRefundable: value.registrationFeeRefundable,
        securityDepositRefundable: value.securityDepositRefundable,
        toolkitPriceRefundable: value.toolkitPriceRefundable
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

