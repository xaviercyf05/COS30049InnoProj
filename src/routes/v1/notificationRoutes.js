const express = require("express");
const { param } = require("express-validator");
const { authenticateUser } = require("../../middleware/authUser");
const validate = require("../../middleware/validate");
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

/**
 * GET /certificates - Get user's certificates
 */
router.get("/certificates", asyncHandler(notificationController.getUserCertificates));

/**
 * GET /certificates/:certificateId  - Get certificate details
 */
router.get(
  "/certificates/:certificateId",
  [param("certificateId").isInt().withMessage("Invalid certificate ID.")],
  validate,
  asyncHandler(notificationController.getCertificateDetails)
);

module.exports = router;
