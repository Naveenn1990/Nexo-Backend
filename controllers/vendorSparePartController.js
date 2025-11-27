const VendorSparePart = require("../models/VendorSparePart");
const MaterialCategory = require("../models/MaterialCategory");
const { uploadFile2 } = require("../middleware/aws");

// Get all spare parts for a vendor
exports.getSpareParts = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const { category, status, search } = req.query;

    const query = { vendor: vendorId };

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    const spareParts = await VendorSparePart.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: spareParts,
      count: spareParts.length,
    });
  } catch (error) {
    console.error("Get Spare Parts Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch spare parts",
    });
  }
};

// Get single spare part
exports.getSparePart = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.vendor._id;

    const sparePart = await VendorSparePart.findOne({
      _id: id,
      vendor: vendorId,
    });

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        message: "Spare part not found",
      });
    }

    res.json({
      success: true,
      data: sparePart,
    });
  } catch (error) {
    console.error("Get Spare Part Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch spare part",
    });
  }
};

// Add new spare part
exports.addSparePart = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const {
      name,
      description,
      category,
      brand,
      price,
      stock,
      unit,
      specifications,
      hsnCode,
      gstPercentage,
      icon,
    } = req.body;

    console.log("Add Spare Part Request:", { 
      name, 
      category, 
      hasImage: !!req.file, 
      icon,
      vendorId 
    });

    if (!name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name, category, price, and stock are required",
      });
    }

    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await uploadFile2(req.file);
        console.log("Image uploaded successfully:", imageUrl);
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image",
          error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
        });
      }
    }

    const sparePartData = {
      vendor: vendorId,
      name: name.trim(),
      description: description?.trim() || '',
      category: category.trim(),
      brand: brand?.trim() || '',
      price: parseFloat(price),
      stock: parseInt(stock),
      unit: unit || "units",
      specifications: specifications?.trim() || '',
      hsnCode: hsnCode?.trim() || '',
      gstPercentage: gstPercentage ? parseFloat(gstPercentage) : 0,
      status: parseInt(stock) > 0 ? "active" : "out_of_stock",
    };

    // Handle icon - ensure it's a string, not an array
    let iconValue = icon;
    if (Array.isArray(icon)) {
      iconValue = icon.length > 0 ? icon[0] : null;
    }
    
    // Only set image or icon, not both
    if (imageUrl) {
      sparePartData.image = imageUrl;
      sparePartData.icon = null;
    } else if (iconValue && typeof iconValue === 'string' && iconValue.trim() !== '') {
      sparePartData.icon = iconValue.trim();
      sparePartData.image = null;
    } else {
      sparePartData.icon = null;
      sparePartData.image = null;
    }

    const sparePart = new VendorSparePart(sparePartData);

    await sparePart.save();

    res.status(201).json({
      success: true,
      message: "Spare part added successfully",
      data: sparePart,
    });
  } catch (error) {
    console.error("Add Spare Part Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add spare part",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update spare part
exports.updateSparePart = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.vendor._id;
    const updateData = { ...req.body };

    console.log("Update Spare Part Request:", { 
      id, 
      vendorId, 
      hasImage: !!req.file, 
      icon: updateData.icon,
      updateKeys: Object.keys(updateData)
    });

    // Remove fields that shouldn't be updated directly
    delete updateData.vendor;
    delete updateData._id;

    // Handle image upload
    if (req.file) {
      try {
        updateData.image = await uploadFile2(req.file);
        // If image is uploaded, remove icon
        updateData.icon = null;
        console.log("Image uploaded:", updateData.image);
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image",
          error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
        });
      }
    } else {
      // Handle icon - ensure it's a string, not an array
      if (updateData.icon !== undefined) {
        // If icon is an array (from FormData), take the first element
        if (Array.isArray(updateData.icon)) {
          updateData.icon = updateData.icon.length > 0 ? updateData.icon[0] : null;
        }
        
        // Now handle as string
        if (updateData.icon && typeof updateData.icon === 'string' && updateData.icon.trim() !== '') {
          updateData.icon = updateData.icon.trim();
          updateData.image = null;
        } else {
          // Icon is empty/null, set to null
          updateData.icon = null;
        }
      }
    }

    // Parse numeric fields
    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price);
    }
    if (updateData.stock !== undefined) {
      updateData.stock = parseInt(updateData.stock);
    }
    if (updateData.gstPercentage !== undefined) {
      updateData.gstPercentage = parseFloat(updateData.gstPercentage) || 0;
    }

    // Update stock status if stock is being updated
    if (updateData.stock !== undefined) {
      updateData.status = parseInt(updateData.stock) > 0 ? "active" : "out_of_stock";
    }

    // Trim string fields
    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.category) updateData.category = updateData.category.trim();
    if (updateData.description) updateData.description = updateData.description.trim();
    if (updateData.brand) updateData.brand = updateData.brand.trim();
    if (updateData.hsnCode) updateData.hsnCode = updateData.hsnCode.trim();
    if (updateData.specifications) updateData.specifications = updateData.specifications.trim();

    const sparePart = await VendorSparePart.findOneAndUpdate(
      { _id: id, vendor: vendorId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        message: "Spare part not found",
      });
    }

    res.json({
      success: true,
      message: "Spare part updated successfully",
      data: sparePart,
    });
  } catch (error) {
    console.error("Update Spare Part Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update spare part",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete spare part
exports.deleteSparePart = async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.vendor._id;

    const sparePart = await VendorSparePart.findOneAndDelete({
      _id: id,
      vendor: vendorId,
    });

    if (!sparePart) {
      return res.status(404).json({
        success: false,
        message: "Spare part not found",
      });
    }

    res.json({
      success: true,
      message: "Spare part deleted successfully",
    });
  } catch (error) {
    console.error("Delete Spare Part Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete spare part",
    });
  }
};

// Get categories
exports.getCategories = async (req, res) => {
  try {
    const vendorId = req.vendor._id;

    let adminCategoryNames = [];
    try {
      // Get admin-defined categories from MaterialCategory (active ones only)
      const adminCategories = await MaterialCategory.find({ isActive: true })
        .select('name')
        .sort({ order: 1, name: 1 })
        .lean();

      // Extract admin category names
      adminCategoryNames = adminCategories
        .map(cat => cat.name?.trim())
        .filter(name => name && name !== '');
    } catch (materialError) {
      console.error("Error fetching MaterialCategory:", materialError);
      // Continue without admin categories if MaterialCategory doesn't exist or fails
    }

    // Get distinct categories from vendor's own spare parts
    const vendorCategories = await VendorSparePart.distinct("category", {
      vendor: vendorId,
      category: { $exists: true, $ne: null, $ne: "" }
    });

    // Filter out null/undefined/empty values
    const filteredVendorCategories = vendorCategories
      .filter(cat => cat && typeof cat === 'string' && cat.trim() !== "")
      .map(cat => cat.trim());

    // Combine admin categories with vendor's custom categories
    // Remove duplicates and sort
    const allCategories = [...new Set([...adminCategoryNames, ...filteredVendorCategories])]
      .filter(cat => cat && cat.trim() !== '')
      .sort();

    console.log(`Found ${adminCategoryNames.length} admin categories and ${filteredVendorCategories.length} vendor categories for vendor ${vendorId}`);

    res.json({
      success: true,
      data: allCategories,
      count: allCategories.length,
      adminCategories: adminCategoryNames,
      vendorCategories: filteredVendorCategories
    });
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

