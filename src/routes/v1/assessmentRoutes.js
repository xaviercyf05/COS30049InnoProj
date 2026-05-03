const express = require("express");
const { body, param } = require("express-validator");
const { authenticateUser } = require("../../middleware/authUser");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const assessmentController = require("../../controllers/assessmentController");

const router = express.Router();

router.use(authenticateUser);

/**
 * GET /assessments/:moduleId/questions - Get assessment questions for a module
 */
router.get(
  "/:moduleId/questions",
  [param("moduleId").isInt().withMessage("Invalid module ID.")],
  validate,
  asyncHandler(assessmentController.getAssessmentQuestions)
);

/**
 * GET /assessments/:assessmentId - Get assessment details for a module assessment
 */
router.get(
  "/:assessmentId",
  [param("assessmentId").isInt().withMessage("Invalid assessment ID.")],
  validate,
  asyncHandler(assessmentController.getAssessmentDetails)
);

/**
 * GET /assessments/:assessmentId/eligibility - Check if user can attempt assessment
 */
router.get(
  "/:assessmentId/eligibility",
  [param("assessmentId").isInt().withMessage("Invalid assessment ID.")],
  validate,
  asyncHandler(assessmentController.checkAttemptEligibility)
);

/**
 * POST /assessments/submit - Submit assessment attempt
 * Body: { assessmentId, answers: [{ optionId }, ...] }
 */
router.post(
  "/submit",
  [
    body("assessmentId").isInt().withMessage("Valid assessment ID is required."),
    body("answers").isArray().withMessage("Answers must be an array."),
    body("answers.*.optionId").optional().isInt().withMessage("Each answer must have a valid option ID."),
    body("timeUsedSeconds")
      .optional({ values: "falsy" })
      .isInt({ min: 0 })
      .withMessage("Time used must be a non-negative integer in seconds."),
  ],
  validate,
  asyncHandler(assessmentController.submitAssessmentAttempt)
);

/**
 * GET /assessments/:moduleId/history - Get assessment attempt history
 */
router.get(
  "/:moduleId/history",
  [param("moduleId").isInt().withMessage("Invalid module ID.")],
  validate,
  asyncHandler(assessmentController.getAssessmentHistory)
);

module.exports = router;