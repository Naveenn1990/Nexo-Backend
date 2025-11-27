const mongoose = require('mongoose');
const ServiceCategory = require("../models/ServiceCategory");
const Service = require("../models/Service");
const Booking = require("../models/booking");
const SubService = require('../models/SubService');
const path = require('path');

const SubCategory = require("../models/SubCategory");
const Product = require("../models/product");
const Partner = require("../models/PartnerModel");
const { uploadFile2, multifileUpload } = require('../middleware/aws');
const PartnerWallet = require('../models/PartnerWallet');
const MGPlan = require('../models/MGPlan');
// Get all services
exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.find()
      .populate({
        path: 'category',
        select: 'name description icon status subCategoryTitle createdAt updatedAt'
      })
      .lean();

    res.status(200).json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('Get All Services Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create service
exports.createService = async (req, res) => {
  try {
    console.log('Create Service Request:', {
      body: req.body,
      file: req.file,
      headers: req.headers['content-type']
    });

    // Validate required fields
    if (!req.body.name || !req.body.description || !req.body.subCategory) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, subCategory, basePrice, and duration are required'
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    // Validate category exists
    const subCategory = await SubCategory.findById(req.body.subCategory);
    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    let image=await uploadFile2(req.file,"service")
    const service = new Service({
      subCategory: req.body.subCategory,
      name: req.body.name,
      description: req.body.description,
      icon:image, 
    });

    await service.save();
    subCategory.services.push(service._id);
    await subCategory.save();



    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service
    });
  } catch (error) {
    console.error('Create Service Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all service categories
exports.getAllServiceCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find().sort({ order: 1, createdAt: -1 });
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get services by category
exports.getServicesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    // Validate category exists
    const category = await ServiceCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Get services
    const services = await Service.find({ category: categoryId });
    
    res.status(200).json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('Get Services by Category Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add sub-service
exports.addSubService = async (req, res) => {
  try {


    const { serviceId } = req.params;
    const { name, description, basePrice, duration } = req.body;

    // Basic validation
    if (!name || !description || !basePrice || !duration) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        required: ["name", "description", "basePrice", "duration"],
        received: req.body
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Icon file is required"
      });
    }
 
    // Find parent service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Parent service not found"
      });
    }

   let image=await uploadFile2(req.file,"subservice")
    

    // Create sub-service
    const subService = new SubService({
      service: serviceId,
      name: name.trim(),
      description: description.trim(),
      price: Number(basePrice), // Set price, basePrice will be calculated by pre-save hook
      basePrice: Number(basePrice),
      icon: image ? [image] : [], // Icon is an array
      isActive: true
    });

    try {
      await subService.save(); // Save the new subservice
      service.subServices.push(subService._id); // Add the subservice ID to the service
      await service.save(); // Save the updated service
    } catch (error) {
      console.error('Error adding subservice:', error);
      return res.status(500).json({
        success: false,
        message: "Error saving subservice: " + error.message
      });
    }

    // Populate service details in response
    const populatedSubService = await SubService.findById(subService._id)
      .populate('service', 'name description')
      .lean();

    // const subCategory = await SubCategory.findById(service.subCategory);
    // if (subCategory) {
    //     subCategory.subservices.push(subService._id);
    //     await subCategory.save();
    // } 
    




    res.status(201).json({
      success: true,
      message: "Sub-service added successfully",
      data: populatedSubService || subService
    });

  } catch (error) {
    console.error('Add Sub-Service Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Error adding sub-service"
    });
  }
};

// Update service category
exports.updateServiceCategory = async (req, res) => {
  try {
    const { name, description, subtitle, icon, order, isActive } = req.body;

    // Find the existing category
    const existingCategory = await ServiceCategory.findById(req.params.categoryId);
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Service category not found",
      });
    }

    // Prepare update object (only update fields that are provided)
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description) updateData.description = description.trim();
    if (subtitle) updateData.subtitle = subtitle.trim();
    if (order !== undefined) updateData.order = parseInt(order);
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Handle icon update - support both file upload and emoji/string
    if (req.file) {
      // If file is uploaded, use file
      updateData.icon = await uploadFile2(req.file, "servicecategory");
    } else if (icon !== undefined) {
      // If icon is provided as string (emoji), use it directly
      updateData.icon = icon.trim();
    }

    // Perform the update
    const category = await ServiceCategory.findByIdAndUpdate(
      req.params.categoryId,
      { $set: updateData },
      { new: true }
    );

    res.json({
      success: true,
      message: "Category updated successfully",
      data: category
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({
      success: false,
      message: "Error updating service category",
      error: error.message
    });
  }
};

// Delete service category
exports.deleteServiceCategory = async (req, res) => {
  try {
    const category = await ServiceCategory.findById(req.params.categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Service category not found"
      });
    }

    // Check if category has any active services
    const activeServices = await Service.find({ category: req.params.categoryId, status: 'active' });
    if (activeServices.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with active services"
      });
    }

    // Use findByIdAndDelete instead of remove()
    await ServiceCategory.findByIdAndDelete(req.params.categoryId);
    
    res.json({
      success: true,
      message: "Service category deleted successfully"
    });
  } catch (error) {
    console.error("Delete Category Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting service category",
      error: error.message
    });
  }
};

