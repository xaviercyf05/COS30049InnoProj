const express = require("express");
const multer = require("multer");
const { authenticateUser } = require("../../../src/middleware/authUser");
const asyncHandler = require("../../../src/utils/asyncHandler");
const env = require("../../../src/config/env");
const { ensureStorageDir } = require("./storage");
const controller = require("./controller");

const router = express.Router();
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]);

const storageDir = ensureStorageDir();
const upload = multer({
  storage: multer.diskStorage({
    destination: storageDir,
    filename(req, file, cb) {
      const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeOriginalName}`);
    },
  }),
  limits: {
    fileSize: env.richContentMaxFileSizeMb * 1024 * 1024,
    files: 10,
  },
  fileFilter(req, file, cb) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`));
    }

    return cb(null, true);
  },
});

router.use(authenticateUser);

router.get("/", asyncHandler(controller.listRichContents));
router.get("/:contentId", asyncHandler(controller.getRichContent));
router.post("/", upload.array("files", 10), asyncHandler(controller.createRichContent));

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: `Upload error: ${error.message}`,
    });
  }

  if (error && error.message && error.message.startsWith("File type not allowed:")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
});

module.exports = {
  router,
  storageDir,
};
