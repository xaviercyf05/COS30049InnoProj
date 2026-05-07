const express = require("express");
const { body, param } = require("express-validator");
const { authenticateUser } = require("../../middleware/authUser");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const materialController = require("../../controllers/materialController");

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /modules/dashboard - Get modules and progress summary for dashboard cards
 */
router.get("/dashboard", asyncHandler(materialController.getDashboardModules));

/**
 * GET /modules/:qualificationId/all - Get all modules for a qualification
 */
router.get(
  "/:qualificationId/all",
  [param("qualificationId").isInt().withMessage("Invalid qualification ID.")],
  validate,
  asyncHandler(materialController.getQualificationModules)
);

/**
 * GET /modules/:moduleId/details - Get module details with learning materials
 */
router.get(
  "/:moduleId/details",
  [param("moduleId").isInt().withMessage("Invalid module ID.")],
  validate,
  asyncHandler(materialController.getModuleDetails)
);

/**
 * GET /modules/material/:materialId/content - Get learning material content
 */
router.get(
  "/material/:materialId/content",
  [param("materialId").isInt().withMessage("Invalid material ID.")],
  validate,
  asyncHandler(materialController.getMaterialContent)
);

/**
 * POST /modules/material/complete - Mark material as completed
 * Body: { materialId }
 */
router.post(
  "/material/complete",
  [body("materialId").isInt().withMessage("Valid material ID is required.")],
  validate,
  asyncHandler(materialController.completeMaterial)
);

/**
 * GET /modules/:moduleId/progress - Get user's progress for a module
 * Returns: { visitedSectionIds, progressPercent, lastSectionId }
 */
router.get(
  "/:moduleId/progress",
  [param("moduleId").isInt().withMessage("Invalid module ID.")],
  validate,
  asyncHandler(materialController.getModuleProgress)
);

/**
 * POST /modules/:moduleId/progress - Save user's progress for a module
 * Body: { visitedSectionIds: [], progressPercent: 45, lastSectionId?: "section-id" }
 */
router.post(
  "/:moduleId/progress",
  [
    param("moduleId").isInt().withMessage("Invalid module ID."),
    body("visitedSectionIds").isArray().withMessage("visitedSectionIds must be an array."),
    body("progressPercent").isInt({ min: 0, max: 100 }).withMessage("progressPercent must be between 0 and 100."),
  ],
  validate,
  asyncHandler(materialController.saveModuleProgress)
);

router.get('/:moduleId/payment-status', protect, enrollmentController.getPaymentStatus);

module.exports = router;
