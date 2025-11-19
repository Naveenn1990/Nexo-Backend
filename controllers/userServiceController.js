const mongoose = require('mongoose');
const ServiceCategory = require("../models/ServiceCategory");
const Service = require("../models/Service");
const SubService = require("../models/SubService");
const SubCategory = require("../models/SubCategory");
const Booking = require("../models/booking");
const Partner = require("../models/PartnerModel");
const Product = require("../models/product");
const Review = require("../models/Review");
const Notification = require("../models/Notification");


// Helper function to get clean image filename
function getCleanImageName(imagePath) {
  if (!imagePath) return null;
  // If it's a full URL or path, extract just the filename
  if (imagePath.includes('/')) {
    return imagePath.split('/').pop();
  }
  return imagePath;
}

// Get complete service hierarchy (categories -> services -> subservices)
async function getServiceHierarchy(req, res) {
  try {
    // console.log("Starting to fetch service hierarchy...");

    // Get all active categories
    const categories = await ServiceCategory.find({ status: "active" }).lean();
    // console.log("Found categories:", categories.length);

    // First, let's check all services in the database
    const allServices = await Service.find({}).lean();
    // console.log("Total services in database:", allServices);

    // Process each category to include its services and subservices
    const hierarchyData = await Promise.all(categories.map(async (category) => {
      // console.log(`Processing category: ${category.name} (${category._id})`);

      // Get all active services for this category
      const services = await Service.find({
        category: category._id,
        isActive: true
      }).lean();

      // console.log(`Found ${services.length} services for category ${category.name}:`, services);

      // Get subservices for each service
      const servicesWithSubservices = await Promise.all(services.map(async (service) => {
        // console.log(`Processing service: ${service.name} (${service._id})`);

        const subServices = await SubService.find({
          service: service._id
        }).lean();

        // console.log(`Found ${subServices.length} subservices for service ${service.name}:`, subServices);

        // Format subservices
        const formattedSubServices = subServices.map(subService => ({
          _id: subService._id,
          name: subService.name,
          description: subService.description,
          icon: getCleanImageName(subService.icon),
          price: subService.price,
          duration: subService.duration,
          isActive: subService.isActive,
          minimumAmount: subService?.minimumAmount, // Default to 0 if not set
        }));

        // Return service with its subservices
        return {
          _id: service._id,
          name: service.name,
          description: service.description,
          icon: getCleanImageName(service.icon),
          basePrice: service.basePrice,
          duration: service.duration,
          isActive: service.isActive,
          subServices: formattedSubServices
        };
      }));

      // Return category with its services
      return {
        _id: category._id,
        name: category.name,
        description: category.description,
        icon: getCleanImageName(category.icon),
        services: servicesWithSubservices
      };
    }));

    return res.status(200).json({
      success: true,
      message: "Service hierarchy fetched successfully",
      data: hierarchyData
    });
  } catch (error) {
    console.error("Error in getServiceHierarchy:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching service hierarchy",
      error: error.message
    });
  }
}

const getCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true })
      .populate({
        path: 'subcategories',
        match: { isActive: true },
        populate: {
          path: 'services',
          match: { isActive: true },
          populate: {
            path: 'subservices',
            match: { isActive: true }
          }
        }
      });

    // console.log('Fetched Categories:', categories); // Log fetched categories

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error); // Log errors
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get services by category
async function getCategoryServices(req, res) {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const category = await ServiceCategory.findOne({
      _id: categoryId,
      status: "active",
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found or inactive",
      });
    }

    const services = await Service.find({
      category: categoryId,
      isActive: true,
    })
      .select("name description icon basePrice duration")
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    // Add clean image names to service icons
    const servicesWithCleanImages = services.map((service) => ({
      ...service,
      icon: getCleanImageName(service.icon)
    }));

    return res.status(200).json({
      success: true,
      message: "Services fetched successfully",
      data: servicesWithCleanImages,
    });
  } catch (error) {
    console.error("Error in getCategoryServices:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching services",
      error: error.message,
    });
  }
}

