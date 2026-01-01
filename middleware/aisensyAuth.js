/**
 * AiSensy Static Token Authentication Middleware
 * Validates static token for AiSensy API endpoints
 */

const validateAisensyToken = (req, res, next) => {
  try {
    // Get token from different possible locations
    const token = req.headers['authorization']?.replace('Bearer ', '') || 
                  req.headers['x-api-token'] || 
                  req.query.token ||
                  req.body.token;

    // Get expected token from environment
    const expectedToken = process.env.AISENSY_API_TOKEN;

    if (!expectedToken) {
      console.error('❌ AISENSY_API_TOKEN not configured in environment variables');
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
        error: "API token not configured"
      });
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "Missing API token",
        hint: "Provide token in Authorization header, x-api-token header, or as query/body parameter"
      });
    }

    if (token !== expectedToken) {
      console.log(`❌ Invalid token attempt: ${token.substring(0, 10)}...`);
      return res.status(401).json({
        success: false,
        message: "Invalid API token",
        error: "Authentication failed"
      });
    }

    // Token is valid, proceed to next middleware/controller
    console.log(`✅ Valid AiSensy token authenticated for ${req.method} ${req.path}`);
    next();

  } catch (error) {
    console.error('❌ Error in AiSensy token validation:', error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
};

module.exports = {
  validateAisensyToken
};