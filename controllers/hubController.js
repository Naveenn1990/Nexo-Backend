const Hub = require('../models/Hub');
const Partner = require('../models/PartnerModel');

// Create a new hub
exports.createHub = async (req, res) => {
  try {
    const { name, description, city, state, areas, status } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Hub name is required'
      });
    }

    if (!areas || !Array.isArray(areas) || areas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one area with pin codes is required'
      });
    }

    // Validate areas structure
    for (const area of areas) {
      if (!area.areaName || !area.pinCodes || !Array.isArray(area.pinCodes) || area.pinCodes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Each area must have a name and at least one pin code'
        });
      }

      // Validate pin codes format (6 digits)
      for (const pin of area.pinCodes) {
        if (!/^\d{6}$/.test(pin.trim())) {
          return res.status(400).json({
            success: false,
            message: `Invalid pin code format: ${pin}. Pin codes must be 6 digits`
          });
        }
      }
    }

    // Check if hub with same name already exists
    const existingHub = await Hub.findOne({ name: name.trim() });
    if (existingHub) {
      return res.status(400).json({
        success: false,
        message: 'Hub with this name already exists'
      });
    }

    // Create hub
    const hub = new Hub({
      name: name.trim(),
      description: description?.trim() || '',
      city: city?.trim() || '',
      state: state?.trim() || '',
      areas: areas.map(area => ({
        areaName: area.areaName.trim(),
        pinCodes: area.pinCodes.map(pin => pin.trim())
      })),
      status: status || 'active'
    });

    await hub.save();

    res.status(201).json({
      success: true,
      message: 'Hub created successfully',
      data: hub
    });
  } catch (error) {
    console.error('Create Hub Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating hub'
    });
  }
};

// Get all hubs
exports.getAllHubs = async (req, res) => {
  try {
    const { status, search } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } }
      ];
    }

    const hubs = await Hub.find(query)
      .populate('assignedPartners', 'profile.name phone profile.email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: hubs.length,
      data: hubs
    });
  } catch (error) {
    console.error('Get All Hubs Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching hubs'
    });
  }
};

// Get hub by ID
exports.getHubById = async (req, res) => {
  try {
    const { hubId } = req.params;

    const hub = await Hub.findById(hubId)
      .populate('assignedPartners', 'profile.name phone profile.email profile.pincode')
      .lean();

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: 'Hub not found'
      });
    }

    res.status(200).json({
      success: true,
      data: hub
    });
  } catch (error) {
    console.error('Get Hub By ID Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching hub'
    });
  }
};

// Update hub
exports.updateHub = async (req, res) => {
  try {
    const { hubId } = req.params;
    const { name, description, city, state, areas, status } = req.body;

    const hub = await Hub.findById(hubId);
    if (!hub) {
      return res.status(404).json({
        success: false,
        message: 'Hub not found'
      });
    }

    // If name is being updated, check for duplicates
    if (name && name.trim() !== hub.name) {
      const existingHub = await Hub.findOne({ name: name.trim(), _id: { $ne: hubId } });
      if (existingHub) {
        return res.status(400).json({
          success: false,
          message: 'Hub with this name already exists'
        });
      }
      hub.name = name.trim();
    }

    // Update fields
    if (description !== undefined) hub.description = description?.trim() || '';
    if (city !== undefined) hub.city = city?.trim() || '';
    if (state !== undefined) hub.state = state?.trim() || '';
    if (status !== undefined) hub.status = status;

    // Update areas if provided
    if (areas && Array.isArray(areas)) {
      if (areas.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Hub must have at least one area'
        });
      }

      // Validate areas structure
      for (const area of areas) {
        if (!area.areaName || !area.pinCodes || !Array.isArray(area.pinCodes) || area.pinCodes.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Each area must have a name and at least one pin code'
          });
        }

        // Validate pin codes format
        for (const pin of area.pinCodes) {
          if (!/^\d{6}$/.test(pin.trim())) {
            return res.status(400).json({
              success: false,
              message: `Invalid pin code format: ${pin}. Pin codes must be 6 digits`
            });
          }
        }
      }

      hub.areas = areas.map(area => ({
        areaName: area.areaName.trim(),
        pinCodes: area.pinCodes.map(pin => pin.trim())
      }));
    }

    hub.updatedAt = new Date();
    await hub.save();

    res.status(200).json({
      success: true,
      message: 'Hub updated successfully',
      data: hub
    });
  } catch (error) {
    console.error('Update Hub Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating hub'
    });
  }
};

