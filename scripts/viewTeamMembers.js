/**
 * View Team Members Script
 * Displays all team members in the database
 * 
 * Usage:
 *   node backend/scripts/viewTeamMembers.js
 * 
 * Or for specific partner:
 *   PARTNER_ID=your_partner_id node backend/scripts/viewTeamMembers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const TeamMember = require('../models/TeamMember');
const Partner = require('../models/PartnerModel');
// Load models for population
require('../models/ServiceCategory');
require('../models/Hub');

async function viewTeamMembers() {
  try {
    // Connect to database
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    // Get partner ID from environment or show all
    const partnerId = process.env.PARTNER_ID;

    let query = {};
    if (partnerId) {
      query.partner = partnerId;
      const partner = await Partner.findById(partnerId).select('name phone');
      if (partner) {
        console.log(`📋 Showing team members for: ${partner.name} (${partner.phone})\n`);
      }
    }

    // Get all team members
    const teamMembers = await TeamMember.find(query)
      .populate('partner', 'name phone email')
      .populate('categories', 'name')
      .populate('hubs', 'name city')
      .sort({ createdAt: -1 });

    if (teamMembers.length === 0) {
      console.log('❌ No team members found');
      if (partnerId) {
        console.log('   Try running: node backend/scripts/seedTeamMembers.js');
      }
      process.exit(0);
    }

    console.log(`📊 Found ${teamMembers.length} team member(s)\n`);
    console.log('='.repeat(80));

    teamMembers.forEach((member, index) => {
      console.log(`\n👤 Team Member #${index + 1}`);
      console.log('-'.repeat(80));
      console.log(`   ID: ${member._id}`);
      console.log(`   Name: ${member.name}`);
      console.log(`   Phone: ${member.phone}`);
      console.log(`   Email: ${member.email || 'N/A'}`);
      console.log(`   Role: ${member.role}`);
      console.log(`   Status: ${member.status}`);
      console.log(`   City: ${member.city || 'N/A'}`);
      console.log(`   Qualification: ${member.qualification || 'N/A'}`);
      console.log(`   Experience: ${member.experience || 'N/A'}`);
      
      if (member.partner) {
        console.log(`   Partner: ${member.partner.name} (${member.partner.phone})`);
      }
      
      if (member.categories && member.categories.length > 0) {
        const catNames = member.categories.map(c => c.name).join(', ');
        console.log(`   Categories: ${catNames}`);
      }
      
      if (member.hubs && member.hubs.length > 0) {
        const hubNames = member.hubs.map(h => `${h.name} (${h.city})`).join(', ');
        console.log(`   Hubs: ${hubNames}`);
      }
      
      if (member.bankDetails && member.bankDetails.accountNumber) {
        console.log(`   Bank: ${member.bankDetails.bankName} - ${member.bankDetails.accountNumber}`);
      }
      
      console.log(`   Joined: ${member.joinedDate ? new Date(member.joinedDate).toLocaleDateString() : 'N/A'}`);
      console.log(`   Created: ${new Date(member.createdAt).toLocaleDateString()}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Total: ${teamMembers.length} team member(s)`);
    console.log(`\n💡 View in dashboard: /partner/dashboard/team`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error viewing team members:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  viewTeamMembers();
}

module.exports = { viewTeamMembers };

