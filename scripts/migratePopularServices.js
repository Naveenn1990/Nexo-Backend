const mongoose = require('mongoose');
require('dotenv').config();
const PopularService = require('../models/PopularService');
const connectDB = require('../config/database');

// Migration function to update existing services with new fields
const migratePopularServices = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    const services = await PopularService.find();
    console.log(`Found ${services.length} services to migrate`);

    if (services.length === 0) {
      console.log('No services found to migrate.');
      process.exit(0);
    }

    let updatedCount = 0;
    const updates = [];

    for (const service of services) {
      const updateData = {};
      let needsUpdate = false;

      // Check and set default values for new fields
      if (service.basePrice === undefined || service.basePrice === null) {
        updateData.basePrice = 0;
        needsUpdate = true;
      }
      if (service.discount === undefined || service.discount === null) {
        updateData.discount = 0;
        needsUpdate = true;
      }
      if (!service.discountType) {
        updateData.discountType = 'percentage';
        needsUpdate = true;
      }
      if (service.cgst === undefined || service.cgst === null) {
        updateData.cgst = 0;
        needsUpdate = true;
      }
      if (service.sgst === undefined || service.sgst === null) {
        updateData.sgst = 0;
        needsUpdate = true;
      }
      if (service.serviceCharge === undefined || service.serviceCharge === null) {
        updateData.serviceCharge = 0;
        needsUpdate = true;
      }
      if (!service.serviceChargeType) {
        updateData.serviceChargeType = 'amount';
        needsUpdate = true;
      }
      if (!service.excluded || !Array.isArray(service.excluded)) {
        updateData.excluded = [];
        needsUpdate = true;
      }
      if (!service.description) {
        updateData.description = '';
        needsUpdate = true;
      }
      if (!service.trusted) {
        updateData.trusted = 'Trusted by thousands of homes';
        needsUpdate = true;
      }
      if (!service.included || !Array.isArray(service.included)) {
        updateData.included = [];
        needsUpdate = true;
      }
      if (!service.addOns || !Array.isArray(service.addOns)) {
        updateData.addOns = [];
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.push(
          PopularService.findByIdAndUpdate(
            service._id,
            { $set: updateData },
            { new: true }
          )
        );
        updatedCount++;
        console.log(`  - Updating ${service.name} (${service.slug})`);
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`\n✅ Migration completed successfully!`);
      console.log(`   Updated ${updatedCount} out of ${services.length} services.`);
    } else {
      console.log('\n✅ All services are already up to date. No migration needed.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error migrating services:', error);
    process.exit(1);
  }
};

// Run migration
if (require.main === module) {
  migratePopularServices();
}

module.exports = migratePopularServices;

