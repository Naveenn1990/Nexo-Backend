const mongoose = require('mongoose');
require('dotenv').config();
const AMCPlan = require('../models/AMCPlan');

const defaultPlans = [
  {
    name: 'Basic',
    price: 2500,
    priceDisplay: '₹2,500',
    features: [
      'Monthly inspection',
      'Basic repairs included',
      'Electrical maintenance',
      'Plumbing maintenance',
      'AC service (quarterly)',
    ],
    description: 'Perfect for small businesses and PGs',
    isActive: true,
    displayOrder: 0,
    highlight: false,
    highlightText: '',
    whatsappNumber: '919590926068'
  },
  {
    name: 'Standard',
    price: 5000,
    priceDisplay: '₹5,000',
    features: [
      'Bi-weekly inspection',
      'All repairs included',
      'Electrical + Plumbing + AC',
      'Appliance maintenance',
      'Priority support',
      'Free material (up to ₹500/month)',
    ],
    description: 'Best value for clinics, shops, and small offices',
    isActive: true,
    displayOrder: 1,
    highlight: true,
    highlightText: 'Most Popular',
    whatsappNumber: '919590926068'
  },
  {
    name: 'Premium',
    price: 10000,
    priceDisplay: '₹10,000',
    features: [
      'Weekly inspection',
      'All repairs + replacements',
      'Complete maintenance',
      '24/7 emergency support',
      'Free material (up to ₹1,500/month)',
      'Dedicated account manager',
      'Customized service schedule',
    ],
    description: 'Premium plan for apartments and large buildings',
    isActive: true,
    displayOrder: 2,
    highlight: false,
    highlightText: '',
    whatsappNumber: '919590926068'
  }
];

async function seedAMCPlans() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if plans already exist
    const existingPlans = await AMCPlan.find({});
    if (existingPlans.length > 0) {
      console.log(`⚠️  Found ${existingPlans.length} existing AMC plan(s).`);
      console.log('   Deleting existing plans to re-seed...');
      await AMCPlan.deleteMany({});
      console.log('🗑️  Cleared existing AMC plans');
    }

    // Insert default plans
    const createdPlans = await AMCPlan.insertMany(defaultPlans);
    console.log(`✅ Successfully created ${createdPlans.length} AMC plans:`);
    
    createdPlans.forEach(plan => {
      console.log(`   - ${plan.name}: ${plan.priceDisplay} (${plan.features.length} features)`);
    });

    console.log('\n🎉 AMC plans seeded successfully!');
    console.log('📝 Plans are now available at: /api/service-hierarchy/amc-plans');
    console.log('🔧 Admin can manage plans at: /admin/amc-plans');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding AMC plans:', error);
    process.exit(1);
  }
}

// Run the seed function
seedAMCPlans();

