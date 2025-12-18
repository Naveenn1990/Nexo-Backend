const City = require('../models/City');

// Simple in-memory cache for cities
let citiesCache = {
  data: null,
  timestamp: null,
  expiry: 5 * 60 * 1000 // 5 minutes
};

// Clear cache function
const clearCitiesCache = () => {
  citiesCache = { data: null, timestamp: null, expiry: 5 * 60 * 1000 };
};

// Get all cities (public) - includes both enabled and disabled
exports.getEnabledCities = async (req, res) => {
  try {
    // Check if cache is valid
    const now = Date.now();
    if (citiesCache.data && citiesCache.timestamp && (now - citiesCache.timestamp) < citiesCache.expiry) {
      console.log('🎯 Returning cached cities data');
      return res.json({
        success: true,
        data: citiesCache.data
      });
    }

    console.log('🌐 Fetching fresh cities data from database');
    // Return ALL cities, frontend will handle disabled state
    const cities = await City.find()
      .sort({ displayOrder: 1, name: 1 })
      .select('name icon image description state isEnabled');
    
    // Cache the result
    citiesCache = {
      data: cities,
      timestamp: now,
      expiry: 5 * 60 * 1000
    };

    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cities'
    });
  }
};

// Get all cities (admin)
exports.getAllCities = async (req, res) => {
  try {
    const cities = await City.find()
      .sort({ displayOrder: 1, name: 1 });
    
    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cities'
    });
  }
};

// Create city (admin)
exports.createCity = async (req, res) => {
  try {
    const { name, icon, description, state, displayOrder, image } = req.body;

    // Check if city already exists
    const existingCity = await City.findOne({ name: name.trim() });
    if (existingCity) {
      return res.status(400).json({
        success: false,
        message: 'City already exists'
      });
    }

    const city = new City({
      name: name.trim(),
      icon: icon || 'FaMapMarkerAlt',
      image: image || null,
      description,
      state,
      displayOrder: displayOrder || 0,
      isEnabled: true
    });

    await city.save();

    // Clear cache after creating city
    clearCitiesCache();

    res.status(201).json({
      success: true,
      message: 'City created successfully',
      data: city
    });
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create city'
    });
  }
};

// Update city (admin)
exports.updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, description, state, displayOrder, isEnabled, image } = req.body;

    const city = await City.findById(id);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    // Check if name is being changed and if it already exists
    if (name && name.trim() !== city.name) {
      const existingCity = await City.findOne({ name: name.trim(), _id: { $ne: id } });
      if (existingCity) {
        return res.status(400).json({
          success: false,
          message: 'City name already exists'
        });
      }
      city.name = name.trim();
    }

    if (icon !== undefined) city.icon = icon;
    if (image !== undefined) city.image = image;
    if (description !== undefined) city.description = description;
    if (state !== undefined) city.state = state;
    if (displayOrder !== undefined) city.displayOrder = displayOrder;
    if (isEnabled !== undefined) city.isEnabled = isEnabled;

    await city.save();

    // Clear cache after updating city
    clearCitiesCache();

    res.json({
      success: true,
      message: 'City updated successfully',
      data: city
    });
  } catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update city'
    });
  }
};

// Toggle city status (admin)
exports.toggleCityStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const city = await City.findById(id);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    city.isEnabled = !city.isEnabled;
    await city.save();

    // Clear cache after toggling city status
    clearCitiesCache();

    res.json({
      success: true,
      message: `City ${city.isEnabled ? 'enabled' : 'disabled'} successfully`,
      data: city
    });
  } catch (error) {
    console.error('Error toggling city status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle city status'
    });
  }
};

// Delete city (admin)
exports.deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    const city = await City.findByIdAndDelete(id);
    if (!city) {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }

    // Clear cache after deleting city
    clearCitiesCache();

    res.json({
      success: true,
      message: 'City deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting city:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete city'
    });
  }
};


// Upload city image (admin)
exports.uploadCityImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Get the filename from the uploaded file
    const filename = req.file.filename || req.uploadedFilename;
    
    // Create web-accessible URL path
    const imageUrl = `/uploads/${filename}`;

    console.log('Uploaded city image:', {
      filename: filename,
      imageUrl: imageUrl,
      originalPath: req.file.path
    });

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Error uploading city image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image'
    });
  }
};
