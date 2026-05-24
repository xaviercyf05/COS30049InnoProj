const express = require("express");
const { body } = require("express-validator");
const { authenticateUser } = require("../../middleware/authUser");
const profileImageUpload = require("../../middleware/profileImageUpload");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const userController = require("../../controllers/userController");

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

module.exports = router;
