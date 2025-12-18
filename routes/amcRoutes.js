const express = require('express');
const router = express.Router();
const amcPlanController = require('../controllers/amcPlanController');

// Public routes (no authentication required)
router.get('/amc-plans', amcPlanController.getAllPlans);
router.get('/amc-plans/:planId', amcPlanController.getPlanById);

module.exports = router;