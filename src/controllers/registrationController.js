const bcrypt = require("bcryptjs");
const fs = require("fs/promises");
const path = require("path");
const { pool, query } = require("../config/db");

const resumePathPrefix = "/uploads/registration-resumes/";
const resumeStorageDir = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "registration-resumes"
);

let registrationSchemaPromise;

async function ensureRegistrationSchema() {
  if (!registrationSchemaPromise) {
    registrationSchemaPromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS RegistrationRequests (
          RegistrationID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          Username VARCHAR(100) NOT NULL,
          PasswordHash VARCHAR(255) NOT NULL,
          FullName VARCHAR(150) NOT NULL,
          PhoneNumber VARCHAR(50) NOT NULL,
          Email VARCHAR(150) NOT NULL,
          ResumeFilePath VARCHAR(500) NOT NULL,
          ResumeOriginalName VARCHAR(255) NULL,
          Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
          ReviewedBy INT UNSIGNED NULL,
          ReviewedAt TIMESTAMP NULL,
          ReviewRemark VARCHAR(255) NULL,
          CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT chk_registration_requests_status
            CHECK (Status IN ('Pending', 'Approved', 'Rejected')),
          CONSTRAINT fk_registration_requests_reviewer
            FOREIGN KEY (ReviewedBy)
            REFERENCES Users (UserID)
            ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );

      await query(
        "CREATE INDEX idx_registration_requests_status_created ON RegistrationRequests (Status, CreatedAt)"
      ).catch((error) => {
        if (error.code !== "ER_DUP_KEYNAME") {
          throw error;
        }
      });
    })().catch((error) => {
      registrationSchemaPromise = null;
      throw error;
    });
  }

  return registrationSchemaPromise;
}

function normalizeIncomingStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (normalized === "approved") {
    return "Approved";
  }

  if (normalized === "rejected") {
    return "Rejected";
  }

  if (normalized === "pending") {
    return "Pending";
  }

  return "";
}

function mapRegistrationRow(row) {
  return {
    registrationId: row.RegistrationID,
    id: String(row.RegistrationID),
    username: row.Username,
    fullName: row.FullName,
    phoneNumber: row.PhoneNumber,
    email: row.Email,
    resumeName: row.ResumeOriginalName || path.basename(row.ResumeFilePath || "") || "resume.pdf",
    resumeUrl: row.ResumeFilePath,
    status: String(row.Status || "Pending").toLowerCase(),
    reviewedAt: row.ReviewedAt,
    createdAt: row.CreatedAt,
  };
}

async function cleanupUploadedResume(uploadedResume) {
  if (!uploadedResume?.path) {
    return;
  }

  await fs.unlink(uploadedResume.path).catch(() => {});
}

function validateRegistrationInput(payload) {
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const fullName = String(payload.fullName || "").trim();
  const phoneNumber = String(payload.phoneNumber || "").trim();
  const email = String(payload.email || "").trim();

  if (!username || username.length < 3 || username.length > 100) {
    return "Username must be between 3 and 100 characters.";
  }

  if (!password || password.length < 8 || password.length > 128) {
    return "Password must be between 8 and 128 characters.";
  }

  if (!fullName || fullName.length < 2 || fullName.length > 150) {
    return "Full name must be between 2 and 150 characters.";
  }

  if (!phoneNumber || phoneNumber.length < 6 || phoneNumber.length > 50) {
    return "Phone number must be between 6 and 50 characters.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return "A valid email address is required.";
  }

  return "";
}

/**
 * Public registration endpoint.
 */
