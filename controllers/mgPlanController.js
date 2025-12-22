const MGPlan = require('../models/MGPlan');
const Partner = require('../models/PartnerModel');
const PartnerWallet = require('../models/PartnerWallet');
const { PaymentTransaction } = require('../models/RegisterFee');
const phonePayModel = require('../models/phonePay');
const mongoose = require('mongoose');

// Get all MG Plans
exports.getAllPlans = async (req, res) => {
  try {
    const isAdminRequest = Boolean(req.admin);
    const { partnerType } = req.query;
    
    let query = isAdminRequest ? {} : { isActive: true };
    
    // Filter by partner type if provided
    if (partnerType && ['individual', 'franchise'].includes(partnerType)) {
      query.$or = [
        { partnerType: partnerType },
        { partnerType: 'both' }
      ];
    }
    
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
      validityMonths,
      partnerType
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
      validityMonths: calculatedValidityMonths,
      partnerType: partnerType || 'individual'
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
      validityMonths,
      partnerType
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
    if (partnerType !== undefined) plan.partnerType = partnerType;
    
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
    const { planId, payId } = req.body;
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
    
    // Fetch partner with category populated to check for lead creation
    const partner = await Partner.findById(partnerId)
      .populate('category', 'name')
      .populate('service', 'name');
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    // Get partner name from profile or use phone as fallback
    const partnerName = partner.profile?.name || partner.name || partner.phone || 'Unknown Partner';
    
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
    
    // Create lead when partner subscribes to plan from Lead Marketplace
    // Check if partner registered from Lead Marketplace (check metadata or profile status)
    try {
      const Lead = require('../models/Lead');
      
      // Check if lead already exists for this partner's plan subscription
      const existingLead = await Lead.findOne({ 
        'metadata.partnerId': partnerId.toString(),
        'metadata.planSubscriptionId': planId.toString(),
        'metadata.createdBy': 'plan_subscription'
      });
      
      // Create lead if partner has categories and city, and no existing lead
      // This lead will appear in admin Lead Management page
      // Check if partner has category (could be populated or just ObjectId)
      const hasCategory = partner.category && (
        (Array.isArray(partner.category) && partner.category.length > 0) ||
        (!Array.isArray(partner.category) && partner.category)
      );
      const hasCity = partner.profile?.city && partner.profile.city.trim() !== '';
      
      console.log('🔍 Lead creation check:');
      console.log('  - Has category:', hasCategory);
      console.log('  - Category value:', partner.category);
      console.log('  - Has city:', hasCity);
      console.log('  - City value:', partner.profile?.city);
      console.log('  - Existing lead:', !!existingLead);
      
      if (!existingLead && hasCategory && hasCity) {
        const leadCategory = Array.isArray(partner.category) ? partner.category[0] : partner.category;
        
        // Ensure leadCategory is an ObjectId
        const categoryId = leadCategory._id || leadCategory;
        
        const lead = new Lead({
          user: null, // No user for plan subscription leads
          booking: null, // No booking for plan subscription leads
          category: categoryId,
          service: partner.service && partner.service.length > 0 ? (partner.service[0]._id || partner.service[0]) : null,
          subService: null,
          city: partner.profile.city,
          location: {
            address: partner.profile.address || '',
            landmark: partner.profile.landmark || '',
            pincode: partner.profile.pincode || '',
            coordinates: {
              lat: 0,
              lng: 0
            }
          },
          value: plan.price || 0, // Use plan price as lead value
          allocationStrategy: 'rule_based',
          priority: 'high', // Higher priority for plan subscribers
          status: 'awaiting_bid',
          expiryTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          metadata: {
            description: `Partner subscribed to ${plan.name} plan from Lead Marketplace - ${partner.profile?.name || 'Partner'}`,
            createdBy: 'plan_subscription',
            partnerId: partnerId.toString(),
            partnerName: partner.profile?.name,
            partnerPhone: partner.phone,
            partnerEmail: partner.profile?.email,
            planSubscriptionId: planId.toString(),
            planName: plan.name,
            planPrice: plan.price,
            fromLeadMarketplace: true // Flag to identify leads from Lead Marketplace
          }
        });
        
        await lead.save();
        
        // Populate the lead to get category name for logging
        await lead.populate('category', 'name');
        
        console.log('✅ Lead created for plan subscription:');
        console.log('  - Lead ID:', lead.leadId);
        console.log('  - Partner:', partner.profile?.name || partner.phone);
        console.log('  - Plan:', plan.name);
        console.log('  - Category:', lead.category?.name || 'N/A');
        console.log('  - City:', lead.city);
        console.log('  - Value: ₹', lead.value);
        console.log('  - Status:', lead.status);
        console.log('  - This lead will appear in Admin Lead Management page');
      } else if (existingLead) {
        console.log('⚠️ Lead already exists for this plan subscription, skipping creation');
        console.log('  - Existing Lead ID:', existingLead.leadId);
      } else {
        console.log('⚠️ Cannot create lead: Missing category or city');
        console.log('  - Has category:', hasCategory);
        console.log('  - Category value:', partner.category);
        console.log('  - Has city:', hasCity);
        console.log('  - City value:', partner.profile?.city);
        console.log('  - Existing lead:', !!existingLead);
      }
    } catch (leadErr) {
      console.error('❌ Error creating lead for plan subscription:', leadErr);
      console.error('  - Error details:', leadErr.message);
      // Don't block plan subscription if lead creation fails
    }
    
    // Verify and get PhonePe transaction details if payId is provided
    let phonePeTransaction = null;
    let phonePeTransactionId = null;
    let paymentStatus = 'success'; // Default to success
    
    if (payId) {
      try {
        // Check if payId is a valid ObjectId or string
        const isValidObjectId = mongoose.Types.ObjectId.isValid(payId);
        if (isValidObjectId) {
          phonePeTransaction = await phonePayModel.findById(payId);
        } else {
          // Try to find by transactionid field
          phonePeTransaction = await phonePayModel.findOne({ transactionid: payId });
        }
        
        if (phonePeTransaction) {
          phonePeTransactionId = phonePeTransaction.transactionid || phonePeTransaction._id.toString();
          // Map PhonePe status to our status
          if (phonePeTransaction.status === 'COMPLETED') {
            paymentStatus = 'success';
          } else if (phonePeTransaction.status === 'FAILED') {
            paymentStatus = 'failed';
          } else {
            paymentStatus = 'pending';
          }
        } else {
          // If transaction not found, use payId as phonepeTransactionId
          phonePeTransactionId = payId;
        }
      } catch (phonePeError) {
        console.error('Error fetching PhonePe transaction:', phonePeError);
        // Continue with payId as phonepeTransactionId
        phonePeTransactionId = payId;
      }
    }
    
    // Record MG Plan fee transaction
    try {
      const timestamp = Date.now();
      const uniqueId = phonePeTransactionId || payId || partnerId.toString();
      
      // Build transaction object - only include phonepeTransactionId if it has a value
      const transactionData = {
        partnerId: partnerId.toString(),
        amount: plan.price,
        status: paymentStatus,
        paymentMethod: 'whatsapp',
        transactionId: `MG-${uniqueId}-${timestamp}`,
        feeType: 'mg_plan',
        description: `MG Plan Subscription - ${plan.name} - Partner: ${partnerName}`,
        metadata: {
          planId: planId.toString(),
          planName: plan.name,
          leadsGuaranteed: plan.leads,
          commissionRate: plan.commission,
          leadFee: plan.leadFee,
          validityMonths: plan.validityMonths || 1,
          subscribedAt: subscribedAt,
          expiresAt: expiresAt,
          partnerName: partnerName,
          partnerPhone: partner.phone || null,
          partnerEmail: partner.profile?.email || null,
          phonePeMerchantTransactionId: payId || null,
          phonePeStatus: phonePeTransaction?.status || null
        }
      };
      
      // Only add phonepeTransactionId if it has a value (to avoid duplicate null key error)
      if (phonePeTransactionId || payId) {
        transactionData.phonepeTransactionId = phonePeTransactionId || payId;
      }
      
      await PaymentTransaction.create(transactionData);
    } catch (txnError) {
      console.error('Error recording MG plan transaction:', txnError);
      // Don't fail the subscription if transaction recording fails
    }
    
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
    
    // Check if partner has an active plan
    let plan = partner.mgPlan;
    let isFreePlan = false;
    
    // If no plan assigned or plan is null, partner is on free plan
    if (!plan) {
      isFreePlan = true;
      // Don't auto-assign a default plan, let them stay on free plan
      // Free plan has no guaranteed leads, no commission benefits
    }

    const wallet = await PartnerWallet.findOne({ partner: partner._id });
    const walletBalance = wallet?.balance ?? 0;
    
    // Free plan settings
    if (isFreePlan) {
      return res.json({
        success: true,
        data: {
          plan: null,
          isFreePlan: true,
          subscribedAt: null,
          expiresAt: null,
          isExpired: false,
          leadsGuaranteed: 0,
          leadsUsed: 0,
          leadsRemaining: 0,
          leadFee: 100, // Higher lead fee for free plan
          minWalletBalance: 50, // Higher minimum wallet balance for free plan
          walletBalance,
          leadAcceptancePaused: partner.leadAcceptancePaused || false,
          refundStatus: 'not_applicable',
          history: partner.mgPlanHistory || [],
          planStatus: 'Free Plan - No guaranteed leads'
        }
      });
    }

    // Paid plan logic
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
        isFreePlan: false,
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
        history: partner.mgPlanHistory || [],
        planStatus: isExpired ? 'Expired' : 'Active'
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

// Admin: Subscribe partner to MG Plan with payment details
exports.adminSubscribeToPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { partnerId, paymentMethod, collectedBy, transactionId } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: 'Partner ID is required'
      });
    }
    
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }
    
    // Validate payment details
    if (!paymentMethod || !['cash', 'online', 'upi'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment method is required (cash, online, or upi)'
      });
    }
    
    if (paymentMethod === 'cash' && !collectedBy) {
      return res.status(400).json({
        success: false,
        message: 'Collected by name is required for cash payments'
      });
    }
    
    if ((paymentMethod === 'online' || paymentMethod === 'upi') && !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required for online/UPI payments'
      });
    }
    
    const plan = await MGPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }
    
    const partner = await Partner.findById(partnerId)
      .populate('category', 'name')
      .populate('service', 'name');
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    const partnerName = partner.profile?.name || partner.name || partner.phone || 'Unknown Partner';
    
    const subscribedAt = new Date();
    const expiresAt = new Date(subscribedAt);
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
      refundNotes: plan.refundPolicy,
      paymentMethod,
      ...(paymentMethod === 'cash' ? { collectedBy } : { transactionId })
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
    
    // Record MG Plan fee transaction with payment details
    try {
      const timestamp = Date.now();
      const uniqueId = transactionId || partnerId.toString();
      
      const transactionData = {
        partnerId: partnerId.toString(),
        amount: plan.price,
        status: 'success',
        paymentMethod: paymentMethod,
        transactionId: transactionId || `MG-${uniqueId}-${timestamp}`,
        feeType: 'mg_plan',
        description: `MG Plan Subscription - ${plan.name} - Partner: ${partnerName} (Admin Assigned)`,
        metadata: {
          planId: planId.toString(),
          planName: plan.name,
          leadsGuaranteed: plan.leads,
          commissionRate: plan.commission,
          leadFee: plan.leadFee,
          validityMonths: plan.validityMonths || 1,
          subscribedAt: subscribedAt,
          expiresAt: expiresAt,
          partnerName: partnerName,
          partnerPhone: partner.phone || null,
          partnerEmail: partner.profile?.email || null,
          paymentMethod: paymentMethod,
          ...(paymentMethod === 'cash' ? { collectedBy } : { transactionId }),
          assignedBy: 'admin'
        }
      };
      
      await PaymentTransaction.create(transactionData);
    } catch (txnError) {
      console.error('Error recording MG plan transaction:', txnError);
      // Don't fail the subscription if transaction recording fails
    }
    
    res.json({
      success: true,
      message: 'Successfully subscribed partner to plan',
      data: {
        plan,
        partner: {
          id: partner._id,
          name: partnerName,
          mgPlan: partner.mgPlan,
          subscribedAt: partner.mgPlanSubscribedAt,
          expiresAt: partner.mgPlanExpiresAt,
          leadsGuaranteed: plan.leads,
          commissionRate: plan.commission,
          leadFee: plan.leadFee,
          minWalletBalance: plan.minWalletBalance
        },
        paymentDetails: {
          method: paymentMethod,
          ...(paymentMethod === 'cash' ? { collectedBy } : { transactionId })
        }
      }
    });
  } catch (error) {
    console.error('Admin Subscribe Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error subscribing partner to plan',
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

// Admin: Get partner's MG plan history
exports.getPartnerPlanHistory = async (req, res) => {
  try {
    const { partnerId } = req.params;
    
    const partner = await Partner.findById(partnerId)
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
    
    res.json({
      success: true,
      data: {
        partnerId: partner._id,
        partnerName: partner.profile?.name || partner.name || partner.phone,
        history: partner.mgPlanHistory || []
      }
    });
  } catch (error) {
    console.error('Get Partner Plan History Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching partner plan history',
      error: error.message
    });
  }
};

// Admin: Delete MG plan history entry
exports.deletePlanHistoryEntry = async (req, res) => {
  try {
    const { partnerId, historyIndex } = req.params;
    
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    if (!Array.isArray(partner.mgPlanHistory)) {
      return res.status(404).json({
        success: false,
        message: 'No plan history found'
      });
    }
    
    const index = parseInt(historyIndex);
    if (isNaN(index) || index < 0 || index >= partner.mgPlanHistory.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid history index'
      });
    }
    
    // Remove the history entry at the specified index
    const deletedEntry = partner.mgPlanHistory.splice(index, 1)[0];
    partner.markModified('mgPlanHistory');
    await partner.save();
    
    res.json({
      success: true,
      message: 'Plan history entry deleted successfully',
      data: {
        deletedEntry,
        remainingHistory: partner.mgPlanHistory
      }
    });
  } catch (error) {
    console.error('Delete Plan History Entry Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting plan history entry',
      error: error.message
    });
  }
};

