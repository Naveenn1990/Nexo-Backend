const InventoryItem = require('../models/InventoryItem');
const PurchaseOrder = require('../models/PurchaseOrder');
const InventoryThreshold = require('../models/InventoryThreshold');
const { errorHandler } = require('../utils/ErrorHandl');

// ==================== INVENTORY ITEMS ====================

// Get all inventory items
exports.getAllInventoryItems = async (req, res) => {
  try {
    const { category, location, status, search } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;
    if (location) query.location = location;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await InventoryItem.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Format stock for display
    const formattedItems = items.map(item => ({
      ...item,
      stock: `${item.stock} ${item.unit}`,
      leadTime: `${item.leadTime} days`
    }));

    res.status(200).json({
      success: true,
      count: formattedItems.length,
      data: formattedItems
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get single inventory item
exports.getInventoryItem = async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Create inventory item
exports.createInventoryItem = async (req, res) => {
  try {
    const {
      sku,
      name,
      category,
      location,
      stock,
      unit,
      supplier,
      supplierContact,
      leadTime,
      unitPrice,
      reorderLevel,
      minStockLevel,
      description
    } = req.body;

    if (!sku || !name || !category || !location || !supplier) {
      return res.status(400).json({
        success: false,
        message: 'SKU, name, category, location, and supplier are required'
      });
    }

    const item = await InventoryItem.create({
      sku: sku.toUpperCase(),
      name,
      category,
      location,
      stock: stock || 0,
      unit: unit || 'units',
      supplier,
      supplierContact,
      leadTime: leadTime || 0,
      unitPrice: unitPrice || 0,
      reorderLevel: reorderLevel || 10,
      minStockLevel: minStockLevel || 5,
      description,
      history: [{
        action: 'created',
        newValue: {
          stock: stock || 0,
          status: 'Healthy'
        },
        changedBy: req.admin?._id,
        timestamp: new Date()
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: item
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists'
      });
    }
    errorHandler(res, error);
  }
};

// Update inventory item
exports.updateInventoryItem = async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Track stock changes
    const previousStock = item.stock;
    const newStock = req.body.stock !== undefined ? req.body.stock : item.stock;
    const stockDifference = newStock - previousStock;

    // Update item
    Object.assign(item, req.body);
    
    // Add history entry for stock changes
    if (req.body.stock !== undefined && req.body.stock !== previousStock) {
      if (!item.history) {
        item.history = [];
      }
      item.history.push({
        action: stockDifference > 0 ? 'stock_added' : 'stock_removed',
        previousValue: previousStock,
        newValue: newStock,
        quantity: Math.abs(stockDifference),
        changedBy: req.admin?._id,
        notes: req.body.notes || `Stock ${stockDifference > 0 ? 'added' : 'removed'}`,
        timestamp: new Date()
      });
    } else if (Object.keys(req.body).some(key => key !== 'stock' && key !== 'notes')) {
      // Other field updates
      if (!item.history) {
        item.history = [];
      }
      item.history.push({
        action: 'updated',
        previousValue: { ...item.toObject() },
        newValue: req.body,
        changedBy: req.admin?._id,
        notes: req.body.notes || 'Item updated',
        timestamp: new Date()
      });
    }

    await item.save();

    res.status(200).json({
      success: true,
      message: 'Inventory item updated successfully',
      data: item
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get inventory item history
exports.getInventoryItemHistory = async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id).select('history sku name');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        item: { sku: item.sku, name: item.name },
        history: item.history || []
      }
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Delete inventory item
exports.deleteInventoryItem = async (req, res) => {
  try {
    const item = await InventoryItem.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get inventory statistics
exports.getInventoryStats = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isActive: true }).lean();

    const totalValue = items.reduce((sum, item) => sum + (item.stock * item.unitPrice), 0);
    const criticalCount = items.filter(item => item.status === 'Critical').length;
    const lowCount = items.filter(item => item.status === 'Low').length;
    const healthyCount = items.filter(item => item.status === 'Healthy').length;

    // Get unique suppliers
    const suppliers = [...new Set(items.map(item => item.supplier))].length;

    // Get in-transit purchase orders
    const inTransitPOs = await PurchaseOrder.countDocuments({
      status: 'In Transit',
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        valuation: totalValue > 100000 ? `₹${(totalValue / 100000).toFixed(1)}L` : `₹${totalValue.toLocaleString()}`,
        criticalCount,
        lowCount,
        healthyCount,
        suppliers,
        inTransit: inTransitPOs,
        totalItems: items.length
      }
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// ==================== PURCHASE ORDERS ====================

// Get all purchase orders
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { status, supplier, search } = req.query;
    const query = { isActive: true };

    if (status) query.status = status;
    if (supplier) query.supplier = { $regex: supplier, $options: 'i' };
    if (search) {
      query.$or = [
        { poId: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await PurchaseOrder.find(query)
      .sort({ orderDate: -1 })
      .populate('items.inventoryItem', 'sku name')
      .lean();

    // Format for display
    const formattedOrders = orders.map(order => ({
      ...order,
      itemsDisplay: order.items.map(item => `${item.name} (${item.quantity})`).join(', '), // For table display
      // Keep original items array for detailed view
      value: `₹${order.totalValue.toLocaleString()}`,
      eta: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A'
    }));

    res.status(200).json({
      success: true,
      count: formattedOrders.length,
      data: formattedOrders
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get single purchase order
exports.getPurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate('items.inventoryItem');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Create purchase order
exports.createPurchaseOrder = async (req, res) => {
  try {
    const { supplier, supplierContact, items, expectedDeliveryDate, notes } = req.body;

    if (!supplier || !items || !Array.isArray(items) || items.length === 0 || !expectedDeliveryDate) {
      return res.status(400).json({
        success: false,
        message: 'Supplier, items array, and expected delivery date are required'
      });
    }

    // Generate PO ID
    const poId = await PurchaseOrder.generatePOId();

    // Calculate items with total prices
    const orderItems = items.map(item => ({
      inventoryItem: item.inventoryItemId,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.quantity * item.unitPrice
    }));

    const totalValue = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

    const order = await PurchaseOrder.create({
      poId,
      supplier,
      supplierContact,
      items: orderItems,
      totalValue,
      expectedDeliveryDate: new Date(expectedDeliveryDate),
      notes,
      createdBy: req.admin?._id
    });

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: order
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'PO ID already exists'
      });
    }
    errorHandler(res, error);
  }
};

// Update purchase order
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Purchase order updated successfully',
      data: order
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Delete purchase order
exports.deletePurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Purchase order deleted successfully'
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// ==================== INVENTORY THRESHOLDS ====================

// Get all thresholds
exports.getAllThresholds = async (req, res) => {
  try {
    const thresholds = await InventoryThreshold.find({ isActive: true })
      .sort({ category: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: thresholds.length,
      data: thresholds
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get single threshold
exports.getThreshold = async (req, res) => {
  try {
    const threshold = await InventoryThreshold.findOne({
      category: req.params.category,
      isActive: true
    });

    if (!threshold) {
      return res.status(404).json({
        success: false,
        message: 'Threshold not found for this category'
      });
    }

    res.status(200).json({
      success: true,
      data: threshold
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Create or update threshold
exports.upsertThreshold = async (req, res) => {
  try {
    const {
      category,
      minStockLevel,
      reorderLevel,
      criticalLevel,
      autoReorder,
      autoReorderQuantity,
      leadTimeDays
    } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    const threshold = await InventoryThreshold.findOneAndUpdate(
      { category },
      {
        category,
        minStockLevel: minStockLevel || 5,
        reorderLevel: reorderLevel || 10,
        criticalLevel: criticalLevel || 3,
        autoReorder: autoReorder || false,
        autoReorderQuantity: autoReorderQuantity || 20,
        leadTimeDays: leadTimeDays || 7,
        isActive: true
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Threshold saved successfully',
      data: threshold
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Delete threshold
exports.deleteThreshold = async (req, res) => {
  try {
    const threshold = await InventoryThreshold.findOneAndUpdate(
      { category: req.params.category },
      { isActive: false },
      { new: true }
    );

    if (!threshold) {
      return res.status(404).json({
        success: false,
        message: 'Threshold not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Threshold deleted successfully'
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

