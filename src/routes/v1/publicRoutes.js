const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const resumeUpload = require("../../middleware/resumeUpload");
const registrationController = require("../../controllers/registrationController");

const router = express.Router();

/**
 * POST /public/register - submit registration request with resume PDF.
 */
router.post(
  "/register",
  resumeUpload.single("resume"),
  asyncHandler(registrationController.submitRegistrationRequest)
);

module.exports = router;
