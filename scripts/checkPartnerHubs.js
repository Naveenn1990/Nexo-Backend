/**
 * Script to check partner hub assignments
 * Usage: node scripts/checkPartnerHubs.js [partnerId]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Partner = require('../models/PartnerModel');
const Hub = require('../models/Hub');
const connectDB = require('../config/database');

const checkPartnerHubs = async () => {
  try {
    await connectDB();

    const partnerId = process.argv[2];
    
    if (partnerId) {
      // Check specific partner
      const partner = await Partner.findById(partnerId).populate('hubs', 'name areas city state');
      
      if (!partner) {
        console.log('Partner not found');
        process.exit(1);
      }
      
      console.log('\n=== Partner Hub Assignment ===');
      console.log(`Partner ID: ${partner._id}`);
      console.log(`Partner Name: ${partner.profile?.name || 'N/A'}`);
      console.log(`Partner Phone: ${partner.phone}`);
      console.log(`Hubs Count: ${partner.hubs?.length || 0}`);
      console.log('\nAssigned Hubs:');
      
      if (partner.hubs && partner.hubs.length > 0) {
        partner.hubs.forEach((hub, index) => {
          console.log(`\n${index + 1}. ${hub.name}`);
          console.log(`   City: ${hub.city || 'N/A'}, State: ${hub.state || 'N/A'}`);
          console.log(`   Areas: ${hub.areas?.length || 0}`);
          if (hub.areas && hub.areas.length > 0) {
            hub.areas.forEach(area => {
              console.log(`     - ${area.areaName}: ${area.pinCodes?.join(', ') || 'No pin codes'}`);
            });
          }
        });
      } else {
        console.log('   No hubs assigned');
      }
      
      // Also check from Hub side
      const hubsWithPartner = await Hub.find({ 
        assignedPartners: partnerId 
      }).select('name areas city state');
      
      console.log(`\nHubs that have this partner assigned: ${hubsWithPartner.length}`);
      if (hubsWithPartner.length > 0) {
        hubsWithPartner.forEach((hub, index) => {
          console.log(`${index + 1}. ${hub.name}`);
        });
      }
      
    } else {
      // List all partners with their hubs
      const partners = await Partner.find({}).select('profile.name phone hubs').limit(10);
      
      console.log('\n=== Partners and Their Hubs ===\n');
      for (const partner of partners) {
        const hubCount = partner.hubs?.length || 0;
        console.log(`${partner.profile?.name || 'N/A'} (${partner.phone}): ${hubCount} hub(s)`);
        if (hubCount > 0) {
          const populatedHubs = await Partner.findById(partner._id).populate('hubs', 'name');
          populatedHubs.hubs.forEach(hub => {
            console.log(`  - ${hub.name}`);
          });
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error checking partner hubs:', error);
    process.exit(1);
  }
};

checkPartnerHubs();

