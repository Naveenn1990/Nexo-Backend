const MGPlan = require('../models/MGPlan');
const Partner = require('../models/PartnerModel');
const PartnerWallet = require('../models/PartnerWallet');

// Get all MG Plans
exports.getAllPlans = async (req, res) => {
  try {
    const isAdminRequest = Boolean(req.admin);
    const query = isAdminRequest ? {} : { isActive: true };
    const plans = await MGPlan.find(query).sort({ price: 1 });
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Get All Plans Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching plans',
      error: error.message
    });
  }
};

// Get plan by ID
exports.getPlanById = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await MGPlan.findById(planId);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }
    
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Get Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching plan',
      error: error.message
    });
  }
};

// Create MG Plan (Admin only)
exports.createPlan = async (req, res) => {
  try {
    const {
      name,
      price,
      leads,
      commission,
      leadFee,
      minWalletBalance,
      description,
      refundPolicy,
      features,
      isDefault,
      icon,
      validityType,
      validityMonths
    } = req.body;
    
    // Validate required fields
    if (!name || price === undefined || leads === undefined || commission === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, leads, and commission are required'
      });
    }
    
    // If setting as default, unset other defaults
    if (isDefault) {
      await MGPlan.updateMany({}, { isDefault: false });
    }
    
    // Calculate validity months based on validity type
    let calculatedValidityMonths = 1;
    if (validityType === 'monthly') {
      calculatedValidityMonths = 1;
    } else if (validityType === 'quarterly') {
      calculatedValidityMonths = 3;
    } else if (validityType === 'yearly') {
      calculatedValidityMonths = 12;
    } else if (validityType === 'custom' && validityMonths) {
      calculatedValidityMonths = Number(validityMonths);
    }

    const plan = new MGPlan({
      name,
      price,
      leads,
      commission,
      leadFee: leadFee !== undefined ? leadFee : 50,
      minWalletBalance: minWalletBalance !== undefined ? minWalletBalance : 20,
      description: description || '',
      refundPolicy: refundPolicy || undefined,
      features: features || [],
      isDefault: isDefault || false,
      icon: icon || '',
      validityType: validityType || 'monthly',
      validityMonths: calculatedValidityMonths
    });
    
    await plan.save();
    
    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Create Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating plan',
      error: error.message
    });
  }
};

// Update MG Plan (Admin only)
exports.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const {
      name,
      price,
      leads,
      commission,
      leadFee,
      minWalletBalance,
      description,
      refundPolicy,
      features,
      isActive,
      isDefault,
      icon,
      validityType,
      validityMonths
    } = req.body;
    
    const plan = await MGPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }
    
    // If setting as default, unset other defaults
    if (isDefault) {
      await MGPlan.updateMany({ _id: { $ne: planId } }, { isDefault: false });
    }
    
    if (name) plan.name = name;
    if (price !== undefined) plan.price = price;
    if (leads !== undefined) plan.leads = leads;
    if (commission !== undefined) plan.commission = commission;
    if (description !== undefined) plan.description = description;
    if (refundPolicy !== undefined) plan.refundPolicy = refundPolicy;
    if (leadFee !== undefined) plan.leadFee = leadFee;
    if (minWalletBalance !== undefined) plan.minWalletBalance = minWalletBalance;
    if (features !== undefined) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;
    
    // Handle validity updates
    if (validityType !== undefined) {
      plan.validityType = validityType;
      // Calculate validity months based on validity type
      if (validityType === 'monthly') {
        plan.validityMonths = 1;
      } else if (validityType === 'quarterly') {
        plan.validityMonths = 3;
      } else if (validityType === 'yearly') {
        plan.validityMonths = 12;
      } else if (validityType === 'custom' && validityMonths !== undefined) {
        plan.validityMonths = Number(validityMonths);
      }
    } else if (validityMonths !== undefined) {
      plan.validityMonths = Number(validityMonths);
    }
    if (isDefault !== undefined) plan.isDefault = isDefault;
    if (icon !== undefined) plan.icon = icon;
    
    await plan.save();
    
    res.json({
      success: true,
      message: 'Plan updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Update Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating plan',
      error: error.message
    });
  }
};

