const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

mongoose.set('strictQuery', false);

async function createCompoundIndex() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('mgplans');
    
    // Create compound unique index on name + partnerType
    await collection.createIndex(
      { name: 1, partnerType: 1 }, 
      { unique: true }
    );
    console.log('✅ Successfully created compound unique index on (name, partnerType)');
    console.log('   This allows same plan names for different partner types');
    console.log('   Example: "Silver" for Individual and "Silver" for Franchise');
    
    console.log('\nMigration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

createCompoundIndex();