async function submitRegistrationRequest(req, res) {
  const uploadedResume = req.file;

  try {
    await ensureRegistrationSchema();

    if (!uploadedResume) {
      return res.status(400).json({
        success: false,
        message: "Resume PDF is required.",
      });
    }

    const validationError = validateRegistrationInput(req.body);

    if (validationError) {
      await cleanupUploadedResume(uploadedResume);
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const username = String(req.body.username).trim();
    const password = String(req.body.password);
    const fullName = String(req.body.fullName).trim();
    const phoneNumber = String(req.body.phoneNumber).trim();
    const email = String(req.body.email).trim();

    const [existingUsers] = await query(
      "SELECT UserID FROM Users WHERE Username = ? OR Email = ? LIMIT 1",
      [username, email]
    );

    if (existingUsers.length > 0) {
      await cleanupUploadedResume(uploadedResume);
      return res.status(409).json({
        success: false,
        message: "Username or email already exists. Please use a different one.",
      });
    }

    const [existingRequests] = await query(
      `SELECT RegistrationID
         FROM RegistrationRequests
        WHERE (Username = ? OR Email = ?)
          AND Status = 'Pending'
        LIMIT 1`,
      [username, email]
    );

    if (existingRequests.length > 0) {
      await cleanupUploadedResume(uploadedResume);
      return res.status(409).json({
        success: false,
        message: "A pending registration request already exists for this username or email.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const resumeFilePath = `${resumePathPrefix}${uploadedResume.filename}`;

    const [insertResult] = await query(
      `INSERT INTO RegistrationRequests (
        Username,
        PasswordHash,
        FullName,
        PhoneNumber,
        Email,
        ResumeFilePath,
        ResumeOriginalName,
        Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        username,
        passwordHash,
        fullName,
        phoneNumber,
        email,
        resumeFilePath,
        uploadedResume.originalname || uploadedResume.filename,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Registration submitted successfully. Your application is pending admin review.",
      data: {
        registrationId: insertResult.insertId,
        status: "pending",
      },
    });
  } catch (error) {
    await cleanupUploadedResume(uploadedResume);

    console.error("Submit registration request error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit registration request.",
    });
  }
}

/**
 * Admin: list all registration requests.
 */
async function getRegistrationRequests(req, res) {
  try {
    await ensureRegistrationSchema();

    const [rows] = await query(
      `SELECT RegistrationID,
              Username,
              FullName,
              PhoneNumber,
              Email,
              ResumeFilePath,
              ResumeOriginalName,
              Status,
              ReviewedAt,
              CreatedAt
         FROM RegistrationRequests
        ORDER BY CASE Status
          WHEN 'Pending' THEN 0
          WHEN 'Approved' THEN 1
          ELSE 2
        END,
        CreatedAt DESC`
    );

    return res.json({
      success: true,
      data: rows.map((row) => mapRegistrationRow(row)),
    });
  } catch (error) {
    console.error("Get registration requests error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch registration requests.",
    });
  }
}

/**
 * Admin: update request status and create user account on approval.
 */
async function updateRegistrationStatus(req, res) {
  const { registrationId } = req.params;
  const { status, remark } = req.body;
  const normalizedStatus = normalizeIncomingStatus(status);

  if (!normalizedStatus) {
    return res.status(400).json({
      success: false,
      message: "Status must be pending, approved, or rejected.",
    });
  }

  let connection;

  try {
    await ensureRegistrationSchema();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      `SELECT RegistrationID,
              Username,
              PasswordHash,
              FullName,
              Email,
              Status
         FROM RegistrationRequests
        WHERE RegistrationID = ?
        LIMIT 1`,
      [registrationId]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Registration request not found.",
      });
    }

    const requestRow = existingRows[0];

    if (requestRow.Status === "Approved" && normalizedStatus !== "Approved") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Approved requests cannot be changed back to pending or rejected.",
      });
    }

    let createdUserId = null;

    if (normalizedStatus === "Approved" && requestRow.Status !== "Approved") {
      const [duplicateUsers] = await connection.execute(
        "SELECT UserID FROM Users WHERE Username = ? OR Email = ? LIMIT 1",
        [requestRow.Username, requestRow.Email]
      );

      if (duplicateUsers.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "Cannot approve registration because username or email already exists.",
        });
      }

      const [roleRows] = await connection.execute(
        "SELECT RoleID FROM Roles WHERE RoleTitle = 'User' LIMIT 1"
      );

      if (roleRows.length === 0) {
        await connection.rollback();
        return res.status(500).json({
          success: false,
          message: "User role is not configured.",
        });
      }

      const [insertUserResult] = await connection.execute(
        `INSERT INTO Users (
          Username,
          PasswordHash,
          IsActive,
          FullName,
          Email,
          Progress,
          Status,
          RoleID
        ) VALUES (?, ?, 1, ?, ?, 0, 'Active', ?)`,
        [
          requestRow.Username,
          requestRow.PasswordHash,
          requestRow.FullName,
          requestRow.Email,
          roleRows[0].RoleID,
        ]
      );

      createdUserId = insertUserResult.insertId;
    }

    await connection.execute(
      `UPDATE RegistrationRequests
          SET Status = ?,
              ReviewedBy = ?,
              ReviewedAt = CURRENT_TIMESTAMP,
              ReviewRemark = ?
        WHERE RegistrationID = ?`,
      [normalizedStatus, req.user.userId, remark ? String(remark).trim().slice(0, 255) : null, registrationId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `Registration request ${normalizedStatus.toLowerCase()} successfully.`,
      data: {
        registrationId: Number(registrationId),
        status: normalizedStatus.toLowerCase(),
        createdUserId,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("Update registration status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update registration request.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Admin: stream uploaded resume for review.
 */
async function getRegistrationResume(req, res) {
  try {
    await ensureRegistrationSchema();

    const { registrationId } = req.params;
    const [rows] = await query(
      `SELECT ResumeFilePath, ResumeOriginalName
         FROM RegistrationRequests
        WHERE RegistrationID = ?
        LIMIT 1`,
      [registrationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Registration request not found.",
      });
    }

    const registration = rows[0];
    const relativePath = String(registration.ResumeFilePath || "");

    if (!relativePath.startsWith(resumePathPrefix)) {
      return res.status(400).json({
        success: false,
        message: "Resume file path is invalid.",
      });
    }

    const absolutePath = path.resolve(
      path.join(__dirname, "..", "..", relativePath.replace(/^\/+/, ""))
    );

    if (!absolutePath.startsWith(resumeStorageDir)) {
      return res.status(400).json({
        success: false,
        message: "Resume path is not allowed.",
      });
    }

    await fs.access(absolutePath);

    const requestedDownload = String(req.query.download || "").toLowerCase() === "true";
    const disposition = requestedDownload ? "attachment" : "inline";
    const fileName = registration.ResumeOriginalName || path.basename(absolutePath) || "resume.pdf";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(fileName)}"`);

    return res.sendFile(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({
        success: false,
        message: "Resume file not found.",
      });
    }

    console.error("Get registration resume error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve resume file.",
    });
  }
}

module.exports = {
  submitRegistrationRequest,
  getRegistrationRequests,
  updateRegistrationStatus,
  getRegistrationResume,
};
