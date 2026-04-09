const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const env = require("./config/env");
const { ping } = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");

// Route imports
const authRoutes = require("./routes/v1/authRoutes");
const userRoutes = require("./routes/v1/userRoutes");
const qualificationRoutes = require("./routes/v1/qualificationRoutes");
const moduleRoutes = require("./routes/v1/moduleRoutes");
const assessmentRoutes = require("./routes/v1/assessmentRoutes");
const notificationRoutes = require("./routes/v1/notificationRoutes");
const adminRoutes = require("./routes/v1/adminRoutes");

const app = express();

/**
 * Security and middleware setup
 */
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.corsOrigin || "*" }));
app.use(morgan("combined"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ limit: "10kb", extended: true }));

/**
 * Health check endpoint
 */
app.get("/health", async (req, res) => {
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
});

/**
 * API Routes - v1
 */
const apiV1 = express.Router();

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

// Admin management routes (admin only)
apiV1.use("/admin", adminRoutes);

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
