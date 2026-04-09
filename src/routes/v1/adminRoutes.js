const express = require("express");
const { body, param } = require("express-validator");
const { authenticateAdminOnly } = require("../../middleware/authUser");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const adminController = require("../../controllers/adminManagementController");

const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdminOnly);

/**
 * POST /admin/qualifications - Create a new qualification
 * Body: { name, status? }
 */
router.post(
  "/qualifications",
  [
    body("name")
      .trim()
      .isLength({ min: 3, max: 150 })
      .withMessage("Qualification name must be between 3 and 150 characters."),
    body("status")
      .optional()
      .isIn(["Active", "Inactive"])
      .withMessage("Status must be Active or Inactive."),
  ],
  validate,
  asyncHandler(adminController.createQualification)
);

/**
 * POST /admin/announcements - Create announcement
 * Body: { title, content, targetRole, expiryDate? }
 */
router.post(
  "/announcements",
  [
    body("title")
      .trim()
      .isLength({ min: 3, max: 160 })
      .withMessage("Title must be between 3 and 160 characters."),
    body("content")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Content is required."),
    body("targetRole")
      .isIn(["Admin", "User", "All"])
      .withMessage("Target role must be Admin, User, or All."),
    body("expiryDate")
      .optional()
      .isISO8601()
      .withMessage("Expiry date must be a valid date."),
  ],
  validate,
  asyncHandler(adminController.createAnnouncement)
);

/**
 * POST /admin/schedules - Create schedule event for a user
 * Body: { targetUserId, qualificationId, title, description?, eventDate, startTime, endTime }
 */
router.post(
  "/schedules",
  [
    body("targetUserId")
      .isInt()
      .withMessage("Valid target user ID is required."),
    body("qualificationId")
      .isInt()
      .withMessage("Valid qualification ID is required."),
    body("title")
      .trim()
      .isLength({ min: 3, max: 160 })
      .withMessage("Title must be between 3 and 160 characters."),
    body("description")
      .optional()
      .trim(),
    body("eventDate")
      .isISO8601()
      .withMessage("Valid event date is required."),
    body("startTime")
      .matches(/^\d{2}:\d{2}(:\d{2})?$/)
      .withMessage("Start time must be in HH:MM or HH:MM:SS format."),
    body("endTime")
      .matches(/^\d{2}:\d{2}(:\d{2})?$/)
      .withMessage("End time must be in HH:MM or HH:MM:SS format."),
  ],
  validate,
  asyncHandler(adminController.createSchedule)
);

/**
 * GET /admin/users - Get all users
 */
router.get("/users", asyncHandler(adminController.getAllUsers));

/**
 * PUT /admin/users/:userId/status - Update user status
 * Body: { status }
 */
router.put(
  "/users/:userId/status",
  [
    param("userId").isInt().withMessage("Invalid user ID."),
    body("targetUserId")
      .isInt()
      .withMessage("Valid target user ID is required."),
    body("status")
      .isIn(["Active", "Inactive", "Suspended"])
      .withMessage("Status must be Active, Inactive, or Suspended."),
  ],
  validate,
  asyncHandler(adminController.updateUserStatus)
);

/**
 * GET /admin/users/:userId/enrollments - Get user's enrollment details
 */
router.get(
  "/users/:userId/enrollments",
  [param("userId").isInt().withMessage("Invalid user ID.")],
  validate,
  asyncHandler(adminController.getUserEnrollmentDetails)
);

module.exports = router;
