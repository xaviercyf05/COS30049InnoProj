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
    const mimeExtMap = {
      'application/pdf': 'pdf',
      'application/x-pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
    };

    const originalExt = file.originalname && file.originalname.includes('.')
      ? file.originalname.split('.').pop()
      : null;
    const ext = originalExt || mimeExtMap[file.mimetype] || 'pdf';
    callback(null, `payment-${safeId}.${ext}`);
  },
});

const paymentUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const allowed =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/x-pdf' ||
      String(file.mimetype || '').startsWith('image/');

    if (!allowed) {
      const error = new Error('Only PDF or image files are allowed for payment evidence.');
      error.statusCode = 400;
      return callback(error);
    }

    return callback(null, true);
  },
});

module.exports = paymentUpload;