// Get service analytics
exports.getServiceAnalytics = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    
    // Get bookings for this category in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookings = await Booking.find({
      'service.category': categoryId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Calculate analytics
    const analytics = {
      totalBookings: bookings.length,
      totalRevenue: bookings.reduce((sum, booking) => sum + booking.amount, 0),
      averageRating: bookings.filter(b => b.rating).reduce((sum, b) => sum + b.rating, 0) / 
                    bookings.filter(b => b.rating).length || 0,
      statusBreakdown: {
        completed: bookings.filter(b => b.status === 'completed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length,
        pending: bookings.filter(b => b.status === 'pending').length
      }
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching service analytics"
    });
  }
};

// Create category
exports.createCategory = async (req, res) => {
    try {
        if (!req.body.name || !req.body.description || !req.body.subtitle) {
            return res.status(400).json({
                success: false,
                message: 'Name, description, and subtitle are required'
            });
        }

        // Support both file upload and emoji/string icon
        let iconValue = '';
        if (req.file) {
            // If file is uploaded, use file
            iconValue = await uploadFile2(req.file, "servicecategory");
        } else if (req.body.icon) {
            // If icon is provided as string (emoji), use it directly
            iconValue = req.body.icon.trim();
        } else {
            return res.status(400).json({
                success: false,
                message: 'Icon is required (either upload a file or select an emoji icon)'
            });
        }

        // Get the highest order number and add 1 for new category
        const maxOrderCategory = await ServiceCategory.findOne().sort({ order: -1 });
        const nextOrder = maxOrderCategory ? (maxOrderCategory.order || 0) + 1 : 1;

        // Create new category
        const category = new ServiceCategory({
            name: req.body.name.trim(),
            description: req.body.description.trim(),
            subtitle: req.body.subtitle.trim(),
            icon: iconValue,
            order: req.body.order !== undefined ? parseInt(req.body.order) : nextOrder,
            isActive: req.body.isActive !== undefined ? req.body.isActive : true
        });

        const savedCategory = await category.save();

        // Transform the response
        const response = {
            _id: savedCategory._id,
            name: savedCategory.name,
            description: savedCategory.description,
            icon: savedCategory.icon, // This will be just the filename
            status: savedCategory.status,
            createdAt: savedCategory.createdAt,
            updatedAt: savedCategory.updatedAt,
            subtitle: savedCategory.subtitle
        };

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: response
        });
    } catch (error) {
        console.error('Create Category Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all categories
exports.getAllCategories = async (req, res) => {
    try {
        // Use lean() for better performance and to get plain objects
        const categories = await ServiceCategory.find().lean();
        
        // Transform to ensure clean data
        const transformedCategories = categories.map(category => {
            let icon = category.icon;
         
                    return {
                _id: category._id,
                name: category.name,
                subtitle: category.subtitle,
                icon: icon,
                createdAt: category.createdAt
            };
        });

        res.status(200).json({
            success: true,
            data: transformedCategories,
            message: "Categories fetched successfully"
        });
    } catch (error) {
        console.error('Get Categories Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all sub-services
exports.getAllSubServices = async (req, res) => {
    try {
        // Debug: Check if SubService model exists
        // console.log('SubService Model:', !!SubService);

        // First get all sub-services without population to check raw data
        const rawSubServices = await SubService.find().populate();
        // console.log('Raw data count:', rawSubServices.length);
        // console.log('First raw item:', rawSubServices[0]);

        // Now try to populate
        const subServices = await SubService.find()
            .populate('service');

        // console.log('After populate count:', subServices.length);
        // console.log('First populated item:', JSON.stringify(subServices[0], null, 2));

        // Safe mapping with extensive null checking
        const formattedSubServices = subServices
            .filter(item => item !== null && item !== undefined)
            .map(subService => {
                // Debug log for each item
                // console.log('Processing subService:', subService?._id);

                return {
                    _id: subService?._id?.toString() || 'No ID',
                    name: subService?.name || 'Unnamed Service',
                    description: subService?.description || 'No description',
                    price: subService?.price || 0,
                    duration: subService?.duration || 0,
                    isActive: Boolean(subService?.isActive),
                    serviceName: subService?.service?.name || 'No Service Name',
                    createdAt: subService?.createdAt || new Date(),
                    updatedAt: subService?.updatedAt || new Date()
                };
            });

        // Return the results
        return res.status(200).json({
            success: true,
            count: formattedSubServices.length,
            data: formattedSubServices
        });

    } catch (error) {
        console.error('Detailed error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        return res.status(500).json({
            success: false,
            message: 'Error fetching sub-services',
            error: error.message
        });
    }
};
// Create sub-service
// exports.createSubService = async (req, res) => {
//   try {
//       console.log('Received Data:', req.body);
//       console.log('Uploaded File:', req.file || 'No file uploaded');

//       if (!req.file) {
//           return res.status(400).json({ success: false, message: 'Icon image is required' });
//       }

//       const iconPath = req.file.filename; // Store uploaded filename

//       const subService = new SubService({
//           name: req.body.name,
//           description: req.body.description,
//           service: req.body.service,
//           mrp: req.body.mrp,
//           discount: req.body.discount,
//           gst: req.body.gst,
//           icon: iconPath, // Save file path
//           includes: req.body.includes.split(','), 
//           excludes: req.body.excludes.split(',')
//       });

//       const savedSubService = await subService.save();

//       res.status(201).json({
//           success: true,
//           message: 'Sub-Service created successfully',
//           subService: savedSubService
//       });

//   } catch (error) {
//       console.error('Error:', error);
//       res.status(500).json({ success: false, message: 'Error creating sub-service', error: error.message });
//   }
// };

// Create sub-service
exports.createSubService = async (req, res) => {
  try {
    console.log("Received Data:", req.body);
    console.log("Uploaded Files:", req.files || "No files uploaded");

    // Ensure at least 4 images are uploaded
    if (!req.files || req.files.length < 4) {
      return res.status(400).json({ 
        success: false, 
        message: "At least 4 images are required" 
      });
    }
 
    // Extract file paths
    const imageUploadPromises = req.files.map(async (file) => {
      return await uploadFile2(file, "subservice");
  });
 
  // Wait for all uploads to complete
  const imagePaths = await Promise.all(imageUploadPromises);
  
    // Ensure city field is an array
    const cities = Array.isArray(req.body.city) ? req.body.city : req.body.city.split(",");

    const subService = new SubService({
      name: req.body.name,
      description: req.body.description,
      service: req.body.service,
      price: req.body.price,
      discount: req.body.discount,
      gst: req.body.gst,
      commission: req.body.commission,
      icon: imagePaths, // Store array of image filenames
      includes: req.body.includes ? req.body.includes.split(",") : [],
      excludes: req.body.excludes ? req.body.excludes.split(",") : [],
      city: cities,
      minimumAmount: req.body.minimumAmount || 0, // Default to 0 if not provided
      acceptCharges: req.body.acceptCharges || 0 // Default to 0 if not provided
    });

    const savedSubService = await subService.save();

    res.status(201).json({
      success: true,
      message: "Sub-Service created successfully",
      subService: savedSubService
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating sub-service",
      error: error.message
    });
  }
};

exports.multiimages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // ✅ No need to wrap file inside [file], directly send files array
    const imagePaths = await multifileUpload(req.files, "subservice");

    console.log("imagePaths:", imagePaths);

    return res.status(201).json({ 
      message: "Images uploaded successfully",
      urls: imagePaths 
    });
  } catch (err) {
    console.error("Error uploading Images: ", err);
    res.status(500).json({ 
      message: "Failed to upload images", 
      error: err.message 
    });
  }
};

// Create Bulk Sub-Services
exports.bulkCreateSubServices = async (req, res) => {
  try {
    const subServices = req.body;

    if (!Array.isArray(subServices) || subServices.length === 0) {
      return res.status(400).json({ success: false, message: "No sub-services data provided" });
    }

    // Optional: Validate each sub-service entry (name, price etc.)

    const savedSubServices = await SubService.insertMany(subServices);

    res.status(201).json({
      success: true,
      message: `${savedSubServices.length} Sub-Services created successfully`,
      data: savedSubServices,
    });

  } catch (error) {
    console.error("Error in Bulk Upload:", error);
    res.status(500).json({
      success: false,
      message: "Error bulk creating sub-services",
      error: error.message,
    });
  }
};

// Bulk partial update for sub-services
exports.bulkUpdateSubServices = async (req, res) => {
  try {
    const updates = req.body; // Expecting an array of sub-services with subServiceId and fields to update
    // const files = req.files || []; // Assuming files are received as multipart form data

    const updateResults = [];

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const { subServiceId } = update;

      if (!subServiceId) {
        updateResults.push({ subServiceId: null, success: false, message: "subServiceId is required" });
        continue;
      }

      const subService = await SubService.findById(subServiceId);
      if (!subService) {
        updateResults.push({ subServiceId, success: false, message: "Sub-service not found" });
        continue;
      }

      // Filter matching images from files
      // const imageFiles = files.filter(file => file.originalname.startsWith(subServiceId + '_'));
      const imageFiles = update.icon;
      let imagePaths;

      if (imageFiles.length > 0 && imageFiles.length < 4) {
        updateResults.push({
          subServiceId,
          success: false,
          message: "At least 4 images are required to update images"
        });
        continue;
      }

      if (imageFiles.length >= 4) {
        // const uploadPromises = imageFiles.map(file => uploadFile2(file, "subservice"));
        // imagePaths = await Promise.all(uploadPromises);
        subService.icon = update.icon;
      }

      // Update only the provided fields
      const fields = [
        "name", "description", "price", "includes", "excludes",
        "discount", "gst", "commission", "service", "city", "subService"
      ];
      fields.forEach(field => {
        // if (update[field] !== undefined && update[field] !== null) {
        //   if (field === "city" || field === "includes" || field === "excludes") {
        //     subService[field] = Array.isArray(update[field]) ? update[field] : update[field].split(',').map(e => e.trim());
        //   } 
        //   else {
        //     subService[field] = update[field];
        //   }
        // }
        if (update[field] !== undefined && update[field] !== null) {
            if (field === "city" || field === "includes" || field === "excludes") {
              const processed = Array.isArray(update[field])
                ? update[field].map(e => e.trim())
                : update[field].split(',').map(e => e.trim()).filter(Boolean);

              if (processed.length > 0) {
                subService[field] = processed;
              }
            } else {
              subService[field] = update[field];
            }
          }
        });

      await subService.save();
      updateResults.push({ subServiceId, success: true, message: "Sub-service updated" });
    }

    res.status(200).json({
      success: true,
      message: "Bulk update completed",
      results: updateResults
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

 
// Update service
exports.updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, description } = req.body;

    // Find service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    // Update fields
    service.name = name || service.name;
    service.description = description || service.description;  


    // Update icon if provided
    if (req.file) {
      service.icon =await uploadFile2(req.file,"service")
    }

    await service.save();
    

    res.json({
      success: true,
      message: "Service updated successfully",
      data: service
    });
  } catch (error) {
    console.error('Update Service Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete service
exports.deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    // Find and delete service
    const service = await Service.findByIdAndDelete(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    // Remove service reference from category
    await ServiceCategory.updateMany(
      { services: serviceId },
      { $pull: { services: serviceId } }
    );

    res.json({
      success: true,
      message: "Service deleted successfully"
    });
  } catch (error) {
    console.error('Delete Service Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
 
// Update sub-service
exports.updateSubService = async (req, res) => {
  console.log("Req BOdy : " , req.body)
  console.log("Req Files : " , req.files)
  try {
    const { serviceId, subServiceId } = req.params;
    const { name, description, price , includes , excludes } = req.body;
   
    let imagePaths = undefined;

    if (req.files && req.files.length > 0) {
      if (req.files.length < 4) {
        console.log("Only 1 image is there")
        return res.status(400).json({ 
          success: false, 
          message: "At least 4 images are required" 
        });
      }

      const imageUploadPromises = req.files.map(async (file) => {
        return await uploadFile2(file, "subservice");
      });
      imagePaths = await Promise.all(imageUploadPromises);
    }
   
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    const subService = await SubService.findById(subServiceId);
    if (!subService) {
      return res.status(404).json({
        success: false,
        message: "Sub-service not found"
      });
    }

    // Update fields
    subService.name = name || subService.name;
    subService.description = description || subService.description;
    subService.price = price || subService.price;
    subService.includes = includes? includes?.split(",") : subService.includes;
    subService.excludes = excludes ? excludes?.split(",") : subService.excludes;
    subService.discount = req.body.discount || subService.discount;
    subService.gst = req.body.gst || subService.gst;
    subService.commission = req.body.commission || subService.commission; 
    if (req.body.service && req.body.service !== 'null') {
      subService.service = req.body.service;
    }
    subService.minimumAmount = req.body.minimumAmount || subService.minimumAmount;

    if (imagePaths !== undefined) {
      subService.icon = imagePaths;
    }
  subService.acceptCharges = req.body.acceptCharges || subService.acceptCharges; // Default to 0 if not provided

    await subService.save();

    res.json({
      success: true,
      message: "Sub-service updated successfully",
      data: subService
    });
  } catch (error) {
    console.error('Update Sub-service Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
  
exports.deleteSubService = async (req, res) => {
  try {
    const { serviceId, subServiceId } = req.params;

    // Find service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    // Find and delete sub-service
    const subService = await SubService.findByIdAndDelete(subServiceId);
    if (!subService) {
      return res.status(404).json({
        success: false,
        message: "Sub-service not found"
      });
    }

    // Remove sub-service reference from service
    service.subServices = service.subServices.filter(
      id => id.toString() !== subServiceId
    );
    await service.save();

    res.json({
      success: true,
      message: "Sub-service deleted successfully"
    });
  } catch (error) {
    console.error('Delete Sub-service Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update service recommendation status
exports.updateServiceRecommendation = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { isRecommended } = req.body;

    if (typeof isRecommended !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isRecommended must be a boolean value'
      });
    }

    const service = await Service.findByIdAndUpdate(
      serviceId,
      { isRecommended },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Service ${isRecommended ? 'marked as' : 'removed from'} recommended`,
      data: service
    });
  } catch (error) {
    console.error('Update Service Recommendation Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update service most booked status
exports.updateServiceMostBooked = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { isMostBooked } = req.body;

    if (typeof isMostBooked !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isMostBooked must be a boolean value'
      });
    }

    const service = await Service.findByIdAndUpdate(
      serviceId,
      { isMostBooked },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Service ${isMostBooked ? 'marked as' : 'removed from'} most booked`,
      data: service
    });
  } catch (error) {
    console.error('Update Service Most Booked Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get recommended services
exports.getRecommendedServices = async (req, res) => {
  try {
    const services = await Service.find({ isRecommended: true, isActive: true })
      .populate('category')
      .lean();

    res.status(200).json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('Get Recommended Services Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get most booked services
exports.getMostBookedServices = async (req, res) => {
  try {
    const services = await Service.find({ isMostBooked: true, isActive: true })
      .populate('category')
      .lean();

    res.status(200).json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('Get Most Booked Services Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all categories with sub-categories, services, and sub-services
exports.getAllCategoriesWithDetails = async (req, res) => {
    try {
        const categories = await ServiceCategory.find()
            .populate({
                path: 'subcategories', // Fixed: use lowercase 'subcategories' to match schema
                populate: {
                    path: 'services', // Assuming the SubCategory model has a field 'services'
                    populate: {
                        path: 'subServices' // Assuming the Service model has a field 'subServices'
                    }
                }
            });

        // Format the response to include sub-categories nested within categories
        const formattedCategories = categories.map(category => ({
            _id: category._id,
            name: category.name,
            description: category.description,
            icon: category.icon,
            subcategories: category.subcategories // Fixed: use lowercase to match schema
        }));

        res.status(200).json({
            success: true,
            data: formattedCategories
        });
    } catch (error) {
        console.error('Get All Categories Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// add product for partner
exports.addProduct = async (req, res) => {
  try {
    const { name, category, brand, description, price, stock, specifications, howToUse, hsnCode, gstPercentage, discountPercentage, model } = req.body;
    
    let imagePath = req.file ? req.file : ""; // Get uploaded image path

    // Extract only the filename from the image path
    if (imagePath) {
      imagePath =  await uploadFile2( req.file, "products");
    }



    const newProduct = new Product({
      name,
      category,
      brand,
      description,
      price,
      stock,
      specifications,
      howToUse,
      hsnCode,
      gstPercentage,
      discountPercentage,
      model,
      image: imagePath, // Save only filename
    });

    await newProduct.save();

    res.status(201).json({ message: "Product added successfully", product: newProduct });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ message: "Error adding product", error: error.message });
  }
};


// ✅ Get all products (Admin)
// exports.getAllProducts = async (req, res) => {    
//   try {
//       const products = await Product.find();
//       res.status(200).json(products);
//   } catch (error) {
//       res.status(500).json({ message: "Error fetching products", error });
//   }
// };

// ✅ Get all products (Admin) with populated category
exports.getAllProducts = async (req, res) => {    
  try {
      const products = await Product.find().populate("category"); // Populating the category field
      res.status(200).json(products);
  } catch (error) {
    console.log("error : " , error)
      res.status(500).json({ message: "Error fetching products", error });
  }
};


// ✅ Update product (Admin)
exports.updateProduct = async (req, res) => {
  try {
    console.log("Received params:", req.params); // Debugging

    const { id: productId } = req.params; // Extract correct param

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }

    // Find the existing product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Prepare update fields
    const updateFields = { ...req.body };

    // Handle image update
    if (req.file) {
      updateFields.image =   imagePath =  await uploadFile2( req.file, "products");
    }

    // Remove empty values to ensure partial update
    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] === undefined || updateFields[key] === null || updateFields[key] === "") {
        delete updateFields[key];
      }
    });

    // Update only the provided fields
    Object.assign(product, updateFields);

    // Save updated product
    await product.save();

    res.status(200).json({
      message: "Product updated successfully",
      product,
    });

  } catch (error) {
    console.log("error : " , error)
      res.status(500).json({ message: "Error updating product", error });
  }
};





// ✅ Delete product (Admin)
exports.deleteProduct = async (req, res) => {
  try {
      const { id } = req.params;
      const deletedProduct = await Product.findByIdAndDelete(id);

      if (!deletedProduct) return res.status(404).json({ message: "Product not found" });

      res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
      res.status(500).json({ message: "Error deleting product", error });
  }
};



// ✅ Reduce inventory when a partner selects a product
exports.useProduct = async (req, res) => {
  try {
      const { id } = req.params;

      const product = await Product.findById(id);
      if (!product || product.stock <= 0) return res.status(400).json({ message: "Product out of stock" });

      product.stock -= 1;
      await product.save();

      res.status(200).json({ message: "Product used successfully", product });
  } catch (error) {
      res.status(500).json({ message: "Error using product", error });
  }
};

// ✅ Replenish inventory when a partner removes a product
exports.returnProduct = async (req, res) => {
  try {
      const { id } = req.params;

      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ message: "Product not found" });

      product.stock += 1;
      await product.save();

      res.status(200).json({ message: "Product returned successfully", product });
  } catch (error) {
      res.status(500).json({ message: "Error returning product", error });
  }
};



//change the partner profile status 
// Admin API to update partner's profile status
exports.updatePartnerStatus = async (req, res) => {
  try {
      const { partnerId } = req.params;
      const { status } = req.body;

      // Validate status value
      if (!['active', 'inactive'].includes(status)) {
          return res.status(400).json({
              success: false,
              message: "Invalid status value. Must be 'active' or 'inactive'."
          });
      }

      // Find and update partner's status
      const updatedPartner = await Partner.findByIdAndUpdate(
          partnerId,
          { profileStatus: status },
          { new: true } // Return updated document
      );

      if (!updatedPartner) {
          return res.status(404).json({
              success: false,
              message: "Partner not found."
          });
      }

      // Send notification to partner
      const notificationTitle = status === 'active' ? 'Account Activated' : 'Account Deactivated';
      const notificationMessage = status === 'active' 
        ? 'Your partner account has been activated. You can now accept bookings and provide services.'
        : 'Your partner account has been deactivated. Please contact support for more information.';
      
      const { sendPartnerNotification, sendAdminNotification } = require("../services/notificationService");
      await sendPartnerNotification(
          partnerId,
          notificationTitle,
          notificationMessage,
          status === 'active' ? 'success' : 'alert',
          '/android-chrome-192x192.png'
      );

      // Notify admin
      if (req.admin) {
          await sendAdminNotification(
              req.admin._id,
              'Partner Status Updated',
              `Partner ${updatedPartner.profile?.name || updatedPartner.phone} status changed to ${status}.`,
              'info',
              '/android-chrome-192x192.png'
          );
      }

      res.status(200).json({
          success: true,
          message: `Partner's status updated to '${status}'.`,
          data: updatedPartner
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message
      });
  }
};

exports.deletePartner = async (req, res) => {
  try {
      const { partnerId } = req.params;

      // Find and delete the partner
      const deletedPartner = await Partner.findByIdAndDelete(partnerId);
      if (!deletedPartner) {
          return res.status(404).json({
              success: false,
              message: "Partner not found."
          });
      }
      await PartnerWallet.deleteOne({ partner: partnerId });
      res.status(200).json({
          success: true,
          message: "Partner deleted successfully."
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message
      });
  }
}


exports.updatePartnerProfile = async (req, res) => {
  try {
    let { id } = req.params;
    
    // Handle both JSON and FormData
    let bodyData = req.body
    // If it's FormData, bodyData will already be parsed by multer
    // If it's JSON, bodyData will be the parsed JSON
    
    let { 
      name, 
      email, 
      phone, 
      whatsappNumber,
      qualification,
      experience,
      address,
      landmark,
      pincode,
      city,
      gstNumber,
      referralCode,
      categories,
      categoryNames,
      // Bank Details
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      // KYC Status
      kycStatus,
      kycRemarks,
      // Payment Info
      registerAmount,
      payId,
      paidBy
    } = bodyData;
    
    let updatedPartner = await Partner.findById(id);
    if (!updatedPartner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found."
      });
    }

    // Update profile fields
    if (name) {
      updatedPartner.profile.name = name; 
    }
    if (email && updatedPartner.profile.email !== email.trim()) {
      // Check if email already exists
      const existingPartner = await Partner.findOne({ "profile.email": email.trim(), _id: { $ne: id } });
      if (existingPartner) {
        return res.status(400).json({
          success: false,
          message: "Email already exists."
        });
      }
      updatedPartner.profile.email = email.trim();
    }
    if (phone && updatedPartner.phone !== phone.trim()) {
      // Check if phone number already exists
      const existingPartner = await Partner.findOne({ "phone": phone.trim(), _id: { $ne: id } });
      if (existingPartner) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists."
        });
      }
      updatedPartner.phone = phone.trim();
    }
    if (whatsappNumber !== undefined) {
      updatedPartner.whatsappNumber = whatsappNumber.trim();
    }
    if (qualification !== undefined) {
      updatedPartner.qualification = qualification;
    }
    if (experience !== undefined) {
      updatedPartner.experience = experience ? parseInt(experience) : 0;
    }
    if (address !== undefined) {
      updatedPartner.profile.address = address;
    }
    if (landmark !== undefined) {
      updatedPartner.profile.landmark = landmark;
    }
    if (pincode !== undefined) {
      updatedPartner.profile.pincode = pincode;
    }
    if (city !== undefined) {
      updatedPartner.profile.city = city;
    }
    if (gstNumber !== undefined) {
      updatedPartner.profile.gstNumber = gstNumber;
      updatedPartner.gstNumber = gstNumber; // Also update top-level field
    }
    if (referralCode !== undefined) {
      updatedPartner.referralCode = referralCode;
    }
    
    // Handle profile image upload
    if (req.file) {
      // uploadFile2 is already imported at the top of the file from '../middleware/aws'
      const profileImageUrl = await uploadFile2(req.file, 'partnerdoc')
      if (profileImageUrl) {
        if (!updatedPartner.profile) {
          updatedPartner.profile = {}
        }
        updatedPartner.profile.profileImage = profileImageUrl
      }
    }
    
    // Update categories
    if (categories && Array.isArray(categories)) {
      updatedPartner.category = categories;
    }
    if (categoryNames && Array.isArray(categoryNames)) {
      updatedPartner.categoryNames = categoryNames;
    }
    
    // Update Bank Details
    if (!updatedPartner.bankDetails) {
      updatedPartner.bankDetails = {};
    }
    if (accountHolderName !== undefined) {
      updatedPartner.bankDetails.accountHolderName = accountHolderName;
    }
    if (accountNumber !== undefined) {
      updatedPartner.bankDetails.accountNumber = accountNumber;
    }
    if (ifscCode !== undefined) {
      updatedPartner.bankDetails.ifscCode = ifscCode;
    }
    if (bankName !== undefined) {
      updatedPartner.bankDetails.bankName = bankName;
    }
    
    // Update KYC Status
    if (!updatedPartner.kyc) {
      updatedPartner.kyc = {};
    }
    if (kycStatus !== undefined && kycStatus !== '') {
      updatedPartner.kyc.status = kycStatus;
    }
    if (kycRemarks !== undefined) {
      updatedPartner.kyc.remarks = kycRemarks;
    }
    
    // Update Payment Info
    if (registerAmount !== undefined && registerAmount !== '') {
      updatedPartner.registerAmount = parseFloat(registerAmount) || 0;
    }
    if (payId !== undefined) {
      updatedPartner.payId = payId;
    }
    if (paidBy !== undefined) {
      updatedPartner.paidBy = paidBy;
    }
    
    // Update Profile Completion Status
    if (bodyData.profileCompleted !== undefined) {
      updatedPartner.profileCompleted = bodyData.profileCompleted === true || bodyData.profileCompleted === 'true';
    }
    
    await updatedPartner.save();
    
    // Return a clean response without circular references
    const responseData = {
      success: true,
      message: "Partner profile updated successfully.",
      data: {
        _id: updatedPartner._id,
        name: updatedPartner.name,
        email: updatedPartner.email,
        phone: updatedPartner.phone
      }
    };
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error updating partner profile:", error);
    res.status(500).json({
      success: false,
      message: "Error updating partner profile",
      error: error.message
    });
  }
}


//get partner earnings 
// Fetch partner's transactions and earnings
exports.getPartnerEarnings = async (req, res) => {
    try {
        const { partnerId } = req.params;

        const partner = await Partner.findById(partnerId)
            .populate('mgPlan')
            .populate({
                path: 'mgPlanHistory.plan',
                select: 'name price leads commission leadFee minWalletBalance'
            })
            .lean();

        if (!partner) {
            return res.status(404).json({ message: "Partner not found." });
        }

        const bookings = await Booking.find({ partner: partnerId, status: "completed" })
            .populate("user", "name email phone")
            .populate("subService", "name price commission")
            .populate("service", "name")
            .populate("subCategory", "name")
            .populate("category", "name")
            .lean();

        let totalEarnings = 0;
        const transactions = bookings.map(booking => {
            const subService = booking.subService;
            const totalAmount = booking.amount || 0;
            const commissionAmount = ((subService?.commission || 0) / 100) * totalAmount;
            const partnerEarnings = totalAmount - commissionAmount;
            totalEarnings += partnerEarnings;

            return {
                bookingId: booking._id,
                user: booking.user,
                subService: subService?.name,
                service: booking.service?.name,
                subCategory: booking.subCategory?.name,
                category: booking.category?.name,
                totalAmount,
                commissionPercentage: subService?.commission || 0,
                commissionAmount,
                partnerEarnings,
                paymentMode: booking.paymentMode,
                status: booking.status,
                completedAt: booking.completedAt,
            };
        });

        const plan = partner.mgPlan;
        const leadsGuaranteed = plan?.leads || 0;
        const leadsUsed = partner.mgPlanLeadsUsed || 0;
        const leadsRemaining = Math.max(leadsGuaranteed - leadsUsed, 0);
        const leadFee = plan?.leadFee || 50;
        const minWalletBalance = plan?.minWalletBalance || 20;
        const now = new Date();
        const isExpired = partner.mgPlanExpiresAt ? now > partner.mgPlanExpiresAt : false;

        let refundStatus = 'pending';
        let paymentMethod = null;
        let collectedBy = null;
        let transactionId = null;
        const history = Array.isArray(partner.mgPlanHistory) ? partner.mgPlanHistory : [];
        if (history.length) {
            const latest = history[history.length - 1];
            refundStatus = latest?.refundStatus || refundStatus;
            paymentMethod = latest?.paymentMethod || null;
            collectedBy = latest?.collectedBy || null;
            transactionId = latest?.transactionId || null;
        }
        if (isExpired && leadsUsed < leadsGuaranteed && refundStatus !== 'processed') {
            refundStatus = 'eligible';
        }

        res.json({
            partner: {
                ...partner,
                mgPlanSummary: {
                    name: plan?.name || null,
                    price: plan?.price || 0,
                    commission: plan?.commission || 0,
                    leadFee,
                    minWalletBalance,
                    leadsGuaranteed,
                    leadsUsed,
                    leadsRemaining,
                    subscribedAt: partner.mgPlanSubscribedAt,
                    expiresAt: partner.mgPlanExpiresAt,
                    isExpired,
                    refundStatus,
                    paymentMethod,
                    collectedBy,
                    transactionId,
                    history
                }
            },
            totalEarnings,
            transactions
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPartnerServiceHubs = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const partner = await Partner.findById(partnerId).select('serviceHubs');
        if (!partner) {
            return res.status(404).json({ success: false, message: 'Partner not found' });
        }
        res.json({
            success: true,
            data: partner.serviceHubs || []
        });
    } catch (error) {
        console.error('Get Partner Service Hubs Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch service hubs', error: error.message });
    }
};

exports.createPartnerServiceHub = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const { name, pinCodes = [], services = [], isPrimary = false } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Hub name is required' });
        }

        const partner = await Partner.findById(partnerId);
        if (!partner) {
            return res.status(404).json({ success: false, message: 'Partner not found' });
        }

        const normalizedPins = Array.from(
            new Set(pinCodes.map((pin) => (pin || '').toString().trim()).filter((pin) => pin.length > 0))
        );

        if (!Array.isArray(partner.serviceHubs)) {
            partner.serviceHubs = [];
        }

        partner.serviceHubs.push({
            name,
            pinCodes: normalizedPins,
            services,
            isPrimary: Boolean(isPrimary),
            createdAt: new Date()
        });

        if (isPrimary) {
            partner.serviceHubs = partner.serviceHubs.map((hub, idx, arr) => ({
                ...hub,
                isPrimary: idx === arr.length - 1
            }));
        }

        await partner.save();

        res.status(201).json({
            success: true,
            message: 'Service hub created successfully',
            data: partner.serviceHubs
        });
    } catch (error) {
        console.error('Create Service Hub Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create service hub', error: error.message });
    }
};

exports.updatePartnerServiceHub = async (req, res) => {
    try {
        const { partnerId, hubId } = req.params;
        const { name, pinCodes = [], services = [], isPrimary } = req.body;

        const partner = await Partner.findById(partnerId);
        if (!partner) {
            return res.status(404).json({ success: false, message: 'Partner not found' });
        }

        const hub = partner.serviceHubs.id(hubId);
        if (!hub) {
            return res.status(404).json({ success: false, message: 'Service hub not found' });
        }

        if (name) hub.name = name;
        if (Array.isArray(pinCodes)) {
            hub.pinCodes = Array.from(
                new Set(pinCodes.map((pin) => (pin || '').toString().trim()).filter((pin) => pin.length > 0))
            );
        }
        if (Array.isArray(services)) {
            hub.services = services;
        }
        if (typeof isPrimary === 'boolean') {
            hub.isPrimary = isPrimary;
            if (isPrimary) {
                partner.serviceHubs.forEach((h) => {
                    if (h._id.toString() !== hubId) {
                        h.isPrimary = false;
                    }
                });
            }
        }
        hub.updatedAt = new Date();

        await partner.save();

        res.json({
            success: true,
            message: 'Service hub updated successfully',
            data: partner.serviceHubs
        });
    } catch (error) {
        console.error('Update Service Hub Error:', error);
        res.status(500).json({ success: false, message: 'Failed to update service hub', error: error.message });
    }
};

exports.deletePartnerServiceHub = async (req, res) => {
    try {
        const { partnerId, hubId } = req.params;

        const partner = await Partner.findById(partnerId);
        if (!partner) {
            return res.status(404).json({ success: false, message: 'Partner not found' });
        }

        const hub = partner.serviceHubs.id(hubId);
        if (!hub) {
            return res.status(404).json({ success: false, message: 'Service hub not found' });
        }

        // Use pull() method to remove the subdocument from the array
        partner.serviceHubs.pull(hubId);
        await partner.save();

        res.json({
            success: true,
            message: 'Service hub removed successfully',
            data: partner.serviceHubs
        });
    } catch (error) {
        console.error('Delete Service Hub Error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove service hub', error: error.message });
    }
};

// Get all available service hubs (for partner selection during onboarding)
exports.getAllAvailableServiceHubs = async (req, res) => {
    try {
        // Use the new Hub model to fetch all active hubs
        const Hub = require('../models/Hub');
        
        const hubs = await Hub.find({ status: 'active' })
            .select('name areas city state description')
            .lean();

        // Transform hubs to match the expected format for partner onboarding
        const formattedHubs = hubs.map(hub => {
            // Get all pin codes from all areas
            const allPinCodes = hub.areas.reduce((acc, area) => {
                return [...acc, ...(area.pinCodes || [])];
            }, []);
            
            // Remove duplicates
            const uniquePinCodes = [...new Set(allPinCodes)];

            return {
                _id: hub._id,
                name: hub.name,
                pinCodes: uniquePinCodes,
                areas: hub.areas.map(area => ({
                    _id: area._id,
                    areaName: area.areaName,
                    pinCodes: area.pinCodes || []
                })),
                city: hub.city,
                state: hub.state,
                description: hub.description,
                isPrimary: false, // Can be set based on partner's selection
                createdAt: hub.createdAt
            };
        });

        res.json({
            success: true,
            data: formattedHubs
        });
    } catch (error) {
        console.error('Get All Available Service Hubs Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch available service hubs', 
            error: error.message 
        });
    }
};


