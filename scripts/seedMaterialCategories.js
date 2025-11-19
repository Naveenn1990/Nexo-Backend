const mongoose = require('mongoose');
require('dotenv').config();
const MaterialCategory = require('../models/MaterialCategory');
const connectDB = require('../config/database');

// Initial material categories data (matching the default categories from MaterialStore.jsx)
const initialMaterialCategories = [
  {
    name: 'Plumbing materials',
    icon: '🔧',
    items: ['Pipes', 'Fittings', 'Taps', 'Valves', 'Sealants'],
    order: 1,
    isActive: true
  },
  {
    name: 'Switchboards and cables',
    icon: '⚡',
    items: ['MCB', 'Wires', 'Switches', 'Sockets', 'Cable trays'],
    order: 2,
    isActive: true
  },
  {
    name: 'Painting supplies',
    icon: '🎨',
    items: ['Paints', 'Brushes', 'Primers', 'Thinners', 'Putty'],
    order: 3,
    isActive: true
  },
  {
    name: 'AC gas',
    icon: '❄️',
    items: ['R22', 'R410A', 'R32', 'Compressors', 'Filters'],
    order: 4,
    isActive: true
  },
  {
    name: 'Hardware items',
    icon: '🔨',
    items: ['Screws', 'Nails', 'Hinges', 'Locks', 'Handles'],
    order: 5,
    isActive: true
  }
];

// Seed function
const seedMaterialCategories = async () => {
  try {
    await connectDB();

    console.log('Starting to seed material categories...\n');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const categoryData of initialMaterialCategories) {
      try {
        // Check if category already exists
        const existing = await MaterialCategory.findOne({ name: categoryData.name });
        
        if (existing) {
          // Update existing category with correct data
          existing.icon = categoryData.icon;
          existing.items = categoryData.items;
          existing.order = categoryData.order;
          existing.isActive = categoryData.isActive;
          await existing.save();
          console.log(`🔄 Updated: ${categoryData.name} (order: ${categoryData.order}, ${categoryData.items.length} items)`);
          updated++;
        } else {
          // Create new category
          const category = new MaterialCategory(categoryData);
          await category.save();
          console.log(`✅ Created: ${categoryData.name} (order: ${categoryData.order}, ${categoryData.items.length} items)`);
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
    console.log(`🔄 Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(50));

    // Display all material categories
    const allCategories = await MaterialCategory.find().sort({ order: 1 });
    console.log(`\n📦 Total material categories in database: ${allCategories.length}`);
    allCategories.forEach(cat => {
      console.log(`   - ${cat.icon} ${cat.name} (${cat.items.length} items, order: ${cat.order}, ${cat.isActive ? 'Active' : 'Inactive'})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding material categories:', error);
    process.exit(1);
  }
};

// Run seed
if (require.main === module) {
  seedMaterialCategories();
}

module.exports = { seedMaterialCategories, initialMaterialCategories };

