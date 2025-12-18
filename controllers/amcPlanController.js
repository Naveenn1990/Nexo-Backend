const AMCPlan = require('../models/AMCPlan');
const PopularService = require('../models/PopularService');

// Get all AMC plans (public - for CorporateAMC page)
// Returns all plans including inactive ones
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await AMCPlan.find({})
      .populate('includedServices', 'name slug icon price basePrice isActive')
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
      .populate('includedServices', 'name slug icon price basePrice isActive')
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
    const plan = await AMCPlan.findById(planId)
      .populate('includedServices', 'name slug icon price description');

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
      planType,
      targetCustomer,
      duration,
      durationUnit,
      includedServices,
      serviceFrequency,
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
      planType: planType || 'business',
      targetCustomer: targetCustomer || '',
      duration: duration || 12,
      durationUnit: durationUnit || 'months',
      includedServices: includedServices || [],
      serviceFrequency: serviceFrequency || {},
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

// Auto-generate AMC plans based on popular services
exports.generatePlansFromServices = async (req, res) => {
  try {
    console.log('🔄 Generating AMC plans from popular services...');
    
    // Get all active popular services
    const services = await PopularService.find({ isActive: true })
      .select('name slug icon price basePrice')
      .lean();

    if (services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active popular services found to generate plans from'
      });
    }

    console.log(`📋 Found ${services.length} active services`);

    // Define plan templates for different customer types
    const planTemplates = [
      // Individual Plans
      {
        name: 'Home Basic AMC',
        description: 'Essential maintenance for homeowners',
        planType: 'individual',
        targetCustomer: 'Homeowners with 1-2 BHK apartments',
        serviceCount: Math.min(2, services.length),
        frequency: '2', // Bi-annual
        priceMultiplier: 0.6,
        highlight: false,
        displayOrder: 1
      },
      {
        name: 'Home Premium AMC',
        description: 'Comprehensive home maintenance',
        planType: 'individual',
        targetCustomer: 'Homeowners with 3+ BHK houses',
        serviceCount: Math.min(4, services.length),
        frequency: '4', // Quarterly
        priceMultiplier: 0.8,
        highlight: true,
        highlightText: 'Popular for Homes',
        displayOrder: 2
      },
      // Business Plans
      {
        name: 'Business Standard AMC',
        description: 'Professional maintenance for small businesses',
        planType: 'business',
        targetCustomer: 'Small businesses with 10-50 employees',
        serviceCount: Math.min(5, services.length),
        frequency: '4', // Quarterly
        priceMultiplier: 1.0,
        highlight: true,
        highlightText: 'Most Popular',
        displayOrder: 3
      },
      {
        name: 'Business Pro AMC',
        description: 'Advanced maintenance for growing businesses',
        planType: 'business',
        targetCustomer: 'Medium businesses with 50-200 employees',
        serviceCount: Math.min(7, services.length),
        frequency: '6', // Bi-monthly
        priceMultiplier: 1.3,
        highlight: false,
        displayOrder: 4
      },
      // Corporate Plans
      {
        name: 'Corporate Essential AMC',
        description: 'Enterprise-grade maintenance solution',
        planType: 'corporate',
        targetCustomer: 'Large corporations and commercial properties',
        serviceCount: services.length,
        frequency: '6', // Bi-monthly
        priceMultiplier: 1.5,
        highlight: false,
        displayOrder: 5
      },
      {
        name: 'Corporate Elite AMC',
        description: 'Premium enterprise maintenance with priority support',
        planType: 'corporate',
        targetCustomer: 'Enterprise clients requiring 24/7 support',
        serviceCount: services.length,
        frequency: '12', // Monthly
        priceMultiplier: 2.0,
        highlight: true,
        highlightText: 'Enterprise Grade',
        displayOrder: 6
      }
    ];

    const createdPlans = [];

    for (const template of planTemplates) {
      // Select services for this plan (prioritize by order)
      const selectedServices = services
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .slice(0, template.serviceCount);

      // Calculate base price from selected services
      const basePrice = selectedServices.reduce((total, service) => {
        const servicePrice = service.basePrice || service.price || 500;
        return total + servicePrice;
      }, 0);

      const planPrice = Math.round(basePrice * template.priceMultiplier);

      // Create service frequency mapping
      const serviceFrequency = {};
      selectedServices.forEach(service => {
        serviceFrequency[service._id] = template.frequency;
      });

      // Generate features based on services, frequency, and plan type
      const features = [
        `${selectedServices.length} essential services included`,
        `${template.frequency} visits per year for each service`
      ];

      // Add plan type specific features
      if (template.planType === 'individual') {
        features.push('Residential property maintenance');
        features.push('Flexible scheduling for homeowners');
        features.push('Basic warranty on repairs');
      } else if (template.planType === 'business') {
        features.push('Business hours priority support');
        features.push('Dedicated account manager');
        features.push('Monthly maintenance reports');
        features.push('Emergency support during business hours');
      } else if (template.planType === 'corporate') {
        features.push('24/7 emergency support');
        features.push('Dedicated technical team');
        features.push('Comprehensive maintenance reports');
        features.push('SLA-based service guarantees');
        features.push('Priority response within 2 hours');
      }

      // Add service-specific features
      if (selectedServices.some(s => s.name.toLowerCase().includes('ac'))) {
        features.push('AC maintenance and cleaning');
      }
      if (selectedServices.some(s => s.name.toLowerCase().includes('electrical'))) {
        features.push('Electrical safety inspections');
      }
      if (selectedServices.some(s => s.name.toLowerCase().includes('plumbing'))) {
        features.push('Plumbing system maintenance');
      }

      // Check if plan already exists
      const existingPlan = await AMCPlan.findOne({ name: template.name });
      
      if (!existingPlan) {
        const newPlan = new AMCPlan({
          name: template.name,
          price: planPrice,
          priceDisplay: `₹${planPrice.toLocaleString('en-IN')}`,
          features,
          description: template.description,
          isActive: true,
          displayOrder: template.displayOrder,
          highlight: template.highlight || false,
          highlightText: template.highlightText || '',
          planType: template.planType,
          targetCustomer: template.targetCustomer,
          duration: 12,
          durationUnit: 'months',
          includedServices: selectedServices.map(s => s._id),
          serviceFrequency,
          metadata: {
            autoGenerated: true,
            generatedAt: new Date(),
            basedOnServices: selectedServices.length,
            planType: template.planType
          }
        });

        await newPlan.save();
        createdPlans.push(newPlan);
        console.log(`✅ Created plan: ${template.name} - ₹${planPrice}`);
      } else {
        console.log(`⚠️ Plan already exists: ${template.name}`);
      }
    }

    res.json({
      success: true,
      message: `Successfully generated ${createdPlans.length} AMC plans from popular services`,
      data: {
        createdPlans: createdPlans.length,
        totalServices: services.length,
        plans: createdPlans.map(p => ({
          name: p.name,
          price: p.priceDisplay,
          services: p.includedServices.length
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error generating AMC plans:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating AMC plans from services',
      error: error.message
    });
  }
};

// Get AMC subscribers (users who purchased AMC plans)
exports.getAMCSubscribers = async (req, res) => {
  try {
    const User = require('../models/User');
    
    console.log('📊 Fetching AMC subscribers...');
    
    // Find all users who have AMC subscriptions
    const users = await User.find({
      'amcSubscriptions': { $exists: true, $ne: [] }
    })
    .select('name email phone amcSubscriptions')
    .lean();

    console.log(`✅ Found ${users.length} user(s) with AMC subscriptions`);

    // Flatten the subscriptions with user info
    const subscribers = [];
    users.forEach(user => {
      if (user.amcSubscriptions && Array.isArray(user.amcSubscriptions)) {
        user.amcSubscriptions.forEach(subscription => {
          subscribers.push({
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            userPhone: user.phone,
            planName: subscription.planName,
            amount: subscription.amount,
            txnid: subscription.txnid,
            mihpayid: subscription.mihpayid,
            status: subscription.status || 'active',
            subscribedAt: subscription.subscribedAt,
            assignedPartner: subscription.assignedPartnerName || null,
            assignedPartnerId: subscription.assignedPartner || null,
            assignedAt: subscription.assignedAt || null
          });
        });
      }
    });

    // Sort by subscription date (newest first)
    subscribers.sort((a, b) => new Date(b.subscribedAt) - new Date(a.subscribedAt));

    console.log(`✅ Returning ${subscribers.length} subscription(s)`);

    res.json({
      success: true,
      data: subscribers
    });
  } catch (error) {
    console.error('❌ Error fetching AMC subscribers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching AMC subscribers',
      error: error.message
    });
  }
};

// Create sample AMC plans
exports.createSamplePlans = async (req, res) => {
  try {
    console.log('🔄 Creating sample AMC plans...');
    
    const { createSampleAMCPlans } = require('../utils/createSampleAMCPlans');
    const result = await createSampleAMCPlans();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          createdCount: result.createdCount || 0,
          existingCount: result.existingCount || 0,
          plans: result.plans || []
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error creating sample AMC plans:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating sample AMC plans',
      error: error.message
    });
  }
};

