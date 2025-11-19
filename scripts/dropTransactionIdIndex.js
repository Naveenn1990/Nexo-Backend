/**
 * Script to drop the problematic unique index on transactions.transactionId
 * Run this once to fix the duplicate key error:
 * node backend/scripts/dropTransactionIdIndex.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

const dropIndex = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('partnerwallets');

    // List all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);

    // Drop the problematic index
    try {
      await collection.dropIndex('transactions.transactionId_1');
      console.log('✅ Successfully dropped index: transactions.transactionId_1');
    } catch (err) {
      if (err.code === 27) {
        console.log('ℹ️  Index does not exist (already dropped)');
      } else {
        throw err;
      }
    }

    // Verify indexes after drop
    const indexesAfter = await collection.indexes();
    console.log('Indexes after drop:', indexesAfter);

    console.log('✅ Index drop completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error dropping index:', error);
    process.exit(1);
  }
};

dropIndex();

