const express = require('express');
const { body } = require('express-validator');
const { authenticateUser } = require('../../middleware/authUser');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const paymentUpload = require('../../middleware/paymentUpload');
const enrollmentController = require('../../controllers/enrollmentController');

const router = express.Router();

// All enrollment routes require authentication
router.use(authenticateUser);

/**
 * POST /enrollment/submit-payment - Submit payment receipt/evidence
 * Body (form-data): moduleId, reference, evidence (file)
 */
router.post(
  '/submit-payment',
  paymentUpload.single('evidence'),
  asyncHandler(enrollmentController.submitPaymentEvidence)
);

module.exports = router;
