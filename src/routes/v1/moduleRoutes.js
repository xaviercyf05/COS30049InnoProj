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

module.exports = router;
