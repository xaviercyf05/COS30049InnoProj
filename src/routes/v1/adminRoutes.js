const express = require("express");
const { body, param } = require("express-validator");
const { authenticateAdminOnly } = require("../../middleware/authUser");
const moduleCoverUpload = require("../../middleware/moduleCoverUpload");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const adminController = require("../../controllers/adminManagementController");
const registrationController = require("../../controllers/registrationController");
const moduleAdminController = require("../../controllers/moduleAdminController");
const badgeController = require("../../controllers/badgeController");
const assessmentController = require("../../controllers/assessmentController");

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
 * GET /admin/evidence - List evidence alerts for the admin dashboard
 */
router.get(
  "/evidence",
  asyncHandler(adminController.listEvidenceAlerts)
);

/**
 * GET /admin/analytics/dashboard - Aggregated analytics dashboard data
 */
router.get(
  "/analytics/dashboard",
  asyncHandler(adminController.getAnalyticsDashboard)
);

/**
 * PUT /admin/evidence/:evidenceId/status - Update evidence solved status
 * Body: { resolved: boolean }
 */
router.put(
  "/evidence/:evidenceId/status",
  [
    param("evidenceId").isInt({ min: 1 }).withMessage("Invalid evidence ID."),
    body("resolved").isBoolean().withMessage("resolved must be a boolean."),
  ],
  validate,
  asyncHandler(adminController.updateEvidenceStatus)
);

/**
 * GET /admin/evidence/:evidenceId/video - Stream an evidence video
 */
