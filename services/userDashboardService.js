const User = require("../models/User");
const Booking = require("../models/booking");
const Wallet = require("../models/Wallet");
const SubService = require("../models/SubService");
const Partner = require("../models/PartnerModel");

/**
 * Enhanced User Dashboard Service
 * Provides comprehensive dashboard analytics with time-based insights
 */

class UserDashboardService {
  /**
   * Get comprehensive dashboard data for user
   * @param {String} userId - User ID
   * @returns {Object} Dashboard data with analytics
   */
  async getDashboardData(userId) {
    try {
      const [
        userProfile,
        bookingStats,
        walletInfo,
        recentActivity,
        timeBasedInsights,
        recommendations
      ] = await Promise.all([
        this.getUserProfile(userId),
        this.getBookingStatistics(userId),
        this.getWalletSummary(userId),
        this.getRecentActivity(userId),
        this.getTimeBasedInsights(userId),
        this.getPersonalizedRecommendations(userId)
      ]);

      return {
        success: true,
        data: {
          profile: userProfile,
          bookings: bookingStats,
          wallet: walletInfo,
          recentActivity,
          insights: timeBasedInsights,
          recommendations,
          lastUpdated: new Date()
        }
      };
    } catch (error) {
      console.error("Dashboard Service Error:", error);
      throw error;
    }
  }

  /**
   * Get user profile with completion status
   */
  async getUserProfile(userId) {
    const user = await User.findById(userId)
      .select("-password -tempOTP -tempOTPExpiry")
      .lean();

    if (!user) {
      throw new Error("User not found");
    }

    // Calculate profile completion percentage
    const completionFields = {
      name: !!user.name,
      email: !!user.email,
      phone: !!user.phone,
      profilePicture: !!user.profilePicture,
      addresses: user.addresses && user.addresses.length > 0
    };

    const completedFields = Object.values(completionFields).filter(Boolean).length;
    const completionPercentage = Math.round((completedFields / Object.keys(completionFields).length) * 100);

    return {
      ...user,
      profileCompletion: {
        percentage: completionPercentage,
        missingFields: Object.keys(completionFields).filter(key => !completionFields[key])
      },
      memberSince: this.getTimeSinceMember(user.createdAt),
      lastActive: this.getRelativeTime(user.lastLogin || user.createdAt)
    };
  }

  /**
   * Get booking statistics with time-based analysis
   */
  async getBookingStatistics(userId) {
    const now = new Date();
    const bookings = await Booking.find({ userId })
      .populate("serviceId")
      .populate("subServiceId")
      .sort({ createdAt: -1 })
      .lean();

    // Time periods
    const today = new Date(now.setHours(0, 0, 0, 0));
    const thisWeekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Categorize bookings
    const stats = {
      total: bookings.length,
      byStatus: this.groupByStatus(bookings),
      byTimePeriod: {
        today: bookings.filter(b => new Date(b.createdAt) >= today).length,
        thisWeek: bookings.filter(b => new Date(b.createdAt) >= thisWeekStart).length,
        thisMonth: bookings.filter(b => new Date(b.createdAt) >= thisMonthStart).length,
        lastMonth: bookings.filter(b => 
          new Date(b.createdAt) >= lastMonthStart && 
          new Date(b.createdAt) <= lastMonthEnd
        ).length
      },
      upcoming: bookings.filter(b => 
        b.status === "Accepted" && 
        new Date(b.scheduledDate) > new Date()
      ).length,
      completed: bookings.filter(b => b.status === "Completed").length,
      totalSpent: this.calculateTotalSpent(bookings),
      averageBookingValue: this.calculateAverageValue(bookings),
      mostBookedService: await this.getMostBookedService(bookings),
      bookingTrend: this.calculateBookingTrend(bookings)
    };

    return stats;
  }

