const express = require("express");
const { authenticateUser } = require("../../middleware/authUser");
const asyncHandler = require("../../utils/asyncHandler");
const notificationController = require("../../controllers/notificationController");

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /notifications - Get user's notifications
 */
router.get("/", asyncHandler(notificationController.getUserNotifications));

/**
 * GET /announcements - Get announcements for user's role
 */
router.get("/announcements", asyncHandler(notificationController.getAnnouncements));

// Schedules route removed — schedules functionality deprecated.

module.exports = router;
