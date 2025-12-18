const dashboardService = require("../services/userDashboardService");

/**
 * User Dashboard Controller
 * Handles all dashboard-related requests
 */

/**
 * Get enhanced dashboard with all metrics
 */
exports.getEnhancedDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const dashboard = await dashboardService.getEnhancedDashboard(userId);
    
    res.json(dashboard);
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/**
 * Get quick stats only
 */
exports.getQuickStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const stats = await dashboardService.getQuickStats(userId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error("Quick Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quick stats"
    });
  }
};

/**
 * Get smart alerts
 */
exports.getSmartAlerts = async (req, res) => {
  try {
    const userId = req.user._id;
    const alerts = await dashboardService.getSmartAlerts(userId);
    
    res.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error("Smart Alerts Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts"
    });
  }
};

/**
 * Get activity streak
 */
exports.getActivityStreak = async (req, res) => {
  try {
    const userId = req.user._id;
    const streak = await dashboardService.getActivityStreak(userId);
    
    res.json({
      success: true,
      streak
    });
  } catch (error) {
    console.error("Activity Streak Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch activity streak"
    });
  }
};

/**
 * Get time-sensitive suggestions
 */
exports.getSuggestions = async (req, res) => {
  try {
    const userId = req.user._id;
    const suggestions = await dashboardService.getTimeSensitiveSuggestions(userId);
    
    res.json({
      success: true,
      suggestions,
      count: suggestions.length
    });
  } catch (error) {
    console.error("Suggestions Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch suggestions"
    });
  }
};

/**
 * Get recent activity feed
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 15;
    const activity = await dashboardService.getRecentActivity(userId);
    
    res.json({
      success: true,
      activity: activity.slice(0, limit),
      total: activity.length
    });
  } catch (error) {
    console.error("Recent Activity Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent activity"
    });
  }
};

/**
 * Get booking statistics
 */
exports.getBookingStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const stats = await dashboardService.getBookingStatistics(userId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error("Booking Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking statistics"
    });
  }
};

/**
 * Get wallet summary
 */
exports.getWalletSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const wallet = await dashboardService.getWalletSummary(userId);
    
    res.json({
      success: true,
      wallet
    });
  } catch (error) {
    console.error("Wallet Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet summary"
    });
  }
};

/**
 * Get time-based insights
 */
exports.getInsights = async (req, res) => {
  try {
    const userId = req.user._id;
    const insights = await dashboardService.getTimeBasedInsights(userId);
    
    res.json({
      success: true,
      insights
    });
  } catch (error) {
    console.error("Insights Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch insights"
    });
  }
};

/**
 * Get personalized recommendations
 */
exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;
    const recommendations = await dashboardService.getPersonalizedRecommendations(userId);
    
    res.json({
      success: true,
      recommendations,
      count: recommendations.length
    });
  } catch (error) {
    console.error("Recommendations Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recommendations"
    });
  }
};

/**
 * Get time-based greeting
 */
exports.getGreeting = async (req, res) => {
  try {
    const greeting = dashboardService.getTimeBasedGreeting();
    
    res.json({
      success: true,
      greeting
    });
  } catch (error) {
    console.error("Greeting Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch greeting"
    });
  }
};
