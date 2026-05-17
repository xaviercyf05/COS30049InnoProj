const multer = require('multer');

const sensorLogUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const mimeType = String(file.mimetype || '').toLowerCase();
    const originalName = String(file.originalname || '').toLowerCase();

    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'text/plain',
    ];

    if (!allowedMimeTypes.includes(mimeType) && !originalName.endsWith('.csv')) {
      const error = new Error('Only CSV files are allowed for ESP32 sensor log upload.');
      error.statusCode = 400;
      return callback(error);
    }

    return callback(null, true);
  },
});

module.exports = sensorLogUpload;