// Delete hub
exports.deleteHub = async (req, res) => {
  try {
    const { hubId } = req.params;

    const hub = await Hub.findById(hubId);
    if (!hub) {
      return res.status(404).json({
        success: false,
        message: 'Hub not found'
      });
    }

    // Check if hub is assigned to any partners
    if (hub.assignedPartners && hub.assignedPartners.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete hub. It is assigned to one or more partners. Please unassign partners first.'
      });
    }

    await Hub.findByIdAndDelete(hubId);

    res.status(200).json({
      success: true,
      message: 'Hub deleted successfully'
    });
  } catch (error) {
    console.error('Delete Hub Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting hub'
    });
  }
};

// Assign hub to partner
exports.assignHubToPartner = async (req, res) => {
  try {
    const { hubId } = req.params;
    const { partnerId } = req.body;

    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: 'Partner ID is required'
      });
    }

    const hub = await Hub.findById(hubId);
    if (!hub) {
      return res.status(404).json({
        success: false,
        message: 'Hub not found'
      });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    // Check if already assigned (handle both ObjectId and string comparisons)
    const partnerIdStr = partnerId.toString();
    const isAlreadyAssigned = hub.assignedPartners.some(p => p.toString() === partnerIdStr);
    
    if (isAlreadyAssigned) {
      return res.status(200).json({
        success: true,
        message: 'Hub is already assigned to this partner',
        data: hub
      });
    }

    hub.assignedPartners.push(partnerId);
    await hub.save();

    // Also update partner's hubs array
    // Ensure hubs array exists
    if (!partner.hubs) {
      partner.hubs = [];
    }
    
    // Convert hubId to string for comparison
    const hubIdStr = hubId.toString();
    const existingHubIds = partner.hubs.map(h => h.toString());
    
    if (!existingHubIds.includes(hubIdStr)) {
      partner.hubs.push(hubId);
      await partner.save();
      console.log(`Hub ${hubId} assigned to partner ${partnerId}. Partner now has ${partner.hubs.length} hubs.`);
    } else {
      console.log(`Hub ${hubId} already assigned to partner ${partnerId}`);
    }

    res.status(200).json({
      success: true,
      message: 'Hub assigned to partner successfully',
      data: hub,
      partnerHubs: partner.hubs
    });
  } catch (error) {
    console.error('Assign Hub To Partner Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error assigning hub to partner'
    });
  }
};

// Unassign hub from partner
exports.unassignHubFromPartner = async (req, res) => {
  try {
    const { hubId } = req.params;
    const { partnerId } = req.body;

    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: 'Partner ID is required'
      });
    }

    const hub = await Hub.findById(hubId);
    if (!hub) {
      return res.status(404).json({
        success: false,
        message: 'Hub not found'
      });
    }

    // Check if assigned
    if (!hub.assignedPartners.includes(partnerId)) {
      return res.status(400).json({
        success: false,
        message: 'Hub is not assigned to this partner'
      });
    }

    hub.assignedPartners = hub.assignedPartners.filter(
      id => id.toString() !== partnerId.toString()
    );
    await hub.save();

    // Also update partner's hubs array
    partner.hubs = partner.hubs.filter(
      id => id.toString() !== hubId.toString()
    );
    await partner.save();

    res.status(200).json({
      success: true,
      message: 'Hub unassigned from partner successfully',
      data: hub
    });
  } catch (error) {
    console.error('Unassign Hub From Partner Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error unassigning hub from partner'
    });
  }
};

// Get hubs by pin code
exports.getHubsByPinCode = async (req, res) => {
  try {
    const { pinCode } = req.params;

    if (!/^\d{6}$/.test(pinCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pin code format. Pin code must be 6 digits'
      });
    }

    const hubs = await Hub.find({
      'areas.pinCodes': pinCode,
      status: 'active'
    })
      .populate('assignedPartners', 'profile.name phone profile.email')
      .lean();

    res.status(200).json({
      success: true,
      count: hubs.length,
      data: hubs
    });
  } catch (error) {
    console.error('Get Hubs By Pin Code Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching hubs by pin code'
    });
  }
};

