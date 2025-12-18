const PopularService = require('../models/PopularService');

// Get all popular services
exports.getAllPopularServices = async (req, res) => {
  try {
    const services = await PopularService.find()
      .populate('cities', 'name icon isEnabled')
      .sort({ order: 1, createdAt: -1 })
      .lean();

    // Ensure all services have the new fields with default values
    const updatedServices = services.map(service => ({
      ...service,
      basePrice: service.basePrice !== undefined ? service.basePrice : 0,
      discount: service.discount !== undefined ? service.discount : 0,
      discountType: service.discountType || 'percentage',
      cgst: service.cgst !== undefined ? service.cgst : 0,
      sgst: service.sgst !== undefined ? service.sgst : 0,
      serviceCharge: service.serviceCharge !== undefined ? service.serviceCharge : 0,
      serviceChargeType: service.serviceChargeType || 'amount',
      excluded: service.excluded || [],
      description: service.description || '',
      trusted: service.trusted || 'Trusted by thousands of homes',
      included: service.included || [],
      addOns: (service.addOns || []).map(addOn => ({
        ...addOn,
        included: addOn.included || [],
        excluded: addOn.excluded || [],
        subServices: (addOn.subServices || []).map(subService => ({
          ...subService,
          icon: subService.icon || 'FaTools'
        }))
      }))
    }));

    res.status(200).json({
      success: true,
      data: updatedServices,
      message: 'Popular services fetched successfully'
    });
  } catch (error) {
    console.error('Get All Popular Services Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular services',
      error: error.message
    });
  }
};

// Get single popular service
exports.getPopularService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await PopularService.findById(id)
      .populate('cities', 'name icon isEnabled');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Popular service not found'
      });
    }

    // Ensure service has all new fields with default values
    const serviceObj = service.toObject();
    const updatedService = {
      ...serviceObj,
      basePrice: serviceObj.basePrice !== undefined ? serviceObj.basePrice : 0,
      discount: serviceObj.discount !== undefined ? serviceObj.discount : 0,
      discountType: serviceObj.discountType || 'percentage',
      cgst: serviceObj.cgst !== undefined ? serviceObj.cgst : 0,
      sgst: serviceObj.sgst !== undefined ? serviceObj.sgst : 0,
      serviceCharge: serviceObj.serviceCharge !== undefined ? serviceObj.serviceCharge : 0,
      serviceChargeType: serviceObj.serviceChargeType || 'amount',
      excluded: serviceObj.excluded || [],
      description: serviceObj.description || '',
      trusted: serviceObj.trusted || 'Trusted by thousands of homes',
      included: serviceObj.included || [],
      addOns: (serviceObj.addOns || []).map(addOn => ({
        ...addOn,
        included: addOn.included || [],
        excluded: addOn.excluded || [],
        subServices: addOn.subServices || []
      }))
    };

    res.status(200).json({
      success: true,
      data: updatedService,
      message: 'Popular service fetched successfully'
    });
  } catch (error) {
    console.error('Get Popular Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular service',
      error: error.message
    });
  }
};

