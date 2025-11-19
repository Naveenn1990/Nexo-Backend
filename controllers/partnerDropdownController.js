const ServiceCategory = require('../models/ServiceCategory');
const Service = require('../models/Service');

// Get all categories with their services
exports.getAllCategories = async (req, res) => {
    try {
        // Get all categories
        const categories = await ServiceCategory.find({})
            .select('name description icon')
            .sort({ name: 1 });

        // Get all services with subCategory populated to access category
        const allServices = await Service.find({})
            .select('name description icon subCategory')
            .populate({
                path: 'subCategory',
                select: 'category name',
                populate: {
                    path: 'category',
                    select: '_id name'
                }
            })
            .sort({ name: 1 });

        // Group services by category
        const servicesByCategory = allServices.reduce((acc, service) => {
            // Get category from subCategory.category or skip if not available
            let categoryId = null;
            if (service.subCategory && service.subCategory.category) {
                categoryId = service.subCategory.category._id?.toString() || service.subCategory.category.toString();
            }
            
            if (!categoryId) {
                return acc; // Skip services without category
            }
            
            if (!acc[categoryId]) {
                acc[categoryId] = [];
            }
            acc[categoryId].push({
                id: service._id,
                name: service.name,
                description: service.description,
                icon: service.icon
            });
            return acc;
        }, {});

        // Format response with nested services
        const formattedCategories = categories.map(category => ({
            id: category._id,
            name: category.name,
            description: category.description,
            icon: category.icon,
            services: servicesByCategory[category._id.toString()] || []
        }));

        res.json({
            success: true,
            count: formattedCategories.length,
            categories: formattedCategories
        });

    } catch (error) {
        console.error("Get All Categories Error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching categories with services",
            error: error.message
        });
    }
};
