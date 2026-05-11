const fs = require('fs');
const path = require('path');
const multer = require('multer');

const paymentEvidenceDir = path.join(__dirname, '..', '..', 'uploads', 'payment-evidence');

fs.mkdirSync(paymentEvidenceDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, paymentEvidenceDir);
  },
  filename(req, file, callback) {
    const safeId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = (file.originalname && file.originalname.split('.').pop()) || 'pdf';
    callback(null, `payment-${safeId}.${ext}`);
  },
});

const paymentUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    // Accept PDFs and common image types for receipts
    const allowed = [
      'application/pdf',
      'application/x-pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];

    if (!allowed.includes(file.mimetype)) {
      const error = new Error('Only PDF, JPG or PNG files are allowed for payment evidence.');
      error.statusCode = 400;
      return callback(error);
    }

    return callback(null, true);
  },
});

module.exports = paymentUpload;
