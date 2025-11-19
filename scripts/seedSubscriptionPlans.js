const mongoose = require('mongoose');
require('dotenv').config();
const SubscriptionPlan = require('../models/SubscriptionPlan');

const defaultPlans = [
  {
    name: 'Basic',
    price: 99,
    priceDisplay: '₹99',
    features: [
      'Priority support',
      '2 free inspections'
    ],
    description: 'Perfect for basic home maintenance needs',
    isActive: true,
    displayOrder: 0,
    highlight: false,
    highlightText: '',
    whatsappNumber: '919590926068'
  },
  {
    name: 'Pro',
    price: 199,
    priceDisplay: '₹199',
    features: [
      'Free visits',
      'Discounted services',
      'Priority booking'
    ],
    description: 'Best value for regular home maintenance',
    isActive: true,
    displayOrder: 1,
    highlight: true,
    highlightText: 'Most Popular',
    whatsappNumber: '919590926068'
  },
  {
    name: 'Ultra',
    price: 349,
    priceDisplay: '₹349',
    features: [
      '2 handyman hours/month',
      'Emergency booking support',
      '24x7 premium assistance'
    ],
    description: 'Premium plan with maximum benefits',
    isActive: true,
    displayOrder: 2,
    highlight: false,
    highlightText: '',
    whatsappNumber: '919590926068'
  }
];

async function seedSubscriptionPlans() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if plans already exist
    const existingPlans = await SubscriptionPlan.find({});
    if (existingPlans.length > 0) {
      console.log(`⚠️  Found ${existingPlans.length} existing subscription plan(s).`);
      console.log('   Deleting existing plans to re-seed...');
      await SubscriptionPlan.deleteMany({});
      console.log('🗑️  Cleared existing subscription plans');
    }

    // Insert default plans
    const createdPlans = await SubscriptionPlan.insertMany(defaultPlans);
    console.log(`✅ Successfully created ${createdPlans.length} subscription plans:`);
    
    createdPlans.forEach(plan => {
      console.log(`   - ${plan.name}: ₹${plan.price} (${plan.features.length} features)`);
    });

    console.log('\n🎉 Subscription plans seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding subscription plans:', error);
    process.exit(1);
  }
}

// Run the seed function
seedSubscriptionPlans();