  /**
   * Get wallet summary with transaction insights
   */
  async getWalletSummary(userId) {
    const wallet = await Wallet.findOne({ userId }).lean();

    if (!wallet) {
      return {
        balance: 0,
        transactions: [],
        summary: {
          totalCredits: 0,
          totalDebits: 0,
          recentActivity: []
        }
      };
    }

    const recentTransactions = wallet.transactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const totalCredits = wallet.transactions
      .filter(t => t.type === "Credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = wallet.transactions
      .filter(t => t.type === "Debit")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      balance: wallet.balance,
      totalCredits,
      totalDebits,
      transactionCount: wallet.transactions.length,
      recentTransactions: recentTransactions.map(t => ({
        ...t,
        timeAgo: this.getRelativeTime(t.createdAt)
      })),
      savingsThisMonth: this.calculateMonthlySavings(wallet.transactions)
    };
  }

  /**
   * Get recent activity feed
   */
  async getRecentActivity(userId) {
    const bookings = await Booking.find({ userId })
      .populate("serviceId")
      .populate("partnerId", "businessName")
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    const wallet = await Wallet.findOne({ userId }).lean();
    const recentWalletActivity = wallet?.transactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5) || [];

    // Combine and sort activities
    const activities = [
      ...bookings.map(b => ({
        type: "booking",
        action: this.getBookingAction(b.status),
        description: `${b.serviceId?.name || "Service"} - ${b.status}`,
        timestamp: b.updatedAt,
        timeAgo: this.getRelativeTime(b.updatedAt),
        icon: this.getBookingIcon(b.status),
        color: this.getStatusColor(b.status)
      })),
      ...recentWalletActivity.map(t => ({
        type: "wallet",
        action: t.type === "Credit" ? "Money Added" : "Money Used",
        description: t.description,
        amount: t.amount,
        timestamp: t.createdAt,
        timeAgo: this.getRelativeTime(t.createdAt),
        icon: t.type === "Credit" ? "💰" : "💸",
        color: t.type === "Credit" ? "green" : "orange"
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, 15);

    return activities;
  }

  /**
   * Get time-based insights and patterns
   */
  async getTimeBasedInsights(userId) {
    const bookings = await Booking.find({ userId }).lean();
    const wallet = await Wallet.findOne({ userId }).lean();

    const insights = {
      bookingPatterns: this.analyzeBookingPatterns(bookings),
      spendingHabits: this.analyzeSpendingHabits(bookings, wallet),
      peakBookingTimes: this.analyzePeakTimes(bookings),
      seasonalTrends: this.analyzeSeasonalTrends(bookings),
      milestones: this.calculateMilestones(bookings, wallet)
    };

    return insights;
  }

  /**
   * Get personalized recommendations
   */
  async getPersonalizedRecommendations(userId) {
    const bookings = await Booking.find({ userId })
      .populate("serviceId")
      .populate("subServiceId")
      .lean();

    const recommendations = [];

    // Service recommendations based on history
    const serviceFrequency = this.calculateServiceFrequency(bookings);
    if (serviceFrequency.length > 0) {
      recommendations.push({
        type: "service",
        title: "Book Your Favorite Service Again",
        description: `You've used ${serviceFrequency[0].name} ${serviceFrequency[0].count} times`,
        action: "Book Now",
        priority: "high"
      });
    }

    // Wallet top-up recommendation
    const wallet = await Wallet.findOne({ userId }).lean();
    if (wallet && wallet.balance < 100) {
      recommendations.push({
        type: "wallet",
        title: "Low Wallet Balance",
        description: "Add money to your wallet for faster bookings",
        action: "Add Money",
        priority: "medium"
      });
    }

    // Profile completion
    const user = await User.findById(userId).lean();
    if (!user.profilePicture || !user.addresses || user.addresses.length === 0) {
      recommendations.push({
        type: "profile",
        title: "Complete Your Profile",
        description: "Add profile picture and address for better experience",
        action: "Update Profile",
        priority: "low"
      });
    }

    return recommendations;
  }

  // Helper Methods

  groupByStatus(bookings) {
    return bookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});
  }

  calculateTotalSpent(bookings) {
    return bookings
      .filter(b => b.status === "Completed")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  }

  calculateAverageValue(bookings) {
    const completed = bookings.filter(b => b.status === "Completed");
    if (completed.length === 0) return 0;
    return Math.round(this.calculateTotalSpent(bookings) / completed.length);
  }

