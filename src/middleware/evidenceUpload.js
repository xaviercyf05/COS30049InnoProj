const fs = require('fs');
const path = require('path');
const multer = require('multer');

const evidenceStorageDir = path.join(__dirname, '..', '..', 'uploads', 'evidence');

fs.mkdirSync(evidenceStorageDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, evidenceStorageDir);
  },
  filename(req, file, callback) {
    const safeId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = (file.originalname && file.originalname.split('.').pop()) || 'mp4';
    callback(null, `evidence-${safeId}.${ext}`);
  },
});

const evidenceUpload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const allowed = [
      'video/mp4',
      'video/quicktime',
      'video/x-matroska',
      'application/octet-stream',
    ];

    if (!allowed.includes(file.mimetype)) {
      const error = new Error('Only video files are allowed for evidence upload.');
      error.statusCode = 400;
      return callback(error);
    }

    return callback(null, true);
  },
});

module.exports = evidenceUpload;
