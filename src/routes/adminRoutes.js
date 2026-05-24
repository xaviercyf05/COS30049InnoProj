const express = require("express");
const { body, param } = require("express-validator");
const {
  loginAdmin,
  listAdminPosts,
  createPost,
  updatePost,
  deletePost,
  listAdminUsers,
  createAdminUser,
} = require("../controllers/adminController");
const { authenticateAdmin } = require("../middleware/auth");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

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
  asyncHandler(loginAdmin)
);

router.use(authenticateAdmin);

router.get("/posts", asyncHandler(listAdminPosts));

router.get("/users", asyncHandler(listAdminUsers));

router.post(
  "/users",
  [
    body("username")
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage("Username must be between 3 and 100 characters."),
    body("password")
      .isLength({ min: 8, max: 128 })
      .withMessage("Password must be between 8 and 128 characters."),
    body("role")
      .optional()
      .trim()
      .isIn(["admin", "Admin"])
      .withMessage("Only the admin role is currently supported."),
    body("fullName")
      .optional()
      .trim()
      .isLength({ min: 2, max: 150 })
      .withMessage("fullName must be between 2 and 150 characters."),
    body("email")
      .optional()
      .trim()
      .isEmail()
      .withMessage("email must be a valid email address."),
  ],
  validate,
  asyncHandler(createAdminUser)
);

router.post(
  "/posts",
  [
    body("title")
      .trim()
      .isLength({ min: 3, max: 160 })
      .withMessage("Title must be between 3 and 160 characters."),
    body("content")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Content is required."),
    body("isPublished")
      .optional()
      .isBoolean()
      .withMessage("isPublished must be true or false.")
      .toBoolean(),
  ],
  validate,
  asyncHandler(createPost)
);

router.put(
  "/posts/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("Post id must be a positive integer."),
    body("title")
      .trim()
      .isLength({ min: 3, max: 160 })
      .withMessage("Title must be between 3 and 160 characters."),
    body("content")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Content is required."),
    body("isPublished")
      .optional()
      .isBoolean()
      .withMessage("isPublished must be true or false.")
      .toBoolean(),
  ],
  validate,
  asyncHandler(updatePost)
);

router.delete(
  "/posts/:id",
  [param("id").isInt({ min: 1 }).withMessage("Post id must be a positive integer.")],
  validate,
  asyncHandler(deletePost)
);

module.exports = router;
