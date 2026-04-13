const express = require("express");
const { body } = require("express-validator");
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
 * Body: { username, password }
 */
router.post(
  "/login",
  [
    body("username")
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage("Username must be between 3 and 100 characters."),
    body("password")
      .isLength({ min: 8, max: 128 })
      .withMessage("Password must be between 8 and 128 characters."),
  ],
  validate,
  asyncHandler(userController.loginUser)
);

module.exports = router;
