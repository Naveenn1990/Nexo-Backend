const MaterialCategory = require('../models/MaterialCategory');
const { errorHandler } = require('../utils/ErrorHandl');

// Get all material categories (for admin)
exports.getAllMaterialCategories = async (req, res) => {
  try {
    const categories = await MaterialCategory.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get all active material categories (for public use)
exports.getActiveMaterialCategories = async (req, res) => {
  try {
    const categories = await MaterialCategory.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .select('name icon items')
      .lean();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Get single material category
exports.getMaterialCategory = async (req, res) => {
  try {
    const category = await MaterialCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Material category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Create material category
exports.createMaterialCategory = async (req, res) => {
  try {
    const { name, icon, items, order, isActive } = req.body;

    // Validate required fields
    if (!name || !icon) {
      return res.status(400).json({
        success: false,
        message: 'Name and icon are required'
      });
    }

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required and must contain at least one item'
      });
    }

    const category = await MaterialCategory.create({
      name,
      icon,
      items: items.filter(item => item && item.trim() !== ''), // Filter out empty items
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: 'Material category created successfully',
      data: category
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Update material category
exports.updateMaterialCategory = async (req, res) => {
  try {
    const { name, icon, items, order, isActive } = req.body;
    const categoryId = req.params.id;

    const category = await MaterialCategory.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Material category not found'
      });
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (icon !== undefined) category.icon = icon;
    if (items !== undefined && Array.isArray(items)) {
      category.items = items.filter(item => item && item.trim() !== '');
    }
    if (order !== undefined) category.order = order;
    if (isActive !== undefined) category.isActive = isActive;

    category.updatedAt = new Date();
    await category.save();

    res.status(200).json({
      success: true,
      message: 'Material category updated successfully',
      data: category
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Delete material category
exports.deleteMaterialCategory = async (req, res) => {
  try {
    const category = await MaterialCategory.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Material category not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Material category deleted successfully',
      data: category
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

// Bulk update order
exports.updateMaterialCategoryOrder = async (req, res) => {
  try {
    const { categories } = req.body;

    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: 'Categories array is required'
      });
    }

    const updatePromises = categories.map(({ id, order }) =>
      MaterialCategory.findByIdAndUpdate(id, { order }, { new: true })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Material categories order updated successfully'
    });
  } catch (error) {
    errorHandler(res, error);
  }
};

