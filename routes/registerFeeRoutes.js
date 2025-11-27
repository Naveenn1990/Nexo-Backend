const registerFeeController = require("../controllers/registerFeeController");
const feeManagementController = require("../controllers/feeManagementController");
const express = require('express');
const router = express.Router();

// Public fees endpoint for partner onboarding (same as admin but no auth required)
router.get("/fees", feeManagementController.getFees);

router.post("/updatePricingSettings", registerFeeController.updatePricingSettings);

router.get("/getPricingSettings", registerFeeController.getPricingSettings);
router.get("/getPricingHistory", registerFeeController.getPricingHistory);
router.get("/getPricingMetrics",registerFeeController.getPricingMetrics);

router.get("/getFeatures",registerFeeController.getFeatures);
router.get("/getActiveFeatures",registerFeeController.getActiveFeatures);
router.get("/getActiveFeatures",registerFeeController.getActiveFeatures);
router.post("/createFeature", registerFeeController.createFeature);
router.put("/updateFeature/:id", registerFeeController.updateFeature);
router.delete("/deleteFeature/:id",registerFeeController.deleteFeature);
router.post("/reorderFeatures", registerFeeController.reorderFeatures);
router.get("/toggleFeatureStatus/:id",registerFeeController.toggleFeatureStatus);

router.get("/getHelpContent",registerFeeController.getHelpContent);
router.get("/getActiveHelpContent/:category",registerFeeController.getActiveHelpContent);
router.get("/toggleHelpStatus/:id",registerFeeController.toggleHelpStatus);
router.post("/createHelpContent", registerFeeController.createHelpContent);
router.put("/updateHelpContent/:id", registerFeeController.updateHelpContent);
router.delete("/deleteHelpContent/:id",registerFeeController.deleteHelpContent);
router.get("/getHelpCategories", registerFeeController.getHelpCategories);
router.get("/searchHelpContent",registerFeeController.searchHelpContent);

module.exports = router;