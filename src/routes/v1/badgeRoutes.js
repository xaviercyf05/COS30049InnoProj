const express = require("express");
const { authenticateUser } = require("../../middleware/authUser");
const asyncHandler = require("../../utils/asyncHandler");
const badgeController = require("../../controllers/badgeController");

const router = express.Router();

router.use(authenticateUser);

/**
 * GET /badges - get badge list for current authenticated user.
 */
router.get("/", asyncHandler(badgeController.getUserBadges));

module.exports = router;
