const jwt = require("jsonwebtoken");
const env = require("../config/env");

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header." });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }

    req.admin = {
      id: payload.sub,
      username: payload.username,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = {
  authenticateAdmin,
};