// Assign AMC subscription to partner
exports.assignAMCSubscriptionToPartner = async (req, res) => {
  try {
    const { userId, subscriptionId, partnerId } = req.body;
    
    if (!userId || !subscriptionId || !partnerId) {
      return res.status(400).json({
        success: false,
        message: 'User ID, subscription ID, and partner ID are required'
      });
    }

    const User = require('../models/User');
    const Partner = require('../models/PartnerModel');

    // Verify partner exists
    const partner = await Partner.findById(partnerId).select('profile.name phone');
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    // Find user and update the specific subscription
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find the subscription in the user's amcSubscriptions array
    let subscriptionFound = false;
    if (user.amcSubscriptions && Array.isArray(user.amcSubscriptions)) {
      for (let i = 0; i < user.amcSubscriptions.length; i++) {
        const subscription = user.amcSubscriptions[i];
        // Match by txnid or _id
        if (subscription.txnid === subscriptionId || subscription._id?.toString() === subscriptionId) {
          user.amcSubscriptions[i].assignedPartner = partnerId;
          user.amcSubscriptions[i].assignedPartnerName = partner.profile?.name || partner.phone;
          user.amcSubscriptions[i].assignedAt = new Date();
          subscriptionFound = true;
          break;
        }
      }
    }

    if (!subscriptionFound) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    await user.save();

    console.log(`✅ Assigned AMC subscription ${subscriptionId} to partner ${partner.profile?.name || partner.phone}`);

    res.json({
      success: true,
      message: 'AMC subscription assigned to partner successfully',
      data: {
        userId,
        subscriptionId,
        partnerId,
        partnerName: partner.profile?.name || partner.phone
      }
    });
  } catch (error) {
    console.error('❌ Error assigning AMC subscription to partner:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning AMC subscription to partner',
      error: error.message
    });
  }
};