// Get service details with sub-services
async function getServiceDetails(req, res) {
  try {
    const { serviceId } = req.params;

    const service = await Service.findOne({
      _id: serviceId,
      isActive: true,
    })
      .populate("category", "name description")
      .lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found or inactive",
      });
    }

    // Get sub-services if any
    const subServices = await SubService.find({ service: serviceId })
      .select("name description icon price duration")
      .lean();

    // Add clean image name to icons
    service.icon = getCleanImageName(service.icon);
    const subServicesWithUrls = subServices.map((subService) => ({
      ...subService,
      icon: getCleanImageName(subService.icon),
    }));

    return res.status(200).json({
      success: true,
      data: {
        ...service,
        subServices: subServicesWithUrls,
      },
      message: "Service details fetched successfully",
    });
  } catch (error) {
    console.error("Error in getServiceDetails:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching service details",
      error: error.message,
    });
  }
}

// Search services
async function searchServices(req, res) {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const services = await Service.find({
      isActive: true,
      $or: [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ],
    })
      .populate("category", "name")
      .select("name description icon basePrice duration category")
      .lean();

    // Add clean image name to service icons
    const servicesWithUrls = services.map((service) => ({
      ...service,
      icon: getCleanImageName(service.icon),
    }));

    return res.status(200).json({
      success: true,
      data: servicesWithUrls,
      message: "Services searched successfully",
    });
  } catch (error) {
    console.error("Error in searchServices:", error);
    return res.status(500).json({
      success: false,
      message: "Error searching services",
      error: error.message,
    });
  }
}

// Get popular services
async function getPopularServices(req, res) {
  try {
    const PopularService = require("../models/PopularService");
    
    // Get popular services sorted by order and filtered by isActive
    const services = await PopularService.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .select("name slug icon order description price trusted")
      .lean();

    return res.status(200).json({
      success: true,
      data: services,
      message: "Popular services fetched successfully",
    });
  } catch (error) {
    console.error("Error in getPopularServices:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching popular services",
      error: error.message,
    });
  }
}

// Get service by slug
async function getServiceBySlug(req, res) {
  try {
    const PopularService = require("../models/PopularService");
    const Review = require("../models/Review");
    const SubService = require("../models/SubService");
    const Service = require("../models/Service");
    const { slug } = req.params;
    
    const service = await PopularService.findOne({ slug, isActive: true }).lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Try to find the actual Service model by name to get subservices
    let actualService = null;
    let subServices = [];
    
    try {
      // Find Service by name (case insensitive)
      actualService = await Service.findOne({
        name: { $regex: new RegExp(`^${service.name}$`, 'i') },
        isActive: true
      }).lean();

      if (actualService && actualService.subServices && actualService.subServices.length > 0) {
        // Fetch full subservices data
        subServices = await SubService.find({
          _id: { $in: actualService.subServices },
          isActive: true
        })
        .select('_id name description price basePrice discount gst icon includes excludes rating minimumAmount acceptCharges commission')
        .lean();

        // Format subservices with proper pricing and icon handling
        subServices = subServices.map(sub => {
          const finalPrice = sub.basePrice || (sub.price - (sub.price * (sub.discount || 0) / 100));
          // Handle icon array - use first icon if array, otherwise use as is
          const iconUrl = Array.isArray(sub.icon) && sub.icon.length > 0 
            ? sub.icon[0] 
            : (sub.icon || '');
          return {
            ...sub,
            icon: iconUrl,
            finalPrice: finalPrice,
            originalPrice: sub.price,
            discountAmount: sub.discount ? (sub.price * sub.discount / 100) : 0
          };
        });
      } else {
        // Fallback: Find subservices by name matching
        subServices = await SubService.find({
          name: { $regex: new RegExp(service.name, 'i') },
          isActive: true
        })
        .select('_id name description price basePrice discount gst icon includes excludes rating minimumAmount acceptCharges commission')
        .lean();

        subServices = subServices.map(sub => {
          const finalPrice = sub.basePrice || (sub.price - (sub.price * (sub.discount || 0) / 100));
          // Handle icon array - use first icon if array, otherwise use as is
          const iconUrl = Array.isArray(sub.icon) && sub.icon.length > 0 
            ? sub.icon[0] 
            : (sub.icon || '');
          return {
            ...sub,
            icon: iconUrl,
            finalPrice: finalPrice,
            originalPrice: sub.price,
            discountAmount: sub.discount ? (sub.price * sub.discount / 100) : 0
          };
        });
      }
    } catch (subServiceError) {
      console.error("Error fetching subservices:", subServiceError);
      subServices = [];
    }

    // Fetch reviews related to this service
    try {
      const subServiceIds = subServices.map(sub => sub._id);
      
      const reviews = await Review.find({
        subService: { $in: subServiceIds },
        status: 'approved'
      })
        .populate('user', 'name email')
        .populate('subService', 'name')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      // Calculate average rating
      const totalRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = reviews.length > 0
        ? (totalRatings / reviews.length).toFixed(1)
        : null;

      service.reviews = reviews;
      service.averageRating = averageRating;
      service.totalReviews = reviews.length;
    } catch (reviewError) {
      console.error("Error fetching reviews:", reviewError);
      service.reviews = [];
      service.averageRating = null;
      service.totalReviews = 0;
    }

    // Add subservices to service data
    service.subServices = subServices;

    return res.status(200).json({
      success: true,
      data: service,
      message: "Service fetched successfully",
    });
  } catch (error) {
    console.error("Error in getServiceBySlug:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching service",
      error: error.message,
    });
  }
}

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Get all services
 *     tags: [Services]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       price:
 *                         type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