// Get partners assigned to a hub
exports.getHubPartners = async (req, res) => {
  try {
    const { hubId } = req.params;

    const hub = await Hub.findById(hubId)
      .populate('assignedPartners', 'profile.name phone profile.email profile.pincode profile.address')
      .lean();

    if (!hub) {
      return res.status(404).json({
        success: false,
        message: 'Hub not found'
      });
    }

    res.status(200).json({
      success: true,
      count: hub.assignedPartners.length,
      data: hub.assignedPartners
    });
  } catch (error) {
    console.error('Get Hub Partners Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching hub partners'
    });
  }
};

// Add area to hub
exports.addAreaToHub = async (req, res) => {
  try {
    const { hubId } = req.params;
    const { areaName, pinCodes } = req.body;

    if (!areaName || !pinCodes || !Array.isArray(pinCodes) || pinCodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Area name and at least one pin code are required'
      });
    }

    // Validate pin codes
    for (const pin of pinCodes) {
      if (!/^\d{6}$/.test(pin.trim())) {
        return res.status(400).json({
          success: false,
          message: `Invalid pin code format: ${pin}. Pin codes must be 6 digits`
        });
      }
    }

    const hub = await Hub.findById(hubId);
    if (!hub) {
      return res.status(404).json({
        success: false,
        message: 'Hub not found'
      });
    }

    // Check if area already exists
    const existingArea = hub.areas.find(area => area.areaName.toLowerCase() === areaName.trim().toLowerCase());
    if (existingArea) {
      return res.status(400).json({
        success: false,
        message: 'Area with this name already exists in the hub'
      });
    }

    hub.areas.push({
      areaName: areaName.trim(),
      pinCodes: pinCodes.map(pin => pin.trim())
    });

    await hub.save();

    res.status(200).json({
      success: true,
      message: 'Area added to hub successfully',
      data: hub
    });
  } catch (error) {
    console.error('Add Area To Hub Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error adding area to hub'
    });
  }
};

// Update area in hub
exports.updateAreaInHub = async (req, res) => {
  try {
    const { hubId, areaId } = req.params;
    const { areaName, pinCodes } = req.body;

    const hub = await Hub.findById(hubId);
    if (!hub) {
      return res.status(404).json({
        success: false,
        message: 'Hub not found'
      });
    }

    const area = hub.areas.id(areaId);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: 'Area not found'
      });
    }

    if (areaName) {
      // Check if another area with same name exists
      const existingArea = hub.areas.find(
        a => a._id.toString() !== areaId && a.areaName.toLowerCase() === areaName.trim().toLowerCase()
      );
      if (existingArea) {
        return res.status(400).json({
          success: false,
          message: 'Another area with this name already exists in the hub'
        });
      }
      area.areaName = areaName.trim();
    }

    if (pinCodes && Array.isArray(pinCodes)) {
      if (pinCodes.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one pin code is required'
        });
      }

      // Validate pin codes
      for (const pin of pinCodes) {
        if (!/^\d{6}$/.test(pin.trim())) {
          return res.status(400).json({
            success: false,
            message: `Invalid pin code format: ${pin}. Pin codes must be 6 digits`
          });
        }
      }

      area.pinCodes = pinCodes.map(pin => pin.trim());
    }

    await hub.save();

    res.status(200).json({
      success: true,
      message: 'Area updated successfully',
      data: hub
    });
  } catch (error) {
    console.error('Update Area In Hub Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating area'
    });
  }
};

// Delete area from hub
exports.deleteAreaFromHub = async (req, res) => {
  try {
    const { hubId, areaId } = req.params;

    const hub = await Hub.findById(hubId);
    if (!hub) {
      return res.status(404).json({
        success: false,
        message: 'Hub not found'
      });
    }

    if (hub.areas.length <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete area. Hub must have at least one area'
      });
    }

    const area = hub.areas.id(areaId);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: 'Area not found'
      });
    }

    hub.areas.pull(areaId);
    await hub.save();

    res.status(200).json({
      success: true,
      message: 'Area deleted successfully',
      data: hub
    });
  } catch (error) {
    console.error('Delete Area From Hub Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting area'
    });
  }
};

