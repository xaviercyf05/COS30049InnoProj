const fs = require("fs");
const path = require("path");
const multer = require("multer");

const registrationResumeDir = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "registration-resumes"
);

fs.mkdirSync(registrationResumeDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, registrationResumeDir);
  },
  filename(req, file, callback) {
    const safeId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `resume-${safeId}.pdf`);
  },
});

const resumeUpload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const isPdfMime =
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/x-pdf";
    const hasPdfExtension = path.extname(file.originalname || "").toLowerCase() === ".pdf";

    if (!isPdfMime && !hasPdfExtension) {
      const error = new Error("Only PDF files are allowed for resume upload.");
      error.statusCode = 400;
      return callback(error);
    }

    return callback(null, true);
  },
});

module.exports = resumeUpload;