router.get(
  "/evidence/:evidenceId/video",
  [param("evidenceId").isInt({ min: 1 }).withMessage("Invalid evidence ID.")],
  validate,
  asyncHandler(adminController.streamEvidenceVideo)
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
 * POST /admin/registrations/:registrationId/resend-token - Resend activation token email
 */
router.post(
  "/registrations/:registrationId/resend-token",
  [param("registrationId").isInt().withMessage("Invalid registration ID.")],
  validate,
  asyncHandler(registrationController.resendRegistrationVerificationToken)
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
 * GET /admin/modules/types - Get all available module types
 */
router.get("/modules/types", asyncHandler(moduleAdminController.getModuleTypes));

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
 * POST /admin/modules/cover-image - Upload module cover image
 * Body: multipart/form-data with file field coverImage
 */
router.post(
  "/modules/cover-image",
  moduleCoverUpload.single("coverImage"),
  asyncHandler(moduleAdminController.uploadModuleCoverImage)
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
 * GET /admin/assessments - List assessments for admin management
 */
router.get(
  "/assessments",
  asyncHandler(assessmentController.listAssessments)
);

/**
 * POST /admin/assessments - Create assessment
 */
router.post(
  "/assessments",
  [
    body("moduleId").isInt().withMessage("Valid module ID is required."),
    body("badgeId")
      .optional({ values: "falsy" })
      .isInt()
      .withMessage("Badge ID must be a valid number."),
    body("title")
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage("Assessment title is required and must be at most 160 characters."),
    body("passingScore")
      .optional({ values: "falsy" })
      .isInt({ min: 0, max: 100 })
      .withMessage("Passing score must be between 0 and 100."),
    body("durationMinutes")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Duration must be a positive number of minutes."),
    body("attemptLimit")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Attempt limit must be at least 1."),
  ],
  validate,
  asyncHandler(assessmentController.createAssessment)
);

/**
 * PUT /admin/assessments/:assessmentId/settings - Update assessment settings
 */
router.put(
  "/assessments/:assessmentId/settings",
  [
    param("assessmentId").isInt().withMessage("Invalid assessment ID."),
    body("passingScore")
      .optional({ values: "falsy" })
      .isInt({ min: 0, max: 100 })
      .withMessage("Passing score must be between 0 and 100."),
    body("durationMinutes")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Duration must be a positive number of minutes."),
    body("attemptLimit")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("Attempt limit must be at least 1."),
  ],
  validate,
  asyncHandler(assessmentController.updateAssessmentSettings)
);

/**
 * DELETE /admin/assessments/:assessmentId - Delete assessment
 */
router.delete(
  "/assessments/:assessmentId",
  [param("assessmentId").isInt().withMessage("Invalid assessment ID."),],
  validate,
  asyncHandler(assessmentController.deleteAssessment)
);

/**
 * GET /admin/assessments/:assessmentId/questions - Get assessment questions
 */
router.get(
  "/assessments/:assessmentId/questions",
  [param("assessmentId").isInt().withMessage("Invalid assessment ID."),],
  validate,
  asyncHandler(assessmentController.getAssessmentQuestionsAdmin)
);

/**
 * POST /admin/assessments/:assessmentId/questions - Add assessment question
 */
router.post(
  "/assessments/:assessmentId/questions",
  [
    param("assessmentId").isInt().withMessage("Invalid assessment ID."),
    body("questionText")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Question text is required."),
    body("questionType")
      .isIn(["mcq", "fill"])
      .withMessage("Question type must be mcq or fill."),
  ],
  validate,
  asyncHandler(assessmentController.addAssessmentQuestionAdmin)
);

/**
 * PUT /admin/assessments/questions/:questionId - Update assessment question
 */
router.put(
  "/assessments/questions/:questionId",
  [param("questionId").isInt().withMessage("Invalid question ID."),],
  validate,
  asyncHandler(assessmentController.updateAssessmentQuestionAdmin)
);

/**
 * DELETE /admin/assessments/questions/:questionId - Delete assessment question
 */
router.delete(
  "/assessments/questions/:questionId",
  [param("questionId").isInt().withMessage("Invalid question ID."),],
  validate,
  asyncHandler(assessmentController.deleteAssessmentQuestionAdmin)
);

/**
 * GET /admin/assessments/:assessmentId/attempts - List assessment attempts
 */
router.get(
  "/assessments/:assessmentId/attempts",
  [param("assessmentId").isInt().withMessage("Invalid assessment ID."),],
  validate,
  asyncHandler(assessmentController.getAssessmentAttemptsAdmin)
);

/**
 * POST /admin/assessments/:assessmentId/attempts/:attemptId/reset - Reset a user attempt
 */
router.post(
  "/assessments/:assessmentId/attempts/:attemptId/reset",
  [
    param("assessmentId").isInt().withMessage("Invalid assessment ID."),
    param("attemptId").isInt().withMessage("Invalid attempt ID."),
  ],
  validate,
  asyncHandler(assessmentController.resetAssessmentAttemptAdmin)
);

/**
 * PUT /admin/assessments/:assessmentId/badge/:badgeId - Link badge to assessment
 */
router.put(
  "/assessments/:assessmentId/badge/:badgeId",
  [
    param("assessmentId").isInt().withMessage("Invalid assessment ID."),
    param("badgeId").isInt().withMessage("Invalid badge ID."),
  ],
  validate,
  asyncHandler(assessmentController.linkAssessmentBadge)
);

/**
 * DELETE /admin/assessments/:assessmentId/badge - Unlink badge from assessment
 */
router.delete(
  "/assessments/:assessmentId/badge",
  [param("assessmentId").isInt().withMessage("Invalid assessment ID.")],
  validate,
  asyncHandler(assessmentController.unlinkAssessmentBadge)
);

/**
 * GET /admin/assessments/:assessmentId/badge - Get linked badge for assessment
 */
router.get(
  "/assessments/:assessmentId/badge",
  [param("assessmentId").isInt().withMessage("Invalid assessment ID.")],
  validate,
  asyncHandler(assessmentController.getAssessmentBadge)
);

/**
 * POST /admin/users/:userId/badges - Issue a badge to a user (admin action)
 */
router.post(
  "/users/:userId/badges",
  [
    param("userId").isInt().withMessage("Invalid user ID."),
    body("badgeId").isInt({ min: 1 }).withMessage("Valid badgeId is required."),
    body("assessmentId")
      .optional({ values: "falsy" })
      .isInt()
      .withMessage("assessmentId must be a valid integer."),
    body("moduleId")
      .optional({ values: "falsy" })
      .isInt()
      .withMessage("moduleId must be a valid integer."),
  ],
  validate,
  asyncHandler(assessmentController.issueBadgeToUser)
);

/**
 * GET /admin/modules/:moduleId/badges - Get badges linked to a module
 */
router.get(
  "/modules/:moduleId/badges",
  [param("moduleId").isInt().withMessage("Invalid module ID.")],
  validate,
  asyncHandler(badgeController.getBadgesByModule)
);

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
    body("isValid")
      .optional({ values: "falsy" })
      .isBoolean()
      .withMessage("isValid must be a boolean."),
    body("validityMonths")
      .optional({ values: "falsy" })
      .isInt({ min: 1, max: 120 })
      .withMessage("Validity months must be between 1 and 120."),
    body("expiryDate")
      .optional({ values: "falsy" })
      .isISO8601()
      .withMessage("Expiry date must be a valid ISO8601 date."),
    body("linkedModuleIds")
      .optional()
      .custom((value) => {
        const values = Array.isArray(value)
          ? value
          : typeof value === "string"
            ? value.split(",")
            : [value];

        const isValid = values
          .filter((item) => item !== undefined && item !== null && String(item).trim() !== "")
          .every((item) => Number.isInteger(Number(item)) && Number(item) > 0);

        if (!isValid) {
          throw new Error("Linked module IDs must be valid numbers.");
        }

        return true;
      }),
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
    body("isValid")
      .optional({ values: "falsy" })
      .isBoolean()
      .withMessage("isValid must be a boolean."),
    body("validityMonths")
      .optional({ values: "falsy" })
      .isInt({ min: 1, max: 120 })
      .withMessage("Validity months must be between 1 and 120."),
    body("expiryDate")
      .optional({ values: "falsy" })
      .isISO8601()
      .withMessage("Expiry date must be a valid ISO8601 date."),
    body("linkedModuleIds")
      .optional()
      .custom((value) => {
        const values = Array.isArray(value)
          ? value
          : typeof value === "string"
            ? value.split(",")
            : [value];

        const isValid = values
          .filter((item) => item !== undefined && item !== null && String(item).trim() !== "")
          .every((item) => Number.isInteger(Number(item)) && Number(item) > 0);

        if (!isValid) {
          throw new Error("Linked module IDs must be valid numbers.");
        }

        return true;
      }),
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
