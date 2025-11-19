/**
 * Script to seed hub data
 * Multiple hubs with area-wise pin codes for Bangalore
 * 
 * Usage: node scripts/seedHubs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Hub = require('../models/Hub');
const connectDB = require('../config/database');

const seedHubs = async () => {
  try {
    // Connect to database
    await connectDB();

    // Example: Whitefield hub with area-wise pin codes
    const whitefieldHub = {
      name: 'Whitefield',
      description: 'Whitefield service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        {
          areaName: 'Whitefield Main',
          pinCodes: ['560066', '560067']
        },
        {
          areaName: 'ITPL',
          pinCodes: ['560066']
        },
        {
          areaName: 'Varthur',
          pinCodes: ['560087', '560066']
        },
        {
          areaName: 'Kadugodi',
          pinCodes: ['560067']
        },
        {
          areaName: 'Hoodi',
          pinCodes: ['560048', '560066']
        }
      ],
      status: 'active'
    };

    // Marathalli hub with area-wise pin codes
    const marathalliHub = {
      name: 'Marathalli',
      description: 'Marathalli service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        {
          areaName: 'Marathalli Main',
          pinCodes: ['560037', '560103']
        },
        {
          areaName: 'HAL',
          pinCodes: ['560017', '560037']
        },
        {
          areaName: 'Indiranagar',
          pinCodes: ['560038', '560037']
        },
        {
          areaName: 'Koramangala',
          pinCodes: ['560095', '560037']
        },
        {
          areaName: 'Bommanahalli',
          pinCodes: ['560068', '560037']
        }
      ],
      status: 'active'
    };

    // BTM Layout hub
    const btmLayoutHub = {
      name: 'BTM Layout',
      description: 'BTM Layout service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        {
          areaName: 'BTM Layout 1st Stage',
          pinCodes: ['560068', '560076']
        },
        {
          areaName: 'BTM Layout 2nd Stage',
          pinCodes: ['560068', '560076']
        },
        {
          areaName: 'BTM Layout Water Tank',
          pinCodes: ['560068']
        },
        {
          areaName: 'Udupi Garden',
          pinCodes: ['560068', '560076']
        },
        {
          areaName: 'Silk Board',
          pinCodes: ['560068', '560076']
        }
      ],
      status: 'active'
    };

    // Helper function to create or update hub
    const createOrUpdateHub = async (hubData) => {
      const existingHub = await Hub.findOne({ name: hubData.name });
      if (existingHub) {
        console.log(`${hubData.name} hub already exists. Updating...`);
        existingHub.areas = hubData.areas;
        existingHub.description = hubData.description;
        existingHub.city = hubData.city;
        existingHub.state = hubData.state;
        existingHub.status = hubData.status;
        await existingHub.save();
        console.log(`${hubData.name} hub updated successfully!`);
        return existingHub;
      } else {
        const hub = new Hub(hubData);
        await hub.save();
        console.log(`${hubData.name} hub created successfully!`);
        return hub;
      }
    };

    // Hebbal hub
    const hebbalHub = {
      name: 'Hebbal',
      description: 'Hebbal service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        { areaName: 'Hebbal Main', pinCodes: ['560024', '560032'] },
        { areaName: 'Nagavara', pinCodes: ['560045', '560024'] },
        { areaName: 'Kodigehalli', pinCodes: ['560092', '560024'] },
        { areaName: 'Sahakarnagar', pinCodes: ['560092', '560024'] }
      ],
      status: 'active'
    };

    // Yelhanka hub
    const yelhankaHub = {
      name: 'Yelhanka',
      description: 'Yelhanka service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        { areaName: 'Yelhanka Main', pinCodes: ['560064', '560106'] },
        { areaName: 'Yelahanka New Town', pinCodes: ['560064', '560106'] },
        { areaName: 'Doddaballapur Road', pinCodes: ['560064'] },
        { areaName: 'Attur', pinCodes: ['560064', '560106'] }
      ],
      status: 'active'
    };

    // Sarjapur hub
    const sarjapurHub = {
      name: 'Sarjapur',
      description: 'Sarjapur service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        { areaName: 'Sarjapur Main', pinCodes: ['562125', '562126'] },
        { areaName: 'Sarjapur Road', pinCodes: ['562125', '560103'] },
        { areaName: 'Avalahalli', pinCodes: ['562125'] },
        { areaName: 'Doddakannelli', pinCodes: ['562125', '560103'] }
      ],
      status: 'active'
    };

    // Bellandur hub
    const bellandurHub = {
      name: 'Bellandur',
      description: 'Bellandur service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        { areaName: 'Bellandur Main', pinCodes: ['560103', '560102'] },
        { areaName: 'Bellandur Lake', pinCodes: ['560103'] },
        { areaName: 'Varthur Road', pinCodes: ['560103', '560087'] },
        { areaName: 'Kadubeesanahalli', pinCodes: ['560103', '560102'] }
      ],
      status: 'active'
    };

    // HSR Layout hub
    const hsrLayoutHub = {
      name: 'HSR Layout',
      description: 'HSR Layout service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        { areaName: 'HSR Layout Main', pinCodes: ['560102', '560034'] },
        { areaName: 'HSR Sector 1', pinCodes: ['560102'] },
        { areaName: 'HSR Sector 2', pinCodes: ['560102'] },
        { areaName: 'HSR Sector 7', pinCodes: ['560102', '560034'] },
        { areaName: 'Bommanahalli', pinCodes: ['560068', '560102'] }
      ],
      status: 'active'
    };

    // JP Nagar hub
    const jpNagarHub = {
      name: 'JP Nagar',
      description: 'JP Nagar service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        { areaName: 'JP Nagar 1st Phase', pinCodes: ['560078', '560068'] },
        { areaName: 'JP Nagar 2nd Phase', pinCodes: ['560078'] },
        { areaName: 'JP Nagar 3rd Phase', pinCodes: ['560078', '560068'] },
        { areaName: 'JP Nagar 6th Phase', pinCodes: ['560078'] },
        { areaName: 'JP Nagar 7th Phase', pinCodes: ['560078', '560068'] }
      ],
      status: 'active'
    };

    // Koramangala hub
    const koramangalaHub = {
      name: 'Koramangala',
      description: 'Koramangala service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        { areaName: 'Koramangala 1st Block', pinCodes: ['560095', '560034'] },
        { areaName: 'Koramangala 3rd Block', pinCodes: ['560095'] },
        { areaName: 'Koramangala 4th Block', pinCodes: ['560095', '560034'] },
        { areaName: 'Koramangala 5th Block', pinCodes: ['560095'] },
        { areaName: 'Koramangala 6th Block', pinCodes: ['560095', '560034'] },
        { areaName: 'Koramangala 7th Block', pinCodes: ['560095'] }
      ],
      status: 'active'
    };

    // Electronic City hub
    const electronicCityHub = {
      name: 'Electronic City',
      description: 'Electronic City service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        { areaName: 'Electronic City Phase 1', pinCodes: ['560100', '560099'] },
        { areaName: 'Electronic City Phase 2', pinCodes: ['560100'] },
        { areaName: 'Hosur Road', pinCodes: ['560100', '560068'] },
        { areaName: 'Konappana Agrahara', pinCodes: ['560100', '560099'] },
        { areaName: 'Bommanahalli', pinCodes: ['560068', '560100'] }
      ],
      status: 'active'
    };

    // Jayanagar hub
    const jayanagarHub = {
      name: 'Jayanagar',
      description: 'Jayanagar service hub covering multiple areas',
      city: 'Bangalore',
      state: 'Karnataka',
      areas: [
        { areaName: 'Jayanagar 1st Block', pinCodes: ['560011', '560070'] },
        { areaName: 'Jayanagar 3rd Block', pinCodes: ['560011'] },
        { areaName: 'Jayanagar 4th Block', pinCodes: ['560011', '560070'] },
        { areaName: 'Jayanagar 7th Block', pinCodes: ['560011'] },
        { areaName: 'Jayanagar 9th Block', pinCodes: ['560011', '560070'] }
      ],
      status: 'active'
    };

    // Process all hubs
    const allHubs = [
      whitefieldHub,
      marathalliHub,
      btmLayoutHub,
      hebbalHub,
      yelhankaHub,
      sarjapurHub,
      bellandurHub,
      hsrLayoutHub,
      jpNagarHub,
      koramangalaHub,
      electronicCityHub,
      jayanagarHub
    ];

    console.log('Starting hub seeding process...\n');
    const results = [];
    for (const hubData of allHubs) {
      const hub = await createOrUpdateHub(hubData);
      results.push(hub);
    }

    console.log('\n=== Summary ===');
    console.log(`Total hubs processed: ${results.length}`);
    console.log('\nAll hubs:');
    results.forEach((hub, index) => {
      console.log(`${index + 1}. ${hub.name} - ${hub.areas.length} areas, ${hub.areas.reduce((sum, area) => sum + area.pinCodes.length, 0)} pin codes`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding hubs:', error);
    process.exit(1);
  }
};

// Run the seed function
seedHubs();

