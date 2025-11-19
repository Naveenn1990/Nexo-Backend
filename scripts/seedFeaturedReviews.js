const mongoose = require('mongoose');
require('dotenv').config();
const FeaturedReview = require('../models/FeaturedReview');

const defaultReviews = [
  {
    text: 'Fast service and clean work. The technician arrived on time and completed the job efficiently.',
    author: 'Rajesh K.',
    rating: 5,
    authorLocation: 'Mumbai',
    serviceType: 'AC Service',
    isActive: true,
    displayOrder: 0,
    featured: true
  },
  {
    text: 'Great response time. Loved it. The team was professional and the service was excellent.',
    author: 'Priya M.',
    rating: 5,
    authorLocation: 'Delhi',
    serviceType: 'Plumbing',
    isActive: true,
    displayOrder: 1,
    featured: true
  },
  {
    text: 'Technician was polite and professional. Highly recommend their services.',
    author: 'Amit S.',
    rating: 5,
    authorLocation: 'Bangalore',
    serviceType: 'Electrical Work',
    isActive: true,
    displayOrder: 2,
    featured: false
  }
];

async function seedFeaturedReviews() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if reviews already exist
    const existingReviews = await FeaturedReview.find({});
    if (existingReviews.length > 0) {
      console.log(`⚠️  Found ${existingReviews.length} existing review(s).`);
      console.log('   Deleting existing reviews to re-seed...');
      await FeaturedReview.deleteMany({});
      console.log('🗑️  Cleared existing featured reviews');
    }

    // Insert default reviews
    const createdReviews = await FeaturedReview.insertMany(defaultReviews);
    console.log(`✅ Successfully created ${createdReviews.length} featured reviews:`);
    
    createdReviews.forEach(review => {
      console.log(`   - ${review.author}: ${review.rating} stars (${review.serviceType})`);
    });

    console.log('\n🎉 Featured reviews seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding featured reviews:', error);
    process.exit(1);
  }
}

// Run the seed function
seedFeaturedReviews();

