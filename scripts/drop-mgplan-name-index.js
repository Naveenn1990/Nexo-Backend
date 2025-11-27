const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

mongoose.set('strictQuery', false);

async function dropIndex() {
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
    
    // Drop the unique index on name field
    try {
      await collection.dropIndex('name_1');
      console.log('✅ Successfully dropped unique index on name field');
    } catch (err) {
      if (err.code === 27) {
        console.log('⚠️  Index does not exist, nothing to drop');
      } else {
        throw err;
      }
    }
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

dropIndex();