// Create popular service
exports.createPopularService = async (req, res) => {
  try {
    const { name, slug, icon, order, isActive, description, price, basePrice, discount, discountType, cgst, sgst, serviceCharge, serviceChargeType, trusted, included, excluded, addOns, cities } = req.body;

    // Validate required fields
    if (!name || !slug || !icon) {
      return res.status(400).json({
        success: false,
        message: 'Name, slug, and icon are required'
      });
    }

    // Check if slug already exists
    const existingService = await PopularService.findOne({ slug });
    if (existingService) {
      return res.status(400).json({
        success: false,
        message: 'A service with this slug already exists'
      });
    }

    const popularService = new PopularService({
      name,
      slug,
      icon,
      description: description || '',
      price: price || '',
      basePrice: basePrice || 0,
      discount: discount || 0,
      discountType: discountType || 'percentage',
      cgst: cgst || 0,
      sgst: sgst || 0,
      serviceCharge: serviceCharge || 0,
      serviceChargeType: serviceChargeType || 'amount',
      trusted: trusted || 'Trusted by thousands of homes',
      included: included || [],
      excluded: excluded || [],
      addOns: addOns || [],
      cities: cities || [],
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    await popularService.save();

    res.status(201).json({
      success: true,
      data: popularService,
      message: 'Popular service created successfully'
    });
  } catch (error) {
    console.error('Create Popular Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating popular service',
      error: error.message
    });
  }
};

// Update popular service
exports.updatePopularService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, icon, order, isActive, description, price, basePrice, discount, discountType, cgst, sgst, serviceCharge, serviceChargeType, trusted, included, excluded, addOns, cities } = req.body;

    const service = await PopularService.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Popular service not found'
      });
    }

    // Check if slug is being updated and if it already exists
    if (slug && slug !== service.slug) {
      const existingService = await PopularService.findOne({ slug });
      if (existingService) {
        return res.status(400).json({
          success: false,
          message: 'A service with this slug already exists'
        });
      }
    }

    // Update fields
    if (name) service.name = name;
    if (slug) service.slug = slug;
    if (icon) service.icon = icon;
    if (description !== undefined) service.description = description;
    if (price !== undefined) service.price = price;
    if (basePrice !== undefined) service.basePrice = basePrice;
    if (discount !== undefined) service.discount = discount;
    if (discountType !== undefined) service.discountType = discountType;
    if (cgst !== undefined) service.cgst = cgst;
    if (sgst !== undefined) service.sgst = sgst;
    if (serviceCharge !== undefined) service.serviceCharge = serviceCharge;
    if (serviceChargeType !== undefined) service.serviceChargeType = serviceChargeType;
    if (trusted !== undefined) service.trusted = trusted;
    if (included !== undefined) service.included = included;
    if (excluded !== undefined) service.excluded = excluded;
    if (addOns !== undefined) service.addOns = addOns;
    if (cities !== undefined) service.cities = cities;
    if (order !== undefined) service.order = order;
    if (isActive !== undefined) service.isActive = isActive;

    // Ensure all new fields have default values if they don't exist
    if (service.basePrice === undefined || service.basePrice === null) service.basePrice = 0;
    if (service.discount === undefined || service.discount === null) service.discount = 0;
    if (!service.discountType) service.discountType = 'percentage';
    if (service.cgst === undefined || service.cgst === null) service.cgst = 0;
    if (service.sgst === undefined || service.sgst === null) service.sgst = 0;
    if (service.serviceCharge === undefined || service.serviceCharge === null) service.serviceCharge = 0;
    if (!service.serviceChargeType) service.serviceChargeType = 'amount';
    if (!service.excluded || !Array.isArray(service.excluded)) service.excluded = [];
    if (!service.description) service.description = '';
    if (!service.trusted) service.trusted = 'Trusted by thousands of homes';
    if (!service.included || !Array.isArray(service.included)) service.included = [];
    if (!service.addOns || !Array.isArray(service.addOns)) service.addOns = [];
    
    // Ensure addOns have nested fields with default values
    if (service.addOns && Array.isArray(service.addOns)) {
      service.addOns = service.addOns.map(addOn => ({
        ...addOn,
        included: addOn.included || [],
        excluded: addOn.excluded || [],
        subServices: (addOn.subServices || []).map(subService => ({
          ...subService,
          icon: subService.icon || 'FaTools'
        }))
      }));
    }

    await service.save();

    res.status(200).json({
      success: true,
      data: service,
      message: 'Popular service updated successfully'
    });
  } catch (error) {
    console.error('Update Popular Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating popular service',
      error: error.message
    });
  }
};

// Delete popular service
exports.deletePopularService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await PopularService.findByIdAndDelete(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Popular service not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Popular service deleted successfully'
    });
  } catch (error) {
    console.error('Delete Popular Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting popular service',
      error: error.message
    });
  }
};

// Bulk update order
exports.updateOrder = async (req, res) => {
  try {
    const { services } = req.body; // Array of { id, order }

    if (!Array.isArray(services)) {
      return res.status(400).json({
        success: false,
        message: 'Services must be an array'
      });
    }

    const updatePromises = services.map(({ id, order }) =>
      PopularService.findByIdAndUpdate(id, { order }, { new: true })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('Update Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
};

// Migrate existing services to add new fields
exports.migrateExistingServices = async (req, res) => {
  try {
    const services = await PopularService.find();

    let updatedCount = 0;
    const updates = [];

    for (const service of services) {
      const updateData = {};
      let needsUpdate = false;

      // Check and set default values for new fields
      if (service.basePrice === undefined || service.basePrice === null) {
        updateData.basePrice = 0;
        needsUpdate = true;
      }
      if (service.discount === undefined || service.discount === null) {
        updateData.discount = 0;
        needsUpdate = true;
      }
      if (!service.discountType) {
        updateData.discountType = 'percentage';
        needsUpdate = true;
      }
      if (service.cgst === undefined || service.cgst === null) {
        updateData.cgst = 0;
        needsUpdate = true;
      }
      if (service.sgst === undefined || service.sgst === null) {
        updateData.sgst = 0;
        needsUpdate = true;
      }
      if (service.serviceCharge === undefined || service.serviceCharge === null) {
        updateData.serviceCharge = 0;
        needsUpdate = true;
      }
      if (!service.serviceChargeType) {
        updateData.serviceChargeType = 'amount';
        needsUpdate = true;
      }
      if (!service.excluded || !Array.isArray(service.excluded)) {
        updateData.excluded = [];
        needsUpdate = true;
      }
      if (!service.description) {
        updateData.description = '';
        needsUpdate = true;
      }
      if (!service.trusted) {
        updateData.trusted = 'Trusted by thousands of homes';
        needsUpdate = true;
      }
      if (!service.included || !Array.isArray(service.included)) {
        updateData.included = [];
        needsUpdate = true;
      }
      if (!service.addOns || !Array.isArray(service.addOns)) {
        updateData.addOns = [];
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.push(
          PopularService.findByIdAndUpdate(
            service._id,
            { $set: updateData },
            { new: true }
          )
        );
        updatedCount++;
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    res.status(200).json({
      success: true,
      message: `Migration completed successfully. Updated ${updatedCount} out of ${services.length} services.`,
      updatedCount,
      totalCount: services.length
    });
  } catch (error) {
    console.error('Migration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error migrating services',
      error: error.message
    });
  }
};

