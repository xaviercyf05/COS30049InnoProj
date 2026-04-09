const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Middleware to authenticate park guide (User role) tokens.
 * Extracts userId and role from token and attaches to req.user
 */
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Missing or invalid Authorization header.",
    });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    // Allow both 'User' and 'Admin' to access user endpoints
    if (!["User", "Admin"].includes(payload.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Valid user or admin role required.",
      });
    }

    req.user = {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
}

/**
 * Middleware to authenticate admin tokens only.
 * More restrictive than authenticateUser.
 */
function authenticateAdminOnly(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Missing or invalid Authorization header.",
    });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (payload.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required.",
      });
    }

    req.user = {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
}

module.exports = {
  authenticateUser,
  authenticateAdminOnly,
};
