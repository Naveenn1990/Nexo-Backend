const express = require('express');
const router = express.Router();
const serviceHierarchyController = require('../controllers/serviceHierarchyController');
const leadController = require('../controllers/leadController');
const subscriptionPlanController = require('../controllers/subscriptionPlanController');
const featuredReviewController = require('../controllers/featuredReviewController');
const materialCategoryController = require('../controllers/materialCategoryController');

// Get complete service hierarchy
router.get('/service-hierarchy', serviceHierarchyController.getServiceHierarchy);

// Submit service enquiry (public endpoint)
router.post('/submit-service-enquiry', leadController.submitServiceEnquiry);

// Get subscription plans (public endpoint for home page)
router.get('/subscription-plans', subscriptionPlanController.getAllPlans);

// Get featured reviews (public endpoint for home page)
router.get('/featured-reviews', featuredReviewController.getAllReviews);

// Get material categories (public endpoint for material store page)
router.get('/material-categories', materialCategoryController.getActiveMaterialCategories);

module.exports = router;
