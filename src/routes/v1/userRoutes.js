const express = require("express");
const { body } = require("express-validator");
const { authenticateUser } = require("../../middleware/authUser");
const profileImageUpload = require("../../middleware/profileImageUpload");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const userController = require("../../controllers/userController");
const mfaController = require("../../controllers/mfaController");
const passkeyController = require("../../controllers/passkeyController");

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /user/profile - Get current user profile
 */
router.get("/profile", asyncHandler(userController.getUserProfile));

/**
 * PUT /user/profile - Update user profile
 * Body: { fullName, email }
 */
router.put(
  "/profile",
  [
    body("username")
      .optional({ values: "falsy" })
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage("Username must be between 3 and 100 characters."),
    body("fullName")
      .trim()
      .isLength({ min: 2, max: 150 })
      .withMessage("Full name must be between 2 and 150 characters."),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Valid email is required."),
  ],
  validate,
  asyncHandler(userController.updateUserProfile)
);

/**
 * PUT /user/profile/image - Update user profile image
 * Body: multipart/form-data with file field profileImage
 */
router.put(
  "/profile/image",
  profileImageUpload.single("profileImage"),
  asyncHandler(userController.updateUserProfileImage)
);

/**
 * POST /user/change-password - Change password
 * Body: { currentPassword, newPassword }
 */
router.post(
  "/change-password",
  [
    body("currentPassword")
      .isLength({ min: 8 })
      .withMessage("Current password is required."),
    body("newPassword")
      .isLength({ min: 8, max: 128 })
      .withMessage("New password must be between 8 and 128 characters."),
  ],
  validate,
  asyncHandler(userController.changeUserPassword)
);

/**
 * POST /user/mfa/setup/initiate - Initiate MFA setup
 * Returns QR code and recovery codes
 */
router.post(
  "/mfa/setup/initiate",
  asyncHandler(mfaController.initiateMFASetup)
);

/**
 * POST /user/mfa/setup/confirm - Confirm MFA setup with verification token
 * Body: { secret, token, recoveryCodes }
 */
router.post(
  "/mfa/setup/confirm",
  [
    body("secret")
      .notEmpty()
      .withMessage("Secret is required."),
    body("token")
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage("Token must be a 6-digit code."),
    body("recoveryCodes")
      .isArray({ min: 1 })
      .withMessage("Recovery codes array is required."),
  ],
  validate,
  asyncHandler(mfaController.confirmMFASetup)
);

/**
 * GET /user/mfa/status - Get MFA status for current user
 */
router.get(
  "/mfa/status",
  asyncHandler(mfaController.getMFAStatus)
);

/**
 * POST /user/mfa/disable - Disable MFA for current user
 * Body: { password }
 */
router.post(
  "/mfa/disable",
  [
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password is required for security."),
  ],
  validate,
  asyncHandler(mfaController.disableMFA)
);

/**
 * POST /user/mfa/recovery-codes/regenerate - Generate new recovery codes
 * Body: { password }
 */
router.post(
  "/mfa/recovery-codes/regenerate",
  [
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password is required for security."),
  ],
  validate,
  asyncHandler(mfaController.regenerateRecoveryCodes)
);

/**
 * GET /user/passkeys - List registered passkeys for the current user
 */
router.get(
  "/passkeys",
  asyncHandler(passkeyController.listPasskeys)
);

/**
 * POST /user/passkeys/setup/initiate - Begin passkey registration
 * Body: { deviceName? }
 */
router.post(
  "/passkeys/setup/initiate",
  [
    body("deviceName")
      .optional({ values: "falsy" })
      .trim()
      .isLength({ min: 1, max: 120 })
      .withMessage("Device name must be between 1 and 120 characters."),
  ],
  validate,
  asyncHandler(passkeyController.initiatePasskeyRegistration)
);

/**
 * POST /user/passkeys/setup/confirm - Finish passkey registration
 * Body: { tempToken, credential, deviceName? }
 */
router.post(
  "/passkeys/setup/confirm",
  [
    body("tempToken")
      .notEmpty()
      .withMessage("Temporary token is required.")
      .isLength({ min: 1, max: 1000 })
      .withMessage("Token is too long."),
    body().custom((_, { req }) => {
      if (!req.body.credential) {
        throw new Error('Passkey credential is required.');
      }

      return true;
    }),
  ],
  validate,
  asyncHandler(passkeyController.confirmPasskeyRegistration)
);

/**
 * DELETE /user/passkeys/:credentialId - Remove a registered passkey
 */
router.delete(
  "/passkeys/:credentialId",
  asyncHandler(passkeyController.deletePasskey)
);

module.exports = router;
