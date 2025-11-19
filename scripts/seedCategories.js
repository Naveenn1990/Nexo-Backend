const mongoose = require('mongoose');
require('dotenv').config();
const ServiceCategory = require('../models/ServiceCategory');
const connectDB = require('../config/database');

// Categories to add in correct order
const categories = [
  {
    name: 'Air Conditioner (AC) Service & Repair',
    description: 'Professional AC installation, repair, and maintenance services. Get your air conditioner serviced by certified technicians.',
    subtitle: 'Expert AC Service & Repair',
    icon: '❄️',
    order: 1,
    isActive: true
  },
  {
    name: 'Plumber',
    description: 'Complete plumbing solutions including pipe repair, installation, leak fixing, and bathroom fittings.',
    subtitle: 'Professional Plumbing Services',
    icon: '🚿',
    order: 2,
    isActive: true
  },
  {
    name: 'Electrician',
    description: 'Expert electrical services including wiring, installation, repair, and maintenance for homes and offices.',
    subtitle: 'Certified Electrician Services',
    icon: '⚡',
    order: 3,
    isActive: true
  },
  {
    name: 'Refrigerator Repair',
    description: 'Fast and reliable refrigerator repair services. Fix cooling issues, leaks, and other problems.',
    subtitle: 'Expert Refrigerator Repair',
    icon: '🧊',
    order: 4,
    isActive: true
  },
  {
    name: 'Washing Machine Repair',
    description: 'Professional washing machine repair and maintenance services for all brands and models.',
    subtitle: 'Washing Machine Service',
    icon: '🌀',
    order: 5,
    isActive: true
  },
  {
    name: 'Geyser Repair',
    description: 'Geyser installation, repair, and maintenance services. Fix heating issues and water problems.',
    subtitle: 'Geyser Service & Repair',
    icon: '🔥',
    order: 6,
    isActive: true
  },
  {
    name: 'RO Water Purifier Service',
    description: 'RO water purifier installation, service, and repair. Get clean drinking water with expert maintenance.',
    subtitle: 'RO Purifier Service',
    icon: '💧',
    order: 7,
    isActive: true
  },
  {
    name: 'Carpenter',
    description: 'Expert carpentry services including furniture making, repair, installation, and custom woodwork.',
    subtitle: 'Professional Carpentry',
    icon: '🔨',
    order: 8,
    isActive: true
  },
  {
    name: 'Painter',
    description: 'Professional painting services for homes and offices. Interior and exterior painting with quality finishes.',
    subtitle: 'Expert Painting Services',
    icon: '🎨',
    order: 9,
    isActive: true
  },
  {
    name: 'TV Repair / Technician',
    description: 'TV repair and installation services. Fix screen issues, sound problems, and connectivity.',
    subtitle: 'TV Service & Repair',
    icon: '📺',
    order: 10,
    isActive: true
  },
  {
    name: 'Home Deep Cleaning',
    description: 'Comprehensive deep cleaning services for homes. Professional cleaning for all rooms and areas.',
    subtitle: 'Professional Deep Cleaning',
    icon: '🧹',
    order: 11,
    isActive: true
  },
  {
    name: 'Pest Control',
    description: 'Effective pest control services to eliminate insects, rodents, and other pests from your property.',
    subtitle: 'Expert Pest Control',
    icon: '🐛',
    order: 12,
    isActive: true
  },
  {
    name: 'CCTV Installation & Repair',
    description: 'CCTV camera installation, repair, and maintenance services for security and surveillance.',
    subtitle: 'CCTV Services',
    icon: '📹',
    order: 13,
    isActive: true
  },
  {
    name: 'Solar Panel Installation',
    description: 'Solar panel installation and maintenance services. Go green with professional solar solutions.',
    subtitle: 'Solar Panel Services',
    icon: '☀️',
    order: 14,
    isActive: true
  },
  {
    name: 'Water Tank Cleaning',
    description: 'Professional water tank cleaning and sanitization services to ensure clean and safe water supply.',
    subtitle: 'Water Tank Cleaning',
    icon: '💧',
    order: 15,
    isActive: true
  }
];

// Seed function
const seedCategories = async () => {
  try {
    await connectDB();

    console.log('Starting to seed categories...\n');

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const categoryData of categories) {
      try {
        // Check if category already exists
        const existing = await ServiceCategory.findOne({ name: categoryData.name });
        
        if (existing) {
          // Update existing category with correct order
          existing.order = categoryData.order;
          existing.description = categoryData.description;
          existing.subtitle = categoryData.subtitle;
          existing.icon = categoryData.icon;
          existing.isActive = categoryData.isActive;
          await existing.save();
          console.log(`🔄 Updated: ${categoryData.name} (order: ${categoryData.order})`);
          created++;
        } else {
          // Create new category
          const category = new ServiceCategory(categoryData);
          await category.save();
          console.log(`✅ Created: ${categoryData.name} (order: ${categoryData.order})`);
          created++;
        }
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⏭️  Skipped: ${categoryData.name} (duplicate)`);
          skipped++;
        } else {
          console.error(`❌ Error processing ${categoryData.name}:`, error.message);
          errors++;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Seeding Summary:');
    console.log(`✅ Created: ${created}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(50));

    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error);
    process.exit(1);
  }
};

// Run seed
if (require.main === module) {
  seedCategories();
}

module.exports = { seedCategories, categories };

