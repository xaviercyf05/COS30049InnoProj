const fs = require("fs");
const path = require("path");
const multer = require("multer");

const moduleCoverStorageDir = path.join(__dirname, "..", "..", "uploads", "module-covers");

fs.mkdirSync(moduleCoverStorageDir, { recursive: true });

function resolveImageExtension(mimetype, originalName) {
  const extensionFromName = path.extname(originalName || "").toLowerCase();

  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extensionFromName)) {
    return extensionFromName;
  }

  switch (mimetype) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".jpg";
  }
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, moduleCoverStorageDir);
  },
  filename(req, file, callback) {
    const safeId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = resolveImageExtension(file.mimetype, file.originalname);
    callback(null, `module-cover-${safeId}${extension}`);
  },
});

const moduleCoverUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      const error = new Error("Only image files are allowed.");
      error.statusCode = 400;
      return callback(error);
    }

    return callback(null, true);
  },
});

module.exports = moduleCoverUpload;