  async getMostBookedService(bookings) {
    const serviceCount = {};
    bookings.forEach(b => {
      if (b.serviceId) {
        const serviceId = b.serviceId._id || b.serviceId;
        serviceCount[serviceId] = (serviceCount[serviceId] || 0) + 1;
      }
    });

    const mostBooked = Object.entries(serviceCount)
      .sort(([, a], [, b]) => b - a)[0];

    if (!mostBooked) return null;

    const service = bookings.find(b => 
      (b.serviceId._id || b.serviceId).toString() === mostBooked[0]
    )?.serviceId;

    return {
      name: service?.name || "Unknown",
      count: mostBooked[1]
    };
  }

  calculateBookingTrend(bookings) {
    const now = new Date();
    const thisMonth = bookings.filter(b => 
      new Date(b.createdAt).getMonth() === now.getMonth()
    ).length;
    const lastMonth = bookings.filter(b => 
      new Date(b.createdAt).getMonth() === now.getMonth() - 1
    ).length;

    if (lastMonth === 0) return { trend: "new", change: 0 };

    const change = ((thisMonth - lastMonth) / lastMonth) * 100;
    return {
      trend: change > 0 ? "up" : change < 0 ? "down" : "stable",
      change: Math.abs(Math.round(change))
    };
  }

  calculateMonthlySavings(transactions) {
    const now = new Date();
    const thisMonth = transactions.filter(t => 
      new Date(t.createdAt).getMonth() === now.getMonth() &&
      t.type === "Credit"
    ).reduce((sum, t) => sum + t.amount, 0);

    return thisMonth;
  }

