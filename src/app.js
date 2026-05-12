const express = require("express");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const env = require("./config/env");
const { ping } = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");

// Route imports
const publicRoutes = require("./routes/v1/publicRoutes");
const authRoutes = require("./routes/v1/authRoutes");
const userRoutes = require("./routes/v1/userRoutes");
const qualificationRoutes = require("./routes/v1/qualificationRoutes");
const moduleRoutes = require("./routes/v1/moduleRoutes");
const assessmentRoutes = require("./routes/v1/assessmentRoutes");
const notificationRoutes = require("./routes/v1/notificationRoutes");
const badgeRoutes = require("./routes/v1/badgeRoutes");
const adminRoutes = require("./routes/v1/adminRoutes");
const enrollmentRoutes = require("./routes/v1/enrollmentRoutes");
const richContentModule = require("../feature_modules/rich-content/");

const app = express();
const publicDir = path.join(__dirname, "..", "public");
const uploadsDir = path.join(__dirname, "..", "uploads");
const richContentStorageDir = richContentModule.initRichContentStorage();
const richContentDemoDir = path.join(
  __dirname,
  "..",
  "feature_modules",
  "rich-content",
  "frontend"
);

/**
 * Security and middleware setup
 */
app.disable("x-powered-by");
app.use(helmet());
const configuredCorsOrigins = Array.isArray(env.corsOrigin)
  ? env.corsOrigin.filter(Boolean)
  : [];

app.use(
  cors((req, callback) => {
    const requestOrigin = req.header("Origin");
    const isPasswordResetRoute = req.path.startsWith("/api/v1/auth/reset-password");

    // The password reset page is public and must be able to submit its form without
    // being blocked by the global origin whitelist.
    if (isPasswordResetRoute) {
      return callback(null, {
        origin: true,
        methods: ["GET", "POST", "OPTIONS"],
      });
    }

    // When no CORS_ORIGIN is configured, allow all origins (dev-friendly default).
    if (configuredCorsOrigins.length === 0) {
      return callback(null, { origin: true });
    }

    // Allow server-to-server and same-origin requests without an Origin header.
    if (!requestOrigin) {
      return callback(null, { origin: true });
    }

    if (configuredCorsOrigins.includes(requestOrigin)) {
      return callback(null, { origin: true });
    }

    return callback(new Error("Not allowed by CORS"));
  })
);
app.use(morgan("combined"));
app.use(express.json({ limit: env.requestBodyLimit }));
app.use(express.urlencoded({ limit: env.requestBodyLimit, extended: true }));
fs.mkdirSync(uploadsDir, { recursive: true });
app.use(express.static(publicDir));
app.use("/public", express.static(publicDir));
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(uploadsDir)
);
app.use("/storage", express.static(richContentStorageDir));
app.use("/rich-content-demo", express.static(richContentDemoDir));

app.get("/", (req, res) => {
  return res.sendFile(path.join(publicDir, "index.html"));
});

/**
 * Health check endpoint
 */
async function healthHandler(req, res) {
  try {
    await ping();
    return res.json({
      success: true,
      message: "Server is running and database is connected.",
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Database connection failed.",
    });
  }
}

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

/**
 * API Routes - v1
 */
const apiV1 = express.Router();

// Public non-authenticated routes
apiV1.use("/public", publicRoutes);

// Authentication routes (public)
apiV1.use("/auth", authRoutes);

// User routes (protected)
apiV1.use("/user", userRoutes);

// Qualification routes (mixed public/protected)
apiV1.use("/qualifications", qualificationRoutes);

// Module/Material routes (protected)
apiV1.use("/modules", moduleRoutes);

// Assessment routes (protected)
apiV1.use("/assessments", assessmentRoutes);

// Notification, announcement, schedule routes (protected)
apiV1.use("/notifications", notificationRoutes);

// Badge routes (protected)
apiV1.use("/badges", badgeRoutes);

// Admin management routes (admin only)
apiV1.use("/admin", adminRoutes);

// Enrollment / payment evidence routes (protected)
apiV1.use("/enrollment", enrollmentRoutes);

// Rich content + attachments routes (protected)
apiV1.use("/rich-content", richContentModule.router);

// Register v1 routes
app.use("/api/v1", apiV1);

/**
 * 404 handler
 */
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Endpoint not found.",
  });
});

/**
 * Global error handler
 */
app.use(errorHandler);

module.exports = app;
