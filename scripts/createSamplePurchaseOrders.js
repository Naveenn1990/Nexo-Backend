const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const PurchaseOrder = require('../models/PurchaseOrder');
const InventoryItem = require('../models/InventoryItem');

const createSamplePurchaseOrders = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexo');
    console.log('✅ Connected to database');

    // Check if purchase orders already exist
    const existingPOs = await PurchaseOrder.find({});
    console.log(`📊 Found ${existingPOs.length} existing purchase orders`);

    if (existingPOs.length > 0) {
      console.log('📋 Existing Purchase Orders:');
      existingPOs.forEach((po, index) => {
        console.log(`   ${index + 1}. ${po.poId} - ${po.supplier} - ₹${po.totalValue} - ${po.status}`);
      });
    }

    // Check if inventory items exist
    const inventoryItems = await InventoryItem.find({}).limit(5);
    console.log(`📦 Found ${inventoryItems.length} inventory items`);

    // Create sample purchase orders if none exist
    if (existingPOs.length === 0) {
      console.log('🔄 Creating sample purchase orders...');

      const samplePOs = [
        {
          supplier: 'Hardware Supplier Ltd',
          supplierContact: '+91-9876543210',
          items: [
            {
              sku: 'HANDLE-001',
              name: 'Cabinet Handles',
              quantity: 2,
              unitPrice: 50,
              totalPrice: 100
            },
            {
              sku: 'LOCK-001',
              name: 'Door Locks',
              quantity: 34,
              unitPrice: 500,
              totalPrice: 17000
            }
          ],
          totalValue: 17100,
          expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          notes: 'Urgent requirement for ongoing projects',
          status: 'Pending'
        },
        {
          supplier: 'Electrical Components Co',
          supplierContact: '+91-9876543211',
          items: [
            {
              sku: 'WIRE-001',
              name: 'Electrical Wire 2.5mm',
              quantity: 100,
              unitPrice: 25,
              totalPrice: 2500
            },
            {
              sku: 'SWITCH-001',
              name: 'Modular Switches',
              quantity: 50,
              unitPrice: 75,
              totalPrice: 3750
            }
          ],
          totalValue: 6250,
          expectedDeliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          notes: 'Regular monthly order',
          status: 'In Transit'
        },
        {
          supplier: 'Plumbing Solutions Pvt Ltd',
          supplierContact: '+91-9876543212',
          items: [
            {
              sku: 'PIPE-001',
              name: 'PVC Pipes 1 inch',
              quantity: 20,
              unitPrice: 150,
              totalPrice: 3000
            },
            {
              sku: 'VALVE-001',
              name: 'Ball Valves',
              quantity: 10,
              unitPrice: 200,
              totalPrice: 2000
            }
          ],
          totalValue: 5000,
          expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          notes: 'Emergency repair supplies',
          status: 'Delivered'
        }
      ];

      for (const poData of samplePOs) {
        try {
          // Generate PO ID
          const poId = await PurchaseOrder.generatePOId();
          
          const po = await PurchaseOrder.create({
            ...poData,
            poId
          });
          
          console.log(`✅ Created PO: ${po.poId} - ${po.supplier} - ₹${po.totalValue}`);
        } catch (error) {
          console.error(`❌ Error creating PO for ${poData.supplier}:`, error.message);
        }
      }

      console.log('✅ Sample purchase orders created successfully!');
    } else {
      console.log('ℹ️ Purchase orders already exist, skipping creation');
    }

    // Verify final count
    const finalCount = await PurchaseOrder.countDocuments({});
    console.log(`📊 Total purchase orders in database: ${finalCount}`);

    // Test the API response format
    console.log('\n🧪 Testing API response format...');
    const orders = await PurchaseOrder.find({ isActive: true })
      .sort({ orderDate: -1 })
      .lean();

    const formattedOrders = orders.map(order => ({
      ...order,
      itemsDisplay: order.items.map(item => `${item.name} (${item.quantity})`).join(', '),
      value: `₹${order.totalValue.toLocaleString()}`,
      eta: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A'
    }));

    console.log('📋 Formatted orders for frontend:');
    formattedOrders.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.poId} - ${order.supplier}`);
      console.log(`      Items: ${order.itemsDisplay}`);
      console.log(`      Value: ${order.value}`);
      console.log(`      ETA: ${order.eta}`);
      console.log(`      Status: ${order.status}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

createSamplePurchaseOrders();