  analyzeBookingPatterns(bookings) {
    const dayOfWeek = {};
    const hourOfDay = {};

    bookings.forEach(b => {
      const date = new Date(b.createdAt);
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });
      const hour = date.getHours();

      dayOfWeek[day] = (dayOfWeek[day] || 0) + 1;
      hourOfDay[hour] = (hourOfDay[hour] || 0) + 1;
    });

    const preferredDay = Object.entries(dayOfWeek)
      .sort(([, a], [, b]) => b - a)[0];
    const preferredHour = Object.entries(hourOfDay)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      preferredDay: preferredDay ? preferredDay[0] : null,
      preferredTime: preferredHour ? this.formatHour(parseInt(preferredHour[0])) : null,
      totalBookings: bookings.length
    };
  }

  analyzeSpendingHabits(bookings, wallet) {
    const completedBookings = bookings.filter(b => b.status === "Completed");
    const totalSpent = this.calculateTotalSpent(bookings);
    const avgPerBooking = completedBookings.length > 0 
      ? totalSpent / completedBookings.length 
      : 0;

    return {
      totalSpent,
      averagePerBooking: Math.round(avgPerBooking),
      walletUsage: wallet?.transactions.filter(t => t.type === "Debit").length || 0,
      savingsRate: wallet ? Math.round((wallet.balance / (totalSpent || 1)) * 100) : 0
    };
  }

  analyzePeakTimes(bookings) {
    const timeSlots = {
      morning: 0,    // 6-12
      afternoon: 0,  // 12-17
      evening: 0,    // 17-21
      night: 0       // 21-6
    };

    bookings.forEach(b => {
      const hour = new Date(b.createdAt).getHours();
      if (hour >= 6 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
      else if (hour >= 17 && hour < 21) timeSlots.evening++;
      else timeSlots.night++;
    });

    const peak = Object.entries(timeSlots)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      peakTime: peak ? peak[0] : null,
      distribution: timeSlots
    };
  }

  analyzeSeasonalTrends(bookings) {
    const seasons = {
      spring: 0,  // Mar-May
      summer: 0,  // Jun-Aug
      autumn: 0,  // Sep-Nov
      winter: 0   // Dec-Feb
    };

    bookings.forEach(b => {
      const month = new Date(b.createdAt).getMonth();
      if (month >= 2 && month <= 4) seasons.spring++;
      else if (month >= 5 && month <= 7) seasons.summer++;
      else if (month >= 8 && month <= 10) seasons.autumn++;
      else seasons.winter++;
    });

    return seasons;
  }

  calculateMilestones(bookings, wallet) {
    const milestones = [];

    // Booking milestones
    const bookingCount = bookings.length;
    const milestoneNumbers = [1, 5, 10, 25, 50, 100];
    const nextMilestone = milestoneNumbers.find(n => n > bookingCount) || bookingCount + 50;

    milestones.push({
      type: "bookings",
      current: bookingCount,
      next: nextMilestone,
      progress: Math.round((bookingCount / nextMilestone) * 100),
      message: `${nextMilestone - bookingCount} bookings to next milestone`
    });

    // Spending milestones
    const totalSpent = this.calculateTotalSpent(bookings);
    const spendingMilestones = [1000, 5000, 10000, 25000, 50000];
    const nextSpending = spendingMilestones.find(n => n > totalSpent) || totalSpent + 10000;

    milestones.push({
      type: "spending",
      current: totalSpent,
      next: nextSpending,
      progress: Math.round((totalSpent / nextSpending) * 100),
      message: `₹${nextSpending - totalSpent} to next spending milestone`
    });

    return milestones;
  }

  calculateServiceFrequency(bookings) {
    const frequency = {};
    
    bookings.forEach(b => {
      if (b.serviceId) {
        const serviceName = b.serviceId.name || "Unknown";
        frequency[serviceName] = (frequency[serviceName] || 0) + 1;
      }
    });

    return Object.entries(frequency)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  getBookingAction(status) {
    const actions = {
      "Pending": "Booking Requested",
      "Accepted": "Booking Confirmed",
      "Completed": "Service Completed",
      "Cancelled": "Booking Cancelled",
      "Rejected": "Booking Declined"
    };
    return actions[status] || status;
  }

  getBookingIcon(status) {
    const icons = {
      "Pending": "⏳",
      "Accepted": "✅",
      "Completed": "🎉",
      "Cancelled": "❌",
      "Rejected": "⛔"
    };
    return icons[status] || "📋";
  }

  getStatusColor(status) {
    const colors = {
      "Pending": "yellow",
      "Accepted": "blue",
      "Completed": "green",
      "Cancelled": "red",
      "Rejected": "gray"
    };
    return colors[status] || "gray";
  }

  getRelativeTime(date) {
    if (!date) return "Never";
    
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
    if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    
    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
  }

  getTimeSinceMember(date) {
    const now = new Date();
    const joined = new Date(date);
    const diffMs = now - joined;
    const diffDays = Math.floor(diffMs / 86400000);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffMonths / 12);

    if (diffYears > 0) return `${diffYears} ${diffYears === 1 ? 'year' : 'years'}`;
    if (diffMonths > 0) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'}`;
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
  }

  formatHour(hour) {
    if (hour < 12) return `${hour === 0 ? 12 : hour}:00 AM`;
    if (hour === 12) return "12:00 PM";
    return `${hour - 12}:00 PM`;
  }

  /**
   * Get greeting based on time of day
   */
  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 5) return { greeting: "Still awake?", emoji: "🌙", mood: "late-night" };
    if (hour < 12) return { greeting: "Good morning", emoji: "☀️", mood: "morning" };
    if (hour < 17) return { greeting: "Good afternoon", emoji: "🌤️", mood: "afternoon" };
    if (hour < 21) return { greeting: "Good evening", emoji: "🌆", mood: "evening" };
    return { greeting: "Good night", emoji: "🌃", mood: "night" };
  }

  /**
   * Get motivational insights based on user activity
   */
  getMotivationalInsights(bookings, wallet) {
    const insights = [];
    const completedCount = bookings.filter(b => b.status === "completed").length;
    const totalSpent = this.calculateTotalSpent(bookings);

    // Activity-based insights
    if (completedCount === 0) {
      insights.push({
        type: "welcome",
        message: "Ready to book your first service?",
        icon: "🚀",
        action: "Explore Services"
      });
    } else if (completedCount >= 10) {
      insights.push({
        type: "achievement",
        message: `Amazing! You've completed ${completedCount} bookings`,
        icon: "🏆",
        badge: "Loyal Customer"
      });
    }

    // Wallet insights
    if (wallet && wallet.balance > 1000) {
      insights.push({
        type: "wallet",
        message: `You have ₹${wallet.balance} ready to use`,
        icon: "💎",
        action: "Use Wallet"
      });
    }

    // Spending insights
    if (totalSpent > 5000) {
      insights.push({
        type: "savings",
        message: `You've invested ₹${totalSpent} in quality services`,
        icon: "💰",
        badge: "Smart Spender"
      });
    }

    return insights;
  }

  /**
   * Get activity streak information
   */
  async getActivityStreak(userId) {
    const bookings = await Booking.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    if (bookings.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivity: null,
        message: "Start your booking journey today!"
      };
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;
    let lastDate = new Date(bookings[0].createdAt);

    // Calculate streaks (bookings within 30 days)
    for (let i = 1; i < bookings.length; i++) {
      const currentDate = new Date(bookings[i].createdAt);
      const daysDiff = Math.floor((lastDate - currentDate) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 30) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
      lastDate = currentDate;
    }

    longestStreak = Math.max(longestStreak, tempStreak);
    
    // Check if current streak is active (last booking within 30 days)
    const daysSinceLastBooking = Math.floor((new Date() - new Date(bookings[0].createdAt)) / (1000 * 60 * 60 * 24));
    currentStreak = daysSinceLastBooking <= 30 ? tempStreak : 0;

    return {
      currentStreak,
      longestStreak,
      lastActivity: this.getRelativeTime(bookings[0].createdAt),
      daysUntilStreakBreak: currentStreak > 0 ? 30 - daysSinceLastBooking : 0,
      message: currentStreak > 0 
        ? `${currentStreak} booking streak! Keep it going!` 
        : "Start a new booking streak today!"
    };
  }

  /**
   * Get quick stats for dashboard cards
   */
  async getQuickStats(userId) {
    const [bookings, wallet, user] = await Promise.all([
      Booking.find({ user: userId }).lean(),
      Wallet.findOne({ userId }).lean(),
      User.findById(userId).lean()
    ]);

    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      totalBookings: bookings.length,
      activeBookings: bookings.filter(b => 
        ["pending", "accepted", "in_progress"].includes(b.status)
      ).length,
      completedBookings: bookings.filter(b => b.status === "completed").length,
      weeklyBookings: bookings.filter(b => 
        new Date(b.createdAt) >= startOfWeek
      ).length,
      monthlyBookings: bookings.filter(b => 
        new Date(b.createdAt) >= startOfMonth
      ).length,
      walletBalance: wallet?.balance || 0,
      totalSpent: this.calculateTotalSpent(bookings),
      referralCount: user?.referredUsers?.length || 0,
      referralCode: user?.referalCode || null,
      memberSince: user?.createdAt,
      lastBooking: bookings.length > 0 ? bookings[0].createdAt : null
    };
  }

  /**
   * Get time-sensitive notifications and alerts
   */
  async getSmartAlerts(userId) {
    const alerts = [];
    const bookings = await Booking.find({ user: userId })
      .populate("subService")
      .lean();
    const wallet = await Wallet.findOne({ userId }).lean();

    // Upcoming booking alerts
    const upcomingBookings = bookings.filter(b => {
      if (!b.scheduledDate) return false;
      const scheduledDate = new Date(b.scheduledDate);
      const hoursUntil = (scheduledDate - new Date()) / (1000 * 60 * 60);
      return hoursUntil > 0 && hoursUntil <= 24 && b.status === "accepted";
    });

    upcomingBookings.forEach(booking => {
      const hoursUntil = Math.floor((new Date(booking.scheduledDate) - new Date()) / (1000 * 60 * 60));
      alerts.push({
        type: "upcoming",
        priority: hoursUntil <= 2 ? "high" : "medium",
        title: "Upcoming Service",
        message: `Your ${booking.subService?.name || "service"} is scheduled in ${hoursUntil} ${hoursUntil === 1 ? 'hour' : 'hours'}`,
        icon: "⏰",
        time: this.getRelativeTime(booking.scheduledDate),
        action: "View Details",
        bookingId: booking._id
      });
    });

    // Low wallet balance alert
    if (wallet && wallet.balance < 100 && wallet.balance > 0) {
      alerts.push({
        type: "wallet",
        priority: "low",
        title: "Low Wallet Balance",
        message: `Only ₹${wallet.balance} left in your wallet`,
        icon: "💳",
        action: "Add Money"
      });
    }

    // Pending review alerts
    const completedWithoutReview = bookings.filter(b => 
      b.status === "completed" && !b.review
    );

    if (completedWithoutReview.length > 0) {
      alerts.push({
        type: "review",
        priority: "low",
        title: "Share Your Experience",
        message: `${completedWithoutReview.length} ${completedWithoutReview.length === 1 ? 'service' : 'services'} waiting for your review`,
        icon: "⭐",
        action: "Write Review"
      });
    }

    // Inactive user alert
    const lastBooking = bookings.length > 0 ? bookings[0].createdAt : null;
    if (lastBooking) {
      const daysSinceLastBooking = Math.floor((new Date() - new Date(lastBooking)) / (1000 * 60 * 60 * 24));
      if (daysSinceLastBooking > 60) {
        alerts.push({
          type: "engagement",
          priority: "low",
          title: "We Miss You!",
          message: `It's been ${daysSinceLastBooking} days since your last booking`,
          icon: "👋",
          action: "Browse Services"
        });
      }
    }

    return alerts.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get personalized service suggestions based on time and history
   */
  async getTimeSensitiveSuggestions(userId) {
    const bookings = await Booking.find({ user: userId })
      .populate("subService")
      .lean();
    
    const suggestions = [];
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const month = new Date().getMonth();

    // Time-based suggestions
    if (hour >= 6 && hour < 10) {
      suggestions.push({
        title: "Morning Essentials",
        description: "Start your day right with breakfast delivery or morning cleaning",
        icon: "🌅",
        timeRelevant: true
      });
    } else if (hour >= 17 && hour < 21) {
      suggestions.push({
        title: "Evening Services",
        description: "Dinner delivery, home cleaning, or relaxation services",
        icon: "🌆",
        timeRelevant: true
      });
    }

    // Weekend suggestions
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      suggestions.push({
        title: "Weekend Specials",
        description: "Deep cleaning, home maintenance, or leisure activities",
        icon: "🎉",
        timeRelevant: true
      });
    }

    // Seasonal suggestions
    if (month >= 2 && month <= 4) {
      suggestions.push({
        title: "Spring Cleaning",
        description: "Perfect time for deep cleaning and home organization",
        icon: "🌸",
        seasonal: true
      });
    } else if (month >= 5 && month <= 7) {
      suggestions.push({
        title: "Summer Services",
        description: "AC maintenance, pest control, and cooling solutions",
        icon: "☀️",
        seasonal: true
      });
    }

    // History-based suggestions
    const serviceFrequency = this.calculateServiceFrequency(bookings);
    if (serviceFrequency.length > 0) {
      const topService = serviceFrequency[0];
      const lastBooking = bookings.find(b => 
        b.subService?.name === topService.name
      );
      
      if (lastBooking) {
        const daysSinceLastBooking = Math.floor(
          (new Date() - new Date(lastBooking.createdAt)) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceLastBooking > 30) {
          suggestions.push({
            title: `Time for ${topService.name}?`,
            description: `You last booked this ${daysSinceLastBooking} days ago`,
            icon: "🔄",
            historyBased: true
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Get comprehensive dashboard overview
   */
  async getEnhancedDashboard(userId) {
    try {
      const [
        quickStats,
        greeting,
        alerts,
        streak,
        suggestions,
        recentActivity,
        insights
      ] = await Promise.all([
        this.getQuickStats(userId),
        Promise.resolve(this.getTimeBasedGreeting()),
        this.getSmartAlerts(userId),
        this.getActivityStreak(userId),
        this.getTimeSensitiveSuggestions(userId),
        this.getRecentActivity(userId),
        this.getDashboardData(userId)
      ]);

      const bookings = await Booking.find({ user: userId }).lean();
      const wallet = await Wallet.findOne({ userId }).lean();
      const motivationalInsights = this.getMotivationalInsights(bookings, wallet);

      return {
        success: true,
        timestamp: new Date(),
        greeting,
        quickStats,
        alerts,
        streak,
        suggestions,
        recentActivity: recentActivity.slice(0, 10),
        motivationalInsights,
        detailedInsights: insights.data,
        meta: {
          refreshInterval: "realtime",
          lastUpdated: new Date(),
          dataFreshness: "live"
        }
      };
    } catch (error) {
      console.error("Enhanced Dashboard Error:", error);
      throw error;
    }
  }
}

module.exports = new UserDashboardService();