// Get all services (debug endpoint)
async function getAllServices(req, res) {
  try {
    // Get all services regardless of status
    const services = await Service.find({})
      .populate('category')
      .lean();

    // console.log("All services:", services);

    return res.status(200).json({
      success: true,
      message: "All services fetched successfully",
      data: services.map(service => ({
        _id: service._id,
        name: service.name,
        description: service.description,
        icon: getCleanImageName(service.icon),
        basePrice: service.basePrice,
        duration: service.duration,
        isActive: service.isActive,
        minimumAmount: service.minimumAmount || 0, // Default to 0 if not set
        category: {
          _id: service.category?._id,
          name: service.category?.name,
        }
      }))
    });
  } catch (error) {
    console.error("Error in getAllServices:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching services",
      error: error.message
    });
  }
}

const getAllServicesForUser = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true }); // Fetch active services

    res.status(200).json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// const getAllSubCategories = async (req, res) => {
//   try {
//       const subcategories = await SubCategory.find({ isActive: true })
//           .populate('category'); // Populate the category field to get full details

//       res.status(200).json({
//           success: true,
//           data: subcategories
//       });
//   } catch (error) {
//       console.error('Error fetching subcategories:', error);
//       res.status(500).json({ success: false, message: error.message });
//   }
// };

const getAllSubCategories = async (req, res) => {
  // console.log("testttt")
  try {
    const subcategories = await SubCategory.find({ isActive: true })
      .populate('category')
      .populate({
        path: 'services',
        model: 'Service',
        populate: {
          path: 'subCategory',
          model: 'SubCategory'
        }
      })
      .populate({
        path: 'subservices',   // <-- Add this to fetch subservices
        model: 'SubService'
      });
    // console.log('Fetched Subcategories:', subcategories);
    // .populate({
    //   path: 'subservices',
    //   populate: {
    //       path: 'services', // SubService -> Service
    //       populate: {
    //           path: 'subCategory', // Service -> SubCategory
    //           populate: {
    //               path: 'category', // SubCategory -> ServiceCategory
    //            }
    //       }
    //   }
    // })
    res.status(200).json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};




const getAllSubCategoriesForUser = async (req, res) => {
  // console.log("subcategory")
  try {
    const subcategories = await SubCategory.find({ isActive: true }); // Fetch active subcategories

    res.status(200).json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// const getAllSubServices = async (req, res) => {
//     try {
//         const subservices = await SubService.find({ isActive: true }).populate('service');; // Fetch active subservices
//         console.log('Fetched Subservices:');
//         res.status(200).json({
//             success: true,
//             data: subservices
//         });
//     } catch (error) {
//         console.error('Error fetching subservices:', error);
//         res.status(500).json({ success: false, message: error.message });
//     }
// };
const getAllSubServices = async (req, res) => {
  try {
    const subservices = await SubService.find({ isActive: true })
      .populate({
        path: 'service',
        populate: {
          path: 'subCategory',
          populate: {
            path: 'category',
            model: 'ServiceCategory'
          }
        }
      });
    // Attach reviews and calculate average rating
    const enrichedSubservices = await Promise.all(
      subservices.map(async (subservice) => {
        const reviews = await Review.find({ subService: subservice._id, status: 'approved' })
          .populate('user', 'name email');

        const totalRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviews.length > 0
          ? (totalRatings / reviews.length).toFixed(1)
          : "No rating till now";

        return {
          ...subservice.toObject(),
          reviews,
          averageRating,
          discount: subservice.discount || 0,
          gst: subservice.gst || 0,
          commission: subservice.commission || 0,
          rating: subservice.rating || 0,
          minimumAmount: subservice.minimumAmount || 0, // Default to 0 if not set
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedSubservices
    });

  } catch (error) {
    console.error('Error fetching subservices:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};







const getAllSubServicesForUser = async (req, res) => {
  // console.log("hi")
  try {
    const subservices = await SubService.find({ isActive: true })
      .populate({ path: 'reviews' })

    res.status(200).json({
      success: true,
      data: subservices
    });
  } catch (error) {
    console.error('Error fetching subservices:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllCategoriesForUser = async (req, res) => {
  try {
    const categories = await ServiceCategory.find(); // Fetch active categories
    // console.log(categories)
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true }); // Fetch active categories

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all partners
const getAllPartners = async (req, res) => {
  try {
    // const temppartners = await Partner.find()
    // return res.json({
    //   temppartners 
    // });

    const { status, page = 1, limit = 100 } = req.query;

    const query = {};
    if (status) {
      query["kycDetails.isVerified"] = status === "verified";
    }

    const partners = await Partner.find(query)
      .select("-tempOTP")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Partner.countDocuments(query);

    res.json({
      partners,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get Partners Error:", error);
    res.status(500).json({ message: "Error fetching partners" });
  }
};

const getSubCategoryHierarchy = async (req, res) => {
  try {
    const subcategories = await SubCategory.find({ isActive: true })
      .populate({
        path: 'services',
        match: { isActive: true },
        populate: {
          path: 'subservices',
          match: { isActive: true }
        }
      });

    res.status(200).json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error('Error fetching subcategory hierarchy:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserSubCategoryHierarchy = async (req, res) => {
  try {
    const subcategories = await SubCategory.find({ isActive: true })
      .populate({
        path: 'services',
        match: { isActive: true },
        populate: {
          path: 'subservices',
          match: { isActive: true }
        }
      });

    res.status(200).json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error('Error fetching subcategory hierarchy for user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// Book subservice
const bookSubService = async (req, res) => {
  const { subServiceId, userId } = req.body; // Assuming these are passed in the request

  // Logic to find the subservice and create a booking
  const subService = await SubService.findById(subServiceId);
  if (!subService) {
    return res.status(404).json({ message: "Subservice not found." });
  }

  // Logic to create a booking
  const booking = new Booking({
    user: userId,
    subService: subServiceId,
    // other relevant booking details
  });

  await booking.save();
  return res.status(201).json({ message: "Booking created successfully", booking });
};

// View cart of partner 
const viewPartnerCart = async (req, res) => {
  try {
    const userId = req.user.id; // Authenticated user
    const { bookingId } = req.params;

    // console.log("Authenticated User ID:", userId);
    // console.log("Requested Booking ID:", bookingId);

    // Step 1: Verify if the booking exists and belongs to the user
    const booking = await Booking.findOne({ _id: bookingId, user: userId }).populate("cart.product");

    if (!booking) {
      return res.status(403).json({ message: "Unauthorized to view this cart" });
    }

    // Step 2: Return the cart items from the Booking schema
    return res.status(200).json({
      success: true,
      cart: booking.cart,
    });

  } catch (error) {
    console.error("Error fetching partner cart:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
//approve cart of partner
const approvePartnerCart = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id; // Authenticated User ID (Approving the cart)

    // Step 1: Validate Booking & Ownership
    const booking = await Booking.findOne({ _id: bookingId, user: userId }).populate("cart.product").populate("user");

    if (!booking) {
      return res.status(403).json({ message: "Unauthorized: This booking does not belong to you" });
    }

    // Step 2: Check if the booking has a cart
    if (!booking.cart || booking.cart.length === 0) {
      return res.status(400).json({ message: "No products in cart for this booking" });
    }

    // **New Check: If all cart items are already approved, return early**
    const isAlreadyApproved = booking.cart.every(item => item.approved);
    if (isAlreadyApproved) {
      return res.status(400).json({ message: "Cart is already approved" });
    }

    let updatedInventory = [];
    let usedProducts = [];
    let amount=0
    // Step 3: Deduct Stock from Inventory & Approve Cart
    for (const item of booking.cart) {
      if (item.approved) continue; // Skip already approved items

      const product = await Product.findById(item.product);
      if (!product) {
        item.approved = true;
        amount=amount+item.amount;
        continue;
      } else

        // Check stock availability
        if (product.stock < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for product: ${product.name}` });
        }

      // Deduct stock
      product.stock -= item.quantity;
       amount=amount+product.price;
      await product.save();

      // Collect product details for response
      usedProducts.push({
        productId: product._id,
        name: product.name,
        usedQuantity: item.quantity,
        usedAt: new Date(),
      });

      updatedInventory.push({
        productId: product._id,
        name: product.name,
        remainingStock: product.stock,
      });

      // Mark cart items as approved
      item.approved = true;
    }

    const notification = new Notification({
      title: 'Cart Approved',
      userId: booking.partner,
      message: `caurt approved by ${booking?.user?.name} amount ${amount}.`,
      createdAt: new Date(),
      read: false,
    });
    await notification.save();

    // Step 4: Save Approved Cart Permanently
    if(amount){
      booking.amount=booking.amount+amount;
    }
    booking.savedCart = booking.cart; // Save the cart permanently
    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Products approved, inventory updated, and cart saved permanently",
      usedProducts: usedProducts,
      updatedInventory: updatedInventory,
      savedCart: booking.savedCart,
    });
  } catch (error) {
    console.error("Error approving cart:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


//get all completed booking in system 
const getAllCompletedBookingsinsystem = async (req, res) => {
  try {
    const completedBookings = await Booking.find({ status: "completed" })
      .populate("user", "name email")
      .populate("subService", "name description")
      .populate("service", "name")
      .populate("partner", "profile.name profile.email")
      .sort({ completedAt: -1 }); // Sort by latest completed

    const totalBookingsCount = await Booking.countDocuments(); // Count all bookings in the system

    if (completedBookings.length === 0) {
      return res.status(404).json({ success: false, message: "No completed bookings found." });
    }

    res.status(200).json({
      success: true,
      count: completedBookings.length,
      totalBookings: totalBookingsCount,
      data: completedBookings,
    });
  } catch (error) {
    console.error("Error fetching completed bookings:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};





module.exports = {
  getCategories,
  getCategoryServices,
  getServiceDetails,
  searchServices,
  getPopularServices,
  getServiceBySlug,
  getServiceHierarchy,
  getAllServices,
  getAllServicesForUser,
  getAllSubCategories,
  getAllSubCategoriesForUser,
  getAllSubServices,
  getAllSubServicesForUser,
  getAllCategoriesForUser,
  getAllCategories,
  getSubCategoryHierarchy,
  getUserSubCategoryHierarchy,
  getAllPartners,
  viewPartnerCart,
  bookSubService,
  approvePartnerCart,
  getAllCompletedBookingsinsystem
};