// Admin: Remove MG Plan from partner (set to free plan)
exports.removeMGPlan = async (req, res) => {
  try {
    const { partnerId } = req.params;
    
    const partner = await Partner.findById(partnerId).populate('mgPlan');
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    // Store current plan info for history
    const currentPlan = partner.mgPlan;
    const currentPlanName = currentPlan ? currentPlan.name : 'Unknown Plan';
    
    // Add removal entry to history if there was an active plan
    if (currentPlan) {
      const removalEntry = {
        plan: null, // No plan reference for removal entry
        planName: `Removed: ${currentPlanName}`,
        price: 0,
        leadsGuaranteed: 0,
        commissionRate: 0,
        leadFee: 0,
        subscribedAt: new Date(),
        expiresAt: null,
        leadsConsumed: partner.mgPlanLeadsUsed || 0,
        refundStatus: 'removed',
        refundNotes: `Plan removed by admin. Previous plan: ${currentPlanName}`,
        paymentMethod: 'admin_action',
        transactionId: `REMOVE-${partnerId}-${Date.now()}`
      };
      
      if (!Array.isArray(partner.mgPlanHistory)) {
        partner.mgPlanHistory = [];
      }
      partner.mgPlanHistory.push(removalEntry);
      
      // Keep only last 24 entries
      if (partner.mgPlanHistory.length > 24) {
        partner.mgPlanHistory = partner.mgPlanHistory.slice(-24);
      }
      partner.markModified('mgPlanHistory');
    }
    
    // Reset MG plan fields to free plan state
    partner.mgPlan = null;
    partner.mgPlanSubscribedAt = null;
    partner.mgPlanExpiresAt = null;
    partner.mgPlanLeadQuota = 0;
    partner.mgPlanLeadsUsed = 0;
    partner.leadAcceptancePaused = false;
    
    await partner.save();
    
    res.json({
      success: true,
      message: 'MG Plan removed successfully. Partner is now on free plan.',
      data: {
        partnerId: partner._id,
        partnerName: partner.profile?.name || partner.name || partner.phone,
        previousPlan: currentPlanName,
        currentStatus: 'Free Plan',
        mgPlan: null,
        mgPlanSubscribedAt: null,
        mgPlanExpiresAt: null,
        mgPlanLeadQuota: 0,
        mgPlanLeadsUsed: 0,
        leadAcceptancePaused: false
      }
    });
  } catch (error) {
    console.error('Remove MG Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing MG plan',
      error: error.message
    });
  }
};

