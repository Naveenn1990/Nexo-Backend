/**
 * Seed Team Members Script
 * This script adds sample team member data to the database
 * 
 * Usage:
 *   node backend/scripts/seedTeamMembers.js
 * 
 * Or with specific partner ID:
 *   PARTNER_ID=your_partner_id node backend/scripts/seedTeamMembers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const TeamMember = require('../models/TeamMember');
const Partner = require('../models/PartnerModel');
const ServiceCategory = require('../models/ServiceCategory');
const Hub = require('../models/Hub');

// Sample team member data
const sampleTeamMembers = [
  {
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@example.com',
    phone: '9876543210',
    whatsappNumber: '9876543210',
    qualification: 'B.Tech in Electrical Engineering',
    experience: '5 years',
    address: '123 Main Street, Andheri',
    city: 'Mumbai',
    pincode: '400053',
    role: 'technician',
    status: 'active',
    bankDetails: {
      accountNumber: '1234567890',
      ifscCode: 'HDFC0001234',
      accountHolderName: 'Rajesh Kumar',
      bankName: 'HDFC Bank'
    }
  },
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '9876543211',
    whatsappNumber: '9876543211',
    qualification: 'Diploma in AC Repair',
    experience: '3 years',
    address: '456 Park Avenue, Bandra',
    city: 'Mumbai',
    pincode: '400050',
    role: 'technician',
    status: 'active',
    bankDetails: {
      accountNumber: '1234567891',
      ifscCode: 'ICIC0001234',
      accountHolderName: 'Priya Sharma',
      bankName: 'ICICI Bank'
    }
  },
  {
    name: 'Amit Patel',
    email: 'amit.patel@example.com',
    phone: '9876543212',
    whatsappNumber: '9876543212',
    qualification: 'ITI in Plumbing',
    experience: '4 years',
    address: '789 Business Park, Goregaon',
    city: 'Mumbai',
    pincode: '400063',
    role: 'supervisor',
    status: 'active',
    bankDetails: {
      accountNumber: '1234567892',
      ifscCode: 'SBIN0001234',
      accountHolderName: 'Amit Patel',
      bankName: 'State Bank of India'
    }
  },
  {
    name: 'Sneha Desai',
    email: 'sneha.desai@example.com',
    phone: '9876543213',
    whatsappNumber: '9876543213',
    qualification: 'B.E. in Mechanical Engineering',
    experience: '6 years',
    address: '321 Tech Hub, Powai',
    city: 'Mumbai',
    pincode: '400076',
    role: 'technician',
    status: 'active',
    bankDetails: {
      accountNumber: '1234567893',
      ifscCode: 'AXIS0001234',
      accountHolderName: 'Sneha Desai',
      bankName: 'Axis Bank'
    }
  },
  {
    name: 'Vikram Singh',
    email: 'vikram.singh@example.com',
    phone: '9876543214',
    whatsappNumber: '9876543214',
    qualification: 'Certificate in Appliance Repair',
    experience: '2 years',
    address: '654 Residential Complex, Thane',
    city: 'Thane',
    pincode: '400601',
    role: 'technician',
    status: 'active',
    bankDetails: {
      accountNumber: '1234567894',
      ifscCode: 'PNB0001234',
      accountHolderName: 'Vikram Singh',
      bankName: 'Punjab National Bank'
    }
  }
];

async function seedTeamMembers() {
  try {
    // Connect to database
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    // Get partner ID from environment or find first partner
    let partnerId = process.env.PARTNER_ID;
    
    if (!partnerId) {
      console.log('📋 No PARTNER_ID specified, finding first partner...');
      const firstPartner = await Partner.findOne({}).select('_id name phone');
      if (!firstPartner) {
        console.error('❌ No partners found in database. Please create a partner first.');
        process.exit(1);
      }
      partnerId = firstPartner._id;
      console.log(`✅ Using partner: ${firstPartner.name} (${firstPartner.phone})`);
    } else {
      const partner = await Partner.findById(partnerId).select('name phone');
      if (!partner) {
        console.error(`❌ Partner with ID ${partnerId} not found`);
        process.exit(1);
      }
      console.log(`✅ Using partner: ${partner.name} (${partner.phone})`);
    }

    // Get available categories
    console.log('📋 Fetching available categories...');
    const categories = await ServiceCategory.find({}).limit(3).select('_id name');
    const categoryIds = categories.map(cat => cat._id);
    const categoryNames = categories.map(cat => cat.name);
    console.log(`✅ Found ${categories.length} categories: ${categoryNames.join(', ')}`);

    // Get available hubs
    console.log('📋 Fetching available hubs...');
    const hubs = await Hub.find({ status: 'active' }).limit(2).select('_id name');
    const hubIds = hubs.map(hub => hub._id);
    console.log(`✅ Found ${hubs.length} hubs: ${hubs.map(h => h.name).join(', ')}`);

    // Check if team members already exist
    const existingCount = await TeamMember.countDocuments({ partner: partnerId });
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing team members for this partner`);
      console.log('   Adding new members...');
    }

    // Create team members
    console.log('\n📝 Creating team members...');
    const createdMembers = [];

    for (const memberData of sampleTeamMembers) {
      // Check if member with same phone already exists
      const existing = await TeamMember.findOne({
        partner: partnerId,
        phone: memberData.phone
      });

      if (existing) {
        console.log(`   ⏭️  Skipping ${memberData.name} - already exists`);
        continue;
      }

      const teamMember = new TeamMember({
        ...memberData,
        partner: partnerId,
        categories: categoryIds.length > 0 ? categoryIds : [],
        categoryNames: categoryNames.length > 0 ? categoryNames : [],
        hubs: hubIds.length > 0 ? hubIds : [],
        joinedDate: new Date()
      });

      await teamMember.save();
      createdMembers.push(teamMember);
      console.log(`   ✅ Created: ${memberData.name} (${memberData.role})`);
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('================================');
    console.log(`✅ Created ${createdMembers.length} new team members`);
    console.log(`📋 Total team members for partner: ${await TeamMember.countDocuments({ partner: partnerId })}`);
    
    if (createdMembers.length > 0) {
      console.log('\n👥 Created Members:');
      createdMembers.forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.name} - ${member.phone} (${member.role})`);
      });
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log('   You can now view these members in the partner dashboard at /partner/dashboard/team');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding team members:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seedTeamMembers();
}

module.exports = { seedTeamMembers };

