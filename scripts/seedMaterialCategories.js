const mongoose = require('mongoose');
const MaterialCategory = require('../models/MaterialCategory');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Sample material categories data
const sampleCategories = [
  {
    name: 'Plumbing materials',
    icon: '🔧',
    items: [
      { name: 'PVC Pipes', priceMin: 50, priceMax: 200, stock: 100, unit: 'pieces', sku: 'PVC-PIPE-001', brand: 'Supreme', specifications: '1/2 inch diameter, 10 feet length' },
      { name: 'Pipe Fittings', priceMin: 25, priceMax: 150, stock: 200, unit: 'pieces', sku: 'FITTING-001', brand: 'Astral', specifications: 'Various sizes available' },
      { name: 'Water Taps', priceMin: 300, priceMax: 1500, stock: 50, unit: 'pieces', sku: 'TAP-001', brand: 'Jaquar', specifications: 'Brass body, chrome finish' },
      { name: 'Ball Valves', priceMin: 100, priceMax: 500, stock: 75, unit: 'pieces', sku: 'VALVE-001', brand: 'Kitz', specifications: '1/2 inch to 2 inch sizes' },
      { name: 'Pipe Sealants', priceMin: 80, priceMax: 250, stock: 30, unit: 'pieces', sku: 'SEAL-001', brand: 'Fevicol', specifications: 'Waterproof, 100ml tube' }
    ],
    order: 1,
    isActive: true
  },
  {
    name: 'Switchboards and cables',
    icon: '⚡',
    items: [
      { name: 'MCB 16A', priceMin: 150, priceMax: 400, stock: 80, unit: 'pieces', sku: 'MCB-16A-001', brand: 'Schneider', specifications: 'Single pole, 16 amp rating' },
      { name: 'Electrical Wires', priceMin: 200, priceMax: 800, stock: 500, unit: 'meters', sku: 'WIRE-001', brand: 'Havells', specifications: '2.5 sq mm, copper conductor' },
      { name: 'Wall Switches', priceMin: 50, priceMax: 300, stock: 120, unit: 'pieces', sku: 'SWITCH-001', brand: 'Anchor', specifications: '6A/16A, modular design' },
      { name: 'Power Sockets', priceMin: 80, priceMax: 400, stock: 90, unit: 'pieces', sku: 'SOCKET-001', brand: 'Legrand', specifications: '6A/16A, 3 pin' },
      { name: 'Cable Trays', priceMin: 300, priceMax: 1200, stock: 25, unit: 'pieces', sku: 'TRAY-001', brand: 'D&H', specifications: 'Galvanized steel, 100mm width' }
    ],
    order: 2,
    isActive: true
  },
  {
    name: 'Painting supplies',
    icon: '🎨',
    items: [
      { name: 'Wall Paint', priceMin: 500, priceMax: 2000, stock: 40, unit: 'liters', sku: 'PAINT-001', brand: 'Asian Paints', specifications: 'Emulsion, various colors' },
      { name: 'Paint Brushes', priceMin: 50, priceMax: 300, stock: 60, unit: 'pieces', sku: 'BRUSH-001', brand: 'Prestige', specifications: 'Various sizes, synthetic bristles' },
      { name: 'Wall Primer', priceMin: 300, priceMax: 800, stock: 35, unit: 'liters', sku: 'PRIMER-001', brand: 'Berger', specifications: 'Water-based, white color' },
      { name: 'Paint Thinner', priceMin: 80, priceMax: 200, stock: 45, unit: 'liters', sku: 'THINNER-001', brand: 'ICI', specifications: 'Synthetic thinner' },
      { name: 'Wall Putty', priceMin: 400, priceMax: 1000, stock: 30, unit: 'kg', sku: 'PUTTY-001', brand: 'Birla', specifications: 'White cement based, 20kg bag' }
    ],
    order: 3,
    isActive: true
  },
  {
    name: 'AC gas',
    icon: '❄️',
    items: [
      { name: 'R22 Refrigerant', priceMin: 800, priceMax: 1500, stock: 20, unit: 'kg', sku: 'R22-001', brand: 'Honeywell', specifications: '13.6kg cylinder' },
      { name: 'R410A Refrigerant', priceMin: 1200, priceMax: 2500, stock: 15, unit: 'kg', sku: 'R410A-001', brand: 'Chemours', specifications: '11.3kg cylinder' },
      { name: 'R32 Refrigerant', priceMin: 1000, priceMax: 2000, stock: 18, unit: 'kg', sku: 'R32-001', brand: 'Daikin', specifications: '10kg cylinder' },
      { name: 'AC Compressors', priceMin: 5000, priceMax: 15000, stock: 8, unit: 'pieces', sku: 'COMP-001', brand: 'Copeland', specifications: '1.5 ton capacity' },
      { name: 'AC Filters', priceMin: 200, priceMax: 800, stock: 50, unit: 'pieces', sku: 'FILTER-001', brand: '3M', specifications: 'HEPA filter, various sizes' }
    ],
    order: 4,
    isActive: true
  },
  {
    name: 'Hardware items',
    icon: '🔨',
    items: [
      { name: 'Wood Screws', priceMin: 100, priceMax: 500, stock: 200, unit: 'packets', sku: 'SCREW-001', brand: 'Hillman', specifications: 'Various sizes, zinc plated' },
      { name: 'Steel Nails', priceMin: 80, priceMax: 300, stock: 150, unit: 'kg', sku: 'NAIL-001', brand: 'Tata', specifications: 'Common nails, various sizes' },
      { name: 'Door Hinges', priceMin: 150, priceMax: 800, stock: 40, unit: 'pairs', sku: 'HINGE-001', brand: 'Godrej', specifications: 'Stainless steel, 4 inch' },
      { name: 'Door Locks', priceMin: 500, priceMax: 3000, stock: 25, unit: 'pieces', sku: 'LOCK-001', brand: 'Yale', specifications: 'Mortise lock, brass finish' },
      { name: 'Cabinet Handles', priceMin: 50, priceMax: 400, stock: 80, unit: 'pieces', sku: 'HANDLE-001', brand: 'Hafele', specifications: 'Aluminum, various designs' }
    ],
    order: 5,
    isActive: true
  }
];

// Seed function
const seedMaterialCategories = async () => {
  try {
    await connectDB();
    
    // Clear existing categories
    await MaterialCategory.deleteMany({});
    console.log('Cleared existing material categories');
    
    // Insert sample categories
    const createdCategories = await MaterialCategory.insertMany(sampleCategories);
    console.log(`Created ${createdCategories.length} material categories`);
    
    // Display created categories
    createdCategories.forEach(category => {
      console.log(`- ${category.name} (${category.items.length} items)`);
    });
    
    console.log('Material categories seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding material categories:', error);
    process.exit(1);
  }
};

// Run the seed function
seedMaterialCategories();