// Admin: Ensure Free Plan exists in database
exports.ensureFreePlanExists = async (req, res) => {
  try {
    // Check if Free plan already exists
    let freePlan = await MGPlan.findOne({ name: 'Free', price: 0 });
    
    if (!freePlan) {
      // Create Free plan
      freePlan = new MGPlan({
        name: 'Free',
        price: 0,
        leads: 0,
        commission: 0,
        leadFee: 100, // Higher lead fee for free users
        minWalletBalance: 50, // Higher minimum balance for free users
        description: 'Free plan with no guaranteed leads. Pay per lead basis.',
        refundPolicy: 'No refunds applicable for free plan.',
        features: [
          'No guaranteed leads',
          'Pay per lead (₹100 per lead)',
          'Higher minimum wallet balance required',
          'Access to basic features'
        ],
        isActive: true,
        isDefault: false, // Free plan should not be default
        validityType: 'monthly',
        validityMonths: 1,
        partnerType: 'both'
      });
      
      await freePlan.save();
      
      res.json({
        success: true,
        message: 'Free plan created successfully',
        data: freePlan
      });
    } else {
      res.json({
        success: true,
        message: 'Free plan already exists',
        data: freePlan
      });
    }
  } catch (error) {
    console.error('Ensure Free Plan Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating/checking free plan',
      error: error.message
    });
  }
};

