const express = require("express");
const { param } = require("express-validator");
const { listPublicPosts, getPublicPostById } = require("../controllers/publicController");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");

const router = express.Router();

router.get("/posts", asyncHandler(listPublicPosts));

router.get(
  "/posts/:id",
  [param("id").isInt({ min: 1 }).withMessage("Post id must be a positive integer.")],
  validate,
  asyncHandler(getPublicPostById)
);

module.exports = router;
