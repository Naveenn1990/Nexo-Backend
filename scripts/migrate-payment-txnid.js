/**
 * Migration Script: Add txnId field to existing partners
 * 
 * This script migrates existing partners who have payId but no txnId.
 * For partners where payId starts with "TXN", it copies payId to txnId.
 * 
 * Run this script once after deploying the payment fix:
 * node scripts/migrate-payment-txnid.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Partner = require('../models/PartnerModel');

const migratePaymentTxnId = async () => {
  try {
    console.log('🔄 Starting payment txnId migration...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to database');

    // Find all partners with payId but no txnId
    const partnersToMigrate = await Partner.find({
      'profile.payId': { $exists: true },
      'profile.txnId': { $exists: false }
    });

    console.log(`📊 Found ${partnersToMigrate.length} partners to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const partner of partnersToMigrate) {
      const payId = partner.profile.payId;
      
      // If payId starts with "TXN", it's a transaction ID
      if (payId && payId.toString().startsWith('TXN')) {
        partner.profile.txnId = payId;
        await partner.save();
        migratedCount++;
        console.log(`✅ Migrated partner ${partner._id}: txnId = ${payId}`);
      } else {
        // PayId is already a PayU payment ID, no migration needed
        skippedCount++;
        console.log(`⏭️  Skipped partner ${partner._id}: payId is already PayU ID (${payId})`);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total partners found: ${partnersToMigrate.length}`);
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log('\n✅ Migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migratePaymentTxnId();
