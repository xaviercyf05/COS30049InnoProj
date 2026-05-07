const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const { protect } = require('../middleware/auth'); // your existing auth middleware

router.post('/request', protect, enrollmentController.requestEnrollment);
router.get('/my-requests', protect, (req, res) => {
  res.json({ message: "My requests endpoint" });
});

module.exports = router;
