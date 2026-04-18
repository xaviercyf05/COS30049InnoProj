const express = require("express");
const { body, param } = require("express-validator");
const { authenticateAdminOnly } = require("../../middleware/authUser");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const adminController = require("../../controllers/adminManagementController");
const registrationController = require("../../controllers/registrationController");
const moduleAdminController = require("../../controllers/moduleAdminController");
const badgeController = require("../../controllers/badgeController");

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
 * GET /admin/announcements - Get all announcements for admin management
 */
router.get(
  "/announcements",
  asyncHandler(adminController.getAllAnnouncements)
);

/**
 * PUT /admin/announcements/:announcementId - Update announcement
 */
router.put(
  "/announcements/:announcementId",
  [
    param("announcementId").isInt().withMessage("Invalid announcement ID."),
    body("title")
      .trim()
      .isLength({ min: 3, max: 160 })
      .withMessage("Title must be between 3 and 160 characters."),
    body().custom((_, { req }) => {
      const hasContent =
        (typeof req.body.fullDesc === "string" && req.body.fullDesc.trim().length > 0) ||
        (typeof req.body.content === "string" && req.body.content.trim().length > 0) ||
        (typeof req.body.teaser === "string" && req.body.teaser.trim().length > 0);

      if (!hasContent) {
        throw new Error("Content is required.");
      }

      return true;
    }),
    body("targetRole")
      .optional()
      .isIn(["Admin", "User", "All"])
      .withMessage("Target role must be Admin, User, or All."),
    body("expiryDate")
      .optional({ values: "falsy" })
      .isISO8601()
      .withMessage("Expiry date must be a valid date."),
  ],
  validate,
  asyncHandler(adminController.updateAnnouncement)
);

/**
 * DELETE /admin/announcements/:announcementId - Delete announcement
 */
router.delete(
  "/announcements/:announcementId",
  [param("announcementId").isInt().withMessage("Invalid announcement ID.")],
  validate,
  asyncHandler(adminController.deleteAnnouncement)
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

/**
 * GET /admin/registrations - List registration requests
 */
router.get(
  "/registrations",
  asyncHandler(registrationController.getRegistrationRequests)
);

/**
 * PUT /admin/registrations/:registrationId/status - Approve/reject request
 */
router.put(
  "/registrations/:registrationId/status",
  [
    param("registrationId").isInt().withMessage("Invalid registration ID."),
    body("status")
      .trim()
      .custom((value) => {
        const normalized = String(value || "").toLowerCase();
        if (!["pending", "approved", "rejected"].includes(normalized)) {
          throw new Error("Status must be pending, approved, or rejected.");
        }
        return true;
      }),
    body("remark")
      .optional({ values: "falsy" })
      .isLength({ max: 255 })
      .withMessage("Remark must be at most 255 characters."),
  ],
  validate,
  asyncHandler(registrationController.updateRegistrationStatus)
);

/**
 * GET /admin/registrations/:registrationId/resume - Stream applicant resume
 */
router.get(
  "/registrations/:registrationId/resume",
  [param("registrationId").isInt().withMessage("Invalid registration ID.")],
  validate,
  asyncHandler(registrationController.getRegistrationResume)
);

/**
 * GET /admin/modules - List module library for admin management
 */
router.get("/modules", asyncHandler(moduleAdminController.listModules));

/**
 * GET /admin/modules/:moduleId - Get module details for editing
 */
router.get(
  "/modules/:moduleId",
  [param("moduleId").isInt().withMessage("Invalid module ID.")],
  validate,
  asyncHandler(moduleAdminController.getModuleById)
);

/**
 * POST /admin/modules - Create module
 */
router.post(
  "/modules",
  [
    body("title")
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage("Module title is required and must be at most 160 characters."),
    body("qualificationId")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Qualification ID must be a positive integer."),
    body("sections")
      .custom((value) => {
        let parsed = value;

        if (typeof value === "string") {
          try {
            parsed = JSON.parse(value);
          } catch (_error) {
            parsed = null;
          }
        }

        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("At least one section is required.");
        }

        return true;
      }),
  ],
  validate,
  asyncHandler(moduleAdminController.createModule)
);

/**
 * PUT /admin/modules/:moduleId - Update module
 */
router.put(
  "/modules/:moduleId",
  [
    param("moduleId").isInt().withMessage("Invalid module ID."),
    body("title")
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage("Module title is required and must be at most 160 characters."),
    body("sections")
      .custom((value) => {
        let parsed = value;

        if (typeof value === "string") {
          try {
            parsed = JSON.parse(value);
          } catch (_error) {
            parsed = null;
          }
        }

        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("At least one section is required.");
        }

        return true;
      }),
  ],
  validate,
  asyncHandler(moduleAdminController.updateModule)
);

/**
 * DELETE /admin/modules/:moduleId - Delete module
 */
router.delete(
  "/modules/:moduleId",
  [param("moduleId").isInt().withMessage("Invalid module ID.")],
  validate,
  asyncHandler(moduleAdminController.deleteModule)
);

/**
 * GET /admin/badges - List badges for admin management
 */
router.get("/badges", asyncHandler(badgeController.getAllBadges));

/**
 * POST /admin/badges - Create badge
 */
router.post(
  "/badges",
  [
    body("name")
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage("Badge name is required and must be at most 160 characters."),
    body("unlockThreshold")
      .optional({ values: "falsy" })
      .isInt({ min: 0, max: 100 })
      .withMessage("Unlock threshold must be between 0 and 100."),
  ],
  validate,
  asyncHandler(badgeController.createBadge)
);

/**
 * PUT /admin/badges/:badgeId - Update badge
 */
router.put(
  "/badges/:badgeId",
  [
    param("badgeId").isInt().withMessage("Invalid badge ID."),
    body("name")
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage("Badge name is required and must be at most 160 characters."),
    body("unlockThreshold")
      .optional({ values: "falsy" })
      .isInt({ min: 0, max: 100 })
      .withMessage("Unlock threshold must be between 0 and 100."),
  ],
  validate,
  asyncHandler(badgeController.updateBadge)
);

/**
 * DELETE /admin/badges/:badgeId - Delete badge
 */
router.delete(
  "/badges/:badgeId",
  [param("badgeId").isInt().withMessage("Invalid badge ID.")],
  validate,
  asyncHandler(badgeController.deleteBadge)
);

module.exports = router;
