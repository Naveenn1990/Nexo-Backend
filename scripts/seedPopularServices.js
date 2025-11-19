const mongoose = require('mongoose');
require('dotenv').config();
const PopularService = require('../models/PopularService');
const connectDB = require('../config/database');

// Initial popular services data
const initialPopularServices = [
  {
    name: 'AC Service',
    slug: 'ac-service',
    icon: 'FaSnowflake',
    order: 1,
    isActive: true
  },
  {
    name: 'Electrical Work',
    slug: 'electrical-work',
    icon: 'FaBolt',
    order: 2,
    isActive: true
  },
  {
    name: 'Plumbing',
    slug: 'plumbing',
    icon: 'FaTint',
    order: 3,
    isActive: true
  },
  {
    name: 'Deep Cleaning',
    slug: 'deep-cleaning',
    icon: 'FaBroom',
    order: 4,
    isActive: true
  },
  {
    name: 'Painting',
    slug: 'painting',
    icon: 'FaPaintRoller',
    order: 5,
    isActive: true
  },
  {
    name: 'Appliance Repair',
    slug: 'appliance-repair',
    icon: 'FaTools',
    order: 6,
    isActive: true
  },
  {
    name: 'Carpentry',
    slug: 'carpentry',
    icon: 'FaHammer',
    order: 7,
    isActive: true
  },
  {
    name: 'Water Purifier Service',
    slug: 'water-purifier-service',
    icon: 'FaFilter',
    order: 8,
    isActive: true
  }
];

// Seed function
const seedPopularServices = async () => {
  try {
    await connectDB();

    // Clear existing popular services (optional - comment out if you want to keep existing)
    // await PopularService.deleteMany({});
    // console.log('Cleared existing popular services');

    // Check if services already exist
    const existingServices = await PopularService.find();
    if (existingServices.length > 0) {
      console.log('Popular services already exist. Skipping seed.');
      console.log(`Found ${existingServices.length} existing services.`);
      process.exit(0);
    }

    // Insert initial services
    const insertedServices = await PopularService.insertMany(initialPopularServices);
    console.log(`Successfully seeded ${insertedServices.length} popular services:`);
    insertedServices.forEach(service => {
      console.log(`  - ${service.name} (${service.slug})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding popular services:', error);
    process.exit(1);
  }
};

// Run seed
if (require.main === module) {
  seedPopularServices();
}

module.exports = { seedPopularServices, initialPopularServices };

