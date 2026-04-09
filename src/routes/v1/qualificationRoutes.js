const express = require("express");
const { body, param } = require("express-validator");
const { authenticateUser } = require("../../middleware/authUser");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const qualificationController = require("../../controllers/qualificationController");

const router = express.Router();

/**
 * GET /qualifications - Get all qualifications (public)
 */
router.get("/", asyncHandler(qualificationController.getQualifications));

/**
 * GET /qualifications/:qualificationId - Get qualification details (public)
 */
router.get(
  "/:qualificationId",
  [param("qualificationId").isInt().withMessage("Invalid qualification ID.")],
  validate,
  asyncHandler(qualificationController.getQualificationDetails)
);

// All routes below require authentication
router.use(authenticateUser);

/**
 * GET /qualifications/user/my-qualifications - Get user's enrolled qualifications
 */
router.get(
  "/user/my-qualifications",
  asyncHandler(qualificationController.getUserQualifications)
);

/**
 * POST /qualifications/enroll - Enroll user in a qualification
 * Body: { qualificationId }
 */
router.post(
  "/enroll",
  [
    body("qualificationId")
      .isInt()
      .withMessage("Valid qualification ID is required."),
  ],
  validate,
  asyncHandler(qualificationController.enrollInQualification)
);

/**
 * GET /qualifications/:qualificationId/progress - Get user's progress in qualification
 */
router.get(
  "/:qualificationId/progress",
  [param("qualificationId").isInt().withMessage("Invalid qualification ID.")],
  validate,
  asyncHandler(qualificationController.getQualificationProgress)
);

module.exports = router;
