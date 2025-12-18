const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.isAuthenticatedUser = async (req, res, next) => {
    try {
        console.log("Auth header received:", req.headers.authorization ? "Yes" : "No");
        
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: "Please login to access this resource"
            });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Please login to access this resource"
            });
        }

        // Log the token for debugging
        console.log("Received token:", token);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded token:", decoded);

        // Check if we have userId or _id in the decoded token
        const userId = decoded.userId || decoded._id || decoded.id;
        if (!userId) {
            console.log("No user ID found in token");
            return res.status(401).json({
                success: false,
                message: "Invalid token format"
            });
        }

        console.log("Looking for user with ID:", userId);
        const user = await User.findById(userId);
        console.log("Found user:", user ? "Yes" : "No");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: "Your account is not active"
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth error:", error);
        return res.status(401).json({
            success: false,
            message: "Invalid token"
        });
    }
};

// Alias for user authentication
exports.authenticateUser = exports.isAuthenticatedUser;
