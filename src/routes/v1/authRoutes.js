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
    body("remember")
      .optional()
      .isBoolean()
      .withMessage("Remember flag must be a boolean."),
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
 * POST /auth/login/email-code/request - Request a passwordless email sign-in code
 * Body: { identifier }
 */
router.post(
  "/login/email-code/request",
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
    body("email")
      .optional({ values: "falsy" })
      .trim()
      .isEmail()
      .withMessage("A valid email address is required."),
    body("userId")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("User ID must be a positive integer."),
    body().custom((_, { req }) => {
      const hasIdentifier =
        (typeof req.body.identifier === "string" && req.body.identifier.trim().length > 0) ||
        (typeof req.body.username === "string" && req.body.username.trim().length > 0) ||
        (typeof req.body.email === "string" && req.body.email.trim().length > 0) ||
        (req.body.userId !== undefined &&
          req.body.userId !== null &&
          String(req.body.userId).trim().length > 0);

      if (!hasIdentifier) {
        throw new Error("Username, email, or User ID is required.");
      }

      return true;
    }),
  ],
  validate,
  asyncHandler(userController.requestEmailLoginCode)
);

/**
 * POST /auth/login/email-code/verify - Verify a passwordless email sign-in code
 * Body: { identifier, loginCode }
 */
router.post(
  "/login/email-code/verify",
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
    body("email")
      .optional({ values: "falsy" })
      .trim()
      .isEmail()
      .withMessage("A valid email address is required."),
    body("userId")
      .optional({ values: "falsy" })
      .isInt({ min: 1 })
      .withMessage("User ID must be a positive integer."),
    body("loginCode")
      .notEmpty()
      .withMessage("Sign-in code is required.")
      .isLength({ min: 6, max: 12 })
      .withMessage("Sign-in code must be between 6 and 12 characters."),
    body().custom((_, { req }) => {
      const hasIdentifier =
        (typeof req.body.identifier === "string" && req.body.identifier.trim().length > 0) ||
        (typeof req.body.username === "string" && req.body.username.trim().length > 0) ||
        (typeof req.body.email === "string" && req.body.email.trim().length > 0) ||
        (req.body.userId !== undefined &&
          req.body.userId !== null &&
          String(req.body.userId).trim().length > 0);

      if (!hasIdentifier) {
        throw new Error("Username, email, or User ID is required.");
      }

      return true;
    }),
  ],
  validate,
  asyncHandler(userController.verifyEmailLoginCode)
);

/**
 * POST /auth/forgot-password - Request a password reset email
 * Body: { email }
 */
router.post(
  "/forgot-password",
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("A valid email address is required."),
  ],
  validate,
  asyncHandler(userController.requestPasswordReset)
);

/**
 * POST /auth/refresh - Refresh a valid JWT token
 * Body: { refreshToken }
 */
router.post(
  '/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required.')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Refresh token is too long.'),
  ],
  validate,
  asyncHandler(userController.refreshToken)
);

/**
 * GET /auth/reset-password - Render the password reset form
 * Query: { token }
 */
router.get(
  "/reset-password",
  asyncHandler(userController.showPasswordResetPage)
);

/**
 * POST /auth/reset-password - Complete a password reset
 * Body: { token, newPassword, confirmPassword }
 */
router.post(
  "/reset-password",
  asyncHandler(userController.completePasswordReset)
);

/**
 * POST /auth/verify-email - Verify email and activate user account
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

/**
 * POST /auth/mfa/verify-token - Verify MFA token during login
 * Body: { userId, token } OR { userId, recoveryCode }
 */
router.post(
  "/mfa/verify-token",
  [
    body("userId")
      .isInt({ min: 1 })
      .withMessage("User ID must be a positive integer."),
    body()
      .custom((_, { req }) => {
        const { token, recoveryCode } = req.body;
        if (!token && !recoveryCode) {
          throw new Error("Either token or recovery code is required.");
        }
        return true;
      }),
  ],
  validate,
  asyncHandler(require("../../controllers/mfaController").verifyMFAToken)
);

/**
 * POST /auth/mfa/complete-login - Complete login after MFA verification
 * Body: { tempToken, remember }
 */
router.post(
  "/mfa/complete-login",
  [
    body("tempToken")
      .notEmpty()
      .withMessage("Temporary token is required.")
      .isLength({ min: 1, max: 1000 })
      .withMessage("Token is too long."),
    body("remember")
      .optional()
      .isBoolean()
      .withMessage("Remember flag must be a boolean."),
  ],
  validate,
  asyncHandler(userController.completeMFALogin)
);

module.exports = router;
