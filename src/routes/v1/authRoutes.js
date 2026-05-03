const express = require("express");
const { body, query } = require("express-validator");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const userController = require("../../controllers/userController");

const router = express.Router();

router.get("/login", (req, res) => {
  return res.status(405).json({
    success: false,
    message: "Method not allowed. Use POST /api/v1/auth/login.",
  });
});

/**
 * POST /auth/login - Login user (park guide or admin)
 * Body: { identifier, password } where identifier can be username or userId
 */
router.post(
  "/login",
  [
    body("identifier")
      .optional({ values: "falsy" })
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Identifier must be between 1 and 100 characters."),
    body("username")
      .optional({ values: "falsy" })
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Username must be between 1 and 100 characters."),
    body("userId")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("User ID must be a positive integer."),
    body("password")
      .isLength({ min: 8, max: 128 })
      .withMessage("Password must be between 8 and 128 characters."),
    body().custom((_, { req }) => {
      const hasIdentifier =
        (typeof req.body.identifier === "string" && req.body.identifier.trim().length > 0) ||
        (typeof req.body.username === "string" && req.body.username.trim().length > 0) ||
        (req.body.userId !== undefined &&
          req.body.userId !== null &&
          String(req.body.userId).trim().length > 0);

      if (!hasIdentifier) {
        throw new Error("Username or User ID is required.");
      }

      return true;
    }),
  ],
  validate,
  asyncHandler(userController.loginUser)
);

/**
 * GET /auth/verify-email - Verify email and activate user account
 * Query: { token } - The verification token from email link
 */
router.get(
  "/verify-email",
  [
    query("token")
      .notEmpty()
      .withMessage("Verification token is required.")
      .isLength({ min: 1, max: 500 })
      .withMessage("Token must be between 1 and 500 characters."),
  ],
  validate,
  asyncHandler(userController.verifyEmailAndActivateAccount)
);

module.exports = router;
