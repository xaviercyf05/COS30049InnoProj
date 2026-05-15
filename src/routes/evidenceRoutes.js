const express = require('express');
const { body } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const evidenceUpload = require('../middleware/evidenceUpload');
const { validateDeviceKey } = require('../middleware/sensorAuth');
const evidenceController = require('../controllers/evidenceController');

const router = express.Router();

router.post(
  '/log',
  validateDeviceKey,
  evidenceUpload.single('video'),
  [
    body('location').optional().isString().isLength({ min: 1, max: 100 }),
    body('labels').optional().isString().isLength({ max: 20000 }),
    body('eventType').optional().isString().isLength({ min: 1, max: 100 }),
    body('eventEpoch').optional().isFloat({ min: 0 }),
  ],
  validate,
  asyncHandler(evidenceController.submitEvidenceClip)
);

module.exports = router;
