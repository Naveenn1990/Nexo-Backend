/**
 * Seed Completed Jobs Script
 * This script adds sample completed bookings/jobs assigned to team members
 * 
 * Usage:
 *   node backend/scripts/seedCompletedJobs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Booking = require('../models/booking');
const TeamMember = require('../models/TeamMember');
const Partner = require('../models/PartnerModel');
const User = require('../models/User');
const SubService = require('../models/SubService');
const Service = require('../models/Service');
const ServiceCategory = require('../models/ServiceCategory');

// Sample completed job data
const sampleJobs = [
  {
    customerName: 'Rahul Mehta',
    customerPhone: '9123456780',
    customerEmail: 'rahul.mehta@example.com',
    serviceName: 'AC Repair',
    amount: 1500,
    paymentMode: 'cash',
    location: {
      address: '101 Skyline Apartments, Andheri West',
      landmark: 'Near Metro Station',
      pincode: '400053'
    },
    scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    scheduledTime: '10:00 AM',
    completedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours after scheduled
    review: {
      rating: 5,
      comment: 'Excellent service! Very professional and quick.'
    }
  },
  {
    customerName: 'Sneha Reddy',
    customerPhone: '9123456781',
    customerEmail: 'sneha.reddy@example.com',
    serviceName: 'AC Service',
    amount: 800,
    paymentMode: 'upi',
    location: {
      address: '202 Green Valley, Bandra East',
      landmark: 'Opposite Park',
      pincode: '400051'
    },
    scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    scheduledTime: '2:00 PM',
    completedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000),
    review: {
      rating: 4,
      comment: 'Good service, technician was knowledgeable.'
    }
  },
  {
    customerName: 'Amit Joshi',
    customerPhone: '9123456782',
    customerEmail: 'amit.joshi@example.com',
    serviceName: 'AC Installation',
    amount: 3500,
    paymentMode: 'online',
    location: {
      address: '303 Tech Park, Powai',
      landmark: 'Near IIT',
      pincode: '400076'
    },
    scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    scheduledTime: '11:00 AM',
    completedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    review: {
      rating: 5,
      comment: 'Perfect installation, very satisfied!'
    }
  },
  {
    customerName: 'Priya Nair',
    customerPhone: '9123456783',
    customerEmail: 'priya.nair@example.com',
    serviceName: 'AC Cleaning',
    amount: 600,
    paymentMode: 'cash',
    location: {
      address: '404 Sunrise Complex, Goregaon',
      landmark: 'Near Station',
      pincode: '400063'
    },
    scheduledDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    scheduledTime: '9:00 AM',
    completedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
    review: {
      rating: 4,
      comment: 'Clean work, AC is working great now.'
    }
  },
  {
    customerName: 'Vikram Singh',
    customerPhone: '9123456784',
    customerEmail: 'vikram.singh@example.com',
    serviceName: 'AC Repair',
    amount: 1200,
    paymentMode: 'phonepe',
    location: {
      address: '505 Elite Towers, Thane',
      landmark: 'Near Mall',
      pincode: '400601'
    },
    scheduledDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    scheduledTime: '3:00 PM',
    completedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 2.5 * 60 * 60 * 1000),
    review: {
      rating: 5,
      comment: 'Quick response and excellent repair work!'
    }
  },
  {
    customerName: 'Anjali Desai',
    customerPhone: '9123456785',
    customerEmail: 'anjali.desai@example.com',
    serviceName: 'AC Service',
    amount: 900,
    paymentMode: 'upi',
    location: {
      address: '606 Harmony Heights, Andheri',
      landmark: 'Near School',
      pincode: '400053'
    },
    scheduledDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    scheduledTime: '1:00 PM',
    completedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    review: {
      rating: 5,
      comment: 'Very professional service, highly recommended!'
    }
  }
];

async function getOrCreateUser(phone, name, email) {
  let user = await User.findOne({ phone });
  
  if (!user) {
    user = new User({
      phone,
      name,
      email,
      isVerified: true,
      isProfileComplete: true,
      status: 'active'
    });
    await user.save();
    console.log(`   ✅ Created user: ${name} (${phone})`);
  } else {
    // Update name and email if provided
    if (name && !user.name) user.name = name;
    if (email && !user.email) user.email = email;
    await user.save();
  }
  
  return user;
}

async function seedCompletedJobs() {
  try {
    // Connect to database
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');

    // Get partner
    let partnerId = process.env.PARTNER_ID;
    if (!partnerId) {
      const firstPartner = await Partner.findOne({}).select('_id name phone');
      if (!firstPartner) {
        console.error('❌ No partners found. Please create a partner first.');
        process.exit(1);
      }
      partnerId = firstPartner._id;
      console.log(`✅ Using partner: ${firstPartner.name || 'Partner'} (${firstPartner.phone})\n`);
    }

    // Get team members
    console.log('📋 Fetching team members...');
    const teamMembers = await TeamMember.find({ partner: partnerId, status: 'active' });
    if (teamMembers.length === 0) {
      console.error('❌ No active team members found. Please run seedTeamMembers.js first.');
      process.exit(1);
    }
    console.log(`✅ Found ${teamMembers.length} team members\n`);

    // Get or find existing subService
    console.log('📋 Fetching services...');
    let subService = await SubService.findOne({});
    
    if (!subService) {
      // Try to find any existing booking and use its subService
      const existingBooking = await Booking.findOne({}).populate('subService');
      if (existingBooking && existingBooking.subService) {
        subService = existingBooking.subService;
        console.log(`✅ Using subService from existing booking: ${subService.name}`);
      } else {
        console.log('⚠️  No subService found. Checking for existing bookings to update...');
        
        // Instead of creating new bookings, update existing ones
        const existingBookings = await Booking.find({
          partner: partnerId,
          status: { $in: ['accepted', 'in_progress'] }
        }).limit(sampleJobs.length);

        if (existingBookings.length > 0) {
          console.log(`✅ Found ${existingBookings.length} existing bookings to mark as completed\n`);
          
          for (let i = 0; i < existingBookings.length && i < teamMembers.length; i++) {
            const booking = existingBookings[i];
            const teamMember = teamMembers[i % teamMembers.length];
            
            booking.status = 'completed';
            booking.paymentStatus = 'completed';
            booking.teamMember = teamMember._id;
            booking.completedAt = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);
            booking.otpActive = false;
            
            await booking.save();
            console.log(`   ✅ Updated booking ${booking._id} - Assigned to ${teamMember.name}`);
          }
          
          console.log('\n✅ Updated existing bookings as completed!');
          process.exit(0);
        } else {
          console.log('⚠️  No existing bookings found. Creating minimal service data...');
          
          // Create category if doesn't exist
          category = await ServiceCategory.findOne({ name: { $regex: /AC|Air Conditioner|Service/i } });
          if (!category) {
            category = await ServiceCategory.findOne({});
          }
          if (!category) {
            // Create a basic category
            category = new ServiceCategory({
              name: 'AC Services',
              description: 'Air Conditioner Services',
              subtitle: 'Professional AC Services',
              icon: 'https://via.placeholder.com/100'
            });
            await category.save();
            console.log('   ✅ Created category: AC Services');
          }

          // Create SubCategory if doesn't exist
          const SubCategory = require('../models/SubCategory');
          let subCategory = await SubCategory.findOne({ category: category._id });
          if (!subCategory) {
            subCategory = await SubCategory.findOne({});
          }
          if (!subCategory) {
            subCategory = new SubCategory({
              name: 'AC Repair & Maintenance',
              category: category._id,
              image: 'https://via.placeholder.com/200'
            });
            await subCategory.save();
            console.log('   ✅ Created subCategory: AC Repair & Maintenance');
          }

          // Create service if doesn't exist
          service = await Service.findOne({ subCategory: subCategory._id });
          if (!service) {
            service = await Service.findOne({});
          }
          if (!service) {
            // Create a basic service
            service = new Service({
              name: 'AC Repair & Service',
              description: 'Professional AC repair and maintenance services',
              subCategory: subCategory._id,
              icon: 'https://via.placeholder.com/100'
            });
            await service.save();
            console.log('   ✅ Created service: AC Repair & Service');
          }

          // Create subService
          subService = new SubService({
            name: 'AC Repair Service',
            description: 'Professional AC repair and maintenance',
            service: service._id,
            subCategory: subCategory._id,
            category: category._id,
            price: 1000,
            basePrice: 1000,
            isActive: true,
            city: ['Mumbai'],
            icon: ['https://via.placeholder.com/200']
          });
          await subService.save();
          console.log('   ✅ Created subService: AC Repair Service\n');
        }
      }
    }

    // Get service and category if not already set
    if (!service && subService && subService.service) {
      service = await Service.findById(subService.service);
    }
    if (!category) {
      if (subService && subService.category) {
        category = await ServiceCategory.findById(subService.category);
      } else if (service && service.category) {
        category = await ServiceCategory.findById(service.category);
      }
    }
    
    // Get service and category references
    if (subService) {
      if (subService.service && !service) {
        service = await Service.findById(subService.service);
      }
      if (subService.category && !category) {
        category = await ServiceCategory.findById(subService.category);
      } else if (service && service.category && !category) {
        category = await ServiceCategory.findById(service.category);
      }
      console.log(`✅ Using service: ${subService.name}\n`);
    }

    // Create completed bookings
    console.log('📝 Creating completed jobs...');
    const createdBookings = [];

    for (let i = 0; i < sampleJobs.length; i++) {
      const jobData = sampleJobs[i];
      const teamMember = teamMembers[i % teamMembers.length]; // Distribute jobs among members

      // Get or create user
      const user = await getOrCreateUser(
        jobData.customerPhone,
        jobData.customerName,
        jobData.customerEmail
      );

      // Check if booking already exists
      const existing = await Booking.findOne({
        user: user._id,
        scheduledDate: jobData.scheduledDate,
        status: 'completed'
      });

      if (existing) {
        console.log(`   ⏭️  Skipping ${jobData.customerName} - booking already exists`);
        continue;
      }

      // Create booking
      const booking = new Booking({
        user: user._id,
        subService: subService._id,
        service: service?._id || subService.service,
        category: category?._id || subService.category,
        scheduledDate: jobData.scheduledDate,
        scheduledTime: jobData.scheduledTime,
        location: jobData.location,
        amount: jobData.amount,
        payamount: jobData.amount,
        discount: 0,
        tax: 0,
        paymentMode: jobData.paymentMode,
        status: 'completed',
        paymentStatus: 'completed',
        partner: partnerId,
        teamMember: teamMember._id,
        acceptedAt: new Date(jobData.scheduledDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before scheduled
        completedAt: jobData.completedDate,
        review: jobData.review,
        photos: [], // Can add photo URLs if needed
        videos: [], // Can add video URLs if needed
        otp: Math.floor(100000 + Math.random() * 900000).toString(),
        otpActive: false
      });

      await booking.save();
      createdBookings.push(booking);

      console.log(`   ✅ Created: ${jobData.customerName} - ${jobData.serviceName} (₹${jobData.amount})`);
      console.log(`      Assigned to: ${teamMember.name} (${teamMember.role})`);
      console.log(`      Completed: ${jobData.completedDate.toLocaleDateString()}`);
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('================================');
    console.log(`✅ Created ${createdBookings.length} completed jobs`);
    console.log(`📋 Total completed bookings: ${await Booking.countDocuments({ partner: partnerId, status: 'completed' })}`);
    
    // Show distribution by team member
    console.log('\n👥 Jobs by Team Member:');
    for (const member of teamMembers) {
      const memberJobs = await Booking.countDocuments({
        partner: partnerId,
        teamMember: member._id,
        status: 'completed'
      });
      console.log(`   ${member.name}: ${memberJobs} completed job(s)`);
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log('   You can now view these jobs in:');
    console.log('   - Partner Dashboard → Jobs Management');
    console.log('   - Team Members → Activity View');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding completed jobs:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seedCompletedJobs();
}

module.exports = { seedCompletedJobs };