// Delete MG Plan (Admin only)
exports.deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    
    const plan = await MGPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }
    
    // Check if any partner is using this plan
    const partnersUsingPlan = await Partner.countDocuments({ mgPlan: planId });
    if (partnersUsingPlan > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete plan. ${partnersUsingPlan} partner(s) are using this plan.`
      });
    }
    
    await MGPlan.findByIdAndDelete(planId);
    
    res.json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    console.error('Delete Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting plan',
      error: error.message
    });
  }
};

// Partner: Select/Subscribe to MG Plan
exports.subscribeToPlan = async (req, res) => {
  try {
    const { planId } = req.body;
    const partnerId = req.partner._id;
    
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }
    
    const plan = await MGPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found or inactive'
      });
    }
    
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    const subscribedAt = new Date();
    const expiresAt = new Date(subscribedAt);
    // Use plan's validityMonths, default to 1 month if not set
    const validityMonths = plan.validityMonths || 1;
    expiresAt.setMonth(expiresAt.getMonth() + validityMonths);

    partner.mgPlan = planId;
    partner.mgPlanLeadQuota = plan.leads;
    partner.mgPlanLeadsUsed = 0;
    partner.mgPlanSubscribedAt = subscribedAt;
    partner.mgPlanExpiresAt = expiresAt;
    partner.leadAcceptancePaused = false;

    const historyEntry = {
      plan: plan._id,
      planName: plan.name,
      price: plan.price,
      leadsGuaranteed: plan.leads,
      commissionRate: plan.commission,
      leadFee: plan.leadFee,
      subscribedAt,
      expiresAt,
      leadsConsumed: 0,
      refundStatus: 'pending',
      refundNotes: plan.refundPolicy
    };

    if (!Array.isArray(partner.mgPlanHistory)) {
      partner.mgPlanHistory = [];
    }
    partner.mgPlanHistory.push(historyEntry);
    if (partner.mgPlanHistory.length > 24) {
      partner.mgPlanHistory = partner.mgPlanHistory.slice(-24);
    }
    partner.markModified('mgPlanHistory');

    await partner.save();
    
    res.json({
      success: true,
      message: 'Successfully subscribed to plan',
      data: {
        plan,
        partner: {
          id: partner._id,
          mgPlan: partner.mgPlan,
          subscribedAt: partner.mgPlanSubscribedAt,
          expiresAt: partner.mgPlanExpiresAt,
          leadsGuaranteed: plan.leads,
          commissionRate: plan.commission,
          leadFee: plan.leadFee,
          minWalletBalance: plan.minWalletBalance
        }
      }
    });
  } catch (error) {
    console.error('Subscribe Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error subscribing to plan',
      error: error.message
    });
  }
};

// Partner: Get current plan
exports.getPartnerPlan = async (req, res) => {
  try {
    const partnerId = req.partner._id;
    
    const partner = await Partner.findById(partnerId)
      .populate('mgPlan')
      .populate({
        path: 'mgPlanHistory.plan',
        select: 'name price leads commission leadFee minWalletBalance'
      });
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    // If no plan assigned, get default plan or create one
    let plan = partner.mgPlan;
    if (!plan) {
      plan = await MGPlan.findOne({ isDefault: true, isActive: true });
      
      // If no default plan exists, create Silver as default
      if (!plan) {
        plan = await MGPlan.findOne({ name: 'Silver', isActive: true });
        if (!plan) {
          // Create default Silver plan if none exists
          plan = new MGPlan({
            name: 'Silver',
            price: 1000,
            leads: 20,
            commission: 5,
            leadFee: 50,
            minWalletBalance: 20,
            description: 'Basic plan with guaranteed leads',
            isDefault: true,
            isActive: true
          });
          await plan.save();
        } else {
          // Set Silver as default
          await MGPlan.updateMany({}, { isDefault: false });
          plan.isDefault = true;
          await plan.save();
        }
      }
      // Assign default plan to partner
      if (plan) {
        const subscribedAt = new Date();
        const expiresAt = new Date(subscribedAt);
        // Use plan's validityMonths, default to 1 month if not set
        const validityMonths = plan.validityMonths || 1;
        expiresAt.setMonth(expiresAt.getMonth() + validityMonths);

        partner.mgPlan = plan._id;
        partner.mgPlanLeadQuota = plan.leads;
        partner.mgPlanLeadsUsed = 0;
        partner.mgPlanSubscribedAt = subscribedAt;
        partner.mgPlanExpiresAt = expiresAt;
        partner.leadAcceptancePaused = false;

        partner.mgPlanHistory = partner.mgPlanHistory || [];
        partner.mgPlanHistory.push({
          plan: plan._id,
          planName: plan.name,
          price: plan.price,
          leadsGuaranteed: plan.leads,
          commissionRate: plan.commission,
          leadFee: plan.leadFee,
          subscribedAt,
          expiresAt,
          leadsConsumed: 0,
          refundStatus: 'pending',
          refundNotes: plan.refundPolicy
        });
        await partner.save();
      }
    }

    const wallet = await PartnerWallet.findOne({ partner: partner._id });
    const walletBalance = wallet?.balance ?? 0;
    const leadFee = plan?.leadFee ?? 50;
    const minWalletBalance = plan?.minWalletBalance ?? 20;

    const leadsGuaranteed = plan?.leads ?? 0;
    const leadsUsed = partner.mgPlanLeadsUsed ?? 0;
    const leadsRemaining = Math.max(leadsGuaranteed - leadsUsed, 0);

    let historyEntry = Array.isArray(partner.mgPlanHistory) && partner.mgPlanHistory.length
      ? partner.mgPlanHistory[partner.mgPlanHistory.length - 1]
      : null;

    if (historyEntry && historyEntry.plan && plan && historyEntry.plan.toString() !== plan._id.toString()) {
      historyEntry = partner.mgPlanHistory.find(
        (entry) => entry.plan && entry.plan.toString() === plan._id.toString()
      ) || historyEntry;
    }

    const now = new Date();
    const isExpired = partner.mgPlanExpiresAt ? now > partner.mgPlanExpiresAt : false;
    let refundStatus = historyEntry?.refundStatus || 'pending';
    if (isExpired && leadsUsed < leadsGuaranteed) {
      if (historyEntry && historyEntry.refundStatus !== 'processed') {
        historyEntry.refundStatus = 'eligible';
        refundStatus = 'eligible';
        partner.markModified('mgPlanHistory');
        await partner.save();
      }
    }

    res.json({
      success: true,
      data: {
        plan: plan || null,
        subscribedAt: partner.mgPlanSubscribedAt,
        expiresAt: partner.mgPlanExpiresAt,
        isExpired,
        leadsGuaranteed,
        leadsUsed,
        leadsRemaining,
        leadFee,
        minWalletBalance,
        walletBalance,
        leadAcceptancePaused: partner.leadAcceptancePaused,
        refundStatus,
        history: partner.mgPlanHistory || []
      }
    });
  } catch (error) {
    console.error('Get Partner Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching partner plan',
      error: error.message
    });
  }
};

// Partner: Renew current plan
exports.renewPlan = async (req, res) => {
  try {
    const partnerId = req.partner._id;
    
    const partner = await Partner.findById(partnerId).populate('mgPlan');
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    const plan = partner.mgPlan;
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: 'No active plan found. Please subscribe to a plan first.'
      });
    }

    if (!plan.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Your current plan is inactive. Please select a new plan.'
      });
    }

    const now = new Date();
    const currentExpiry = partner.mgPlanExpiresAt || now;
    const newExpiry = new Date(currentExpiry);
    
    // Use plan's validityMonths, default to 1 month if not set
    const validityMonths = plan.validityMonths || 1;
    
    // If plan is expired, start from today. Otherwise, extend from current expiry
    if (currentExpiry < now) {
      newExpiry.setMonth(now.getMonth() + validityMonths);
    } else {
      newExpiry.setMonth(newExpiry.getMonth() + validityMonths);
    }

    partner.mgPlanExpiresAt = newExpiry;
    partner.leadAcceptancePaused = false;
    
    // Reset lead usage if plan was expired
    if (currentExpiry < now) {
      partner.mgPlanLeadsUsed = 0;
      partner.mgPlanSubscribedAt = now;
    }

    // Update history entry
    if (Array.isArray(partner.mgPlanHistory) && partner.mgPlanHistory.length > 0) {
      const latestEntry = partner.mgPlanHistory[partner.mgPlanHistory.length - 1];
      if (latestEntry.plan && latestEntry.plan.toString() === plan._id.toString()) {
        latestEntry.expiresAt = newExpiry;
        if (currentExpiry < now) {
          latestEntry.subscribedAt = now;
          latestEntry.leadsConsumed = 0;
        }
        partner.markModified('mgPlanHistory');
      }
    }

    await partner.save();

    res.json({
      success: true,
      message: 'Plan renewed successfully',
      data: {
        plan: {
          name: plan.name,
          price: plan.price,
          leads: plan.leads,
          commission: plan.commission
        },
        expiresAt: newExpiry,
        leadsGuaranteed: plan.leads,
        leadsUsed: partner.mgPlanLeadsUsed,
        leadsRemaining: Math.max(plan.leads - partner.mgPlanLeadsUsed, 0)
      }
    });
  } catch (error) {
    console.error('Renew Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error renewing plan',
      error: error.message
    });
  }
};

