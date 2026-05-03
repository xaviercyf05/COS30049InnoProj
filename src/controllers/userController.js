const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs/promises");
const path = require("path");
const { query } = require("../config/db");
const env = require("../config/env");
const emailVerificationService = require("../services/emailVerificationService");

const profileImagePrefix = "/uploads/profile-images/";
const profileImageStorageDir = path.join(__dirname, "..", "..", "uploads", "profile-images");

async function getUserProfileRow(userId) {
  const [rows] = await query(
    `SELECT u.UserID,
            u.Username,
            u.FullName,
            u.Email,
            u.ProfileImageUrl,
            u.Status,
            u.IsActive,
            u.Progress,
            u.CreatedAt,
            r.RoleTitle,
            q.QualificationName
       FROM Users u
       INNER JOIN Roles r ON r.RoleID = u.RoleID
       LEFT JOIN Qualifications q ON q.QualificationID = u.QualificationID
       WHERE u.UserID = ?
       LIMIT 1`,
    [userId]
  );

  return rows.length > 0 ? rows[0] : null;
}

function buildRoleAwareProfile(user, viewerRole) {
  const normalizedViewerRole = viewerRole === "Admin" ? "Admin" : "User";
  const isAdmin = normalizedViewerRole === "Admin";
  const progressValue = Number.isFinite(Number(user.Progress))
    ? Number(user.Progress)
    : 0;

  const profileType = isAdmin ? "admin" : "guide";
  const chapterOne = progressValue >= 34 ? "Completed" : progressValue > 0 ? "In Progress" : "Incomplete";
  const chapterTwo = progressValue >= 67 ? "Completed" : progressValue >= 34 ? "In Progress" : "Incomplete";
  const chapterThree = progressValue >= 100 ? "Completed" : progressValue >= 67 ? "In Progress" : "Incomplete";

  return {
    userId: user.UserID,
    username: user.Username,
    fullName: user.FullName,
    email: user.Email,
    profileImageUrl: user.ProfileImageUrl || null,
    role: normalizedViewerRole,
    viewerRole: normalizedViewerRole,
    accountRole: user.RoleTitle,
    profileType,
    status: user.Status,
    isActive: user.IsActive === 1,
    progress: progressValue,
    progressLabel: `${progressValue}%`,
    createdAt: user.CreatedAt,
    staffId: `${isAdmin ? "ADM" : "PG"}-${String(user.UserID).padStart(6, "0")}`,
    station: user.QualificationName || (isAdmin ? "Rainforest National Park HQ" : "Not assigned yet"),
    chapterStatus: isAdmin
      ? null
      : {
          chapter1: chapterOne,
          chapter2: chapterTwo,
          chapter3: chapterThree,
          onSiteTraining: progressValue >= 100 ? "Completed" : "Incomplete",
        },
    permissions: {
      canManageUsers: isAdmin,
      canViewProgress: !isAdmin,
      canEditProfile: true,
    },
  };
}

function createProfileImageUrl(fileName) {
  return `${profileImagePrefix}${fileName}`;
}

async function removeStoredProfileImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith(profileImagePrefix)) {
    return;
  }

  const imagePath = path.join(__dirname, "..", "..", imageUrl.replace(/^\/+/, ""));

  try {
    await fs.unlink(imagePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Unable to remove old profile image:", error.message);
    }
  }
}

/**
 * Controller for user authentication and profile management.
 * Handles login for park guides and admin.
 */

/**
 * Login endpoint for users (park guides) and admin
 */
async function loginUser(req, res) {
  try {
    const { identifier, username, userId, password } = req.body;

    const loginIdentifier =
      (typeof identifier === "string" && identifier.trim().length > 0
        ? identifier
        : typeof username === "string" && username.trim().length > 0
          ? username
          : userId !== undefined && userId !== null
            ? String(userId)
            : "").trim();

    if (!loginIdentifier) {
      return res.status(400).json({
        success: false,
        message: "Username or User ID is required.",
      });
    }

    const parsedUserId = /^\d+$/.test(loginIdentifier)
      ? Number.parseInt(loginIdentifier, 10)
      : null;

    const [rows] = await query(
      `SELECT u.UserID, u.Username, u.PasswordHash, u.Status, u.IsActive, r.RoleTitle
       FROM Users u
       INNER JOIN Roles r ON r.RoleID = u.RoleID
       WHERE u.IsActive = 1
         AND (
           u.Username = ?
           OR (? IS NOT NULL AND u.UserID = ?)
         )
       LIMIT 1`,
      [loginIdentifier, parsedUserId, parsedUserId]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const user = rows[0];

    // Check account status
    if (user.Status !== "Active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.Status}. Please contact an administrator.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.PasswordHash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const token = jwt.sign(
      {
        sub: user.UserID,
        username: user.Username,
        role: user.RoleTitle,
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    return res.json({
      success: true,
      data: {
        token,
        tokenType: "Bearer",
        expiresIn: env.jwtExpiresIn,
        user: {
          userId: user.UserID,
          username: user.Username,
          role: user.RoleTitle,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

/**
 * Get logged-in user's profile
 */
async function getUserProfile(req, res) {
  try {
    const { userId, role } = req.user;
    const user = await getUserProfileRow(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      data: buildRoleAwareProfile(user, role),
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

/**
 * Update user profile (name, email)
 */
async function updateUserProfile(req, res) {
  try {
    const { userId, role } = req.user;
    const { fullName, email, username } = req.body;

    const normalizedFullName = String(fullName || "").trim();
    const normalizedEmail = String(email || "").trim();
    const normalizedUsername =
      typeof username === "string" && username.trim().length > 0
        ? username.trim()
        : null;

    if (!normalizedFullName || !normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Full name and email are required.",
      });
    }

    const updateValues = [normalizedFullName, normalizedEmail];
    let updateSql = "UPDATE Users SET FullName = ?, Email = ?";

    if (normalizedUsername) {
      updateSql += ", Username = ?";
      updateValues.push(normalizedUsername);
    }

    updateSql += " WHERE UserID = ?";
    updateValues.push(userId);

    const [result] = await query(updateSql, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const updatedUser = await getUserProfileRow(userId);

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      data: buildRoleAwareProfile(updatedUser, role),
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Username or email already in use.",
      });
    }

    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

/**
 * Update user profile image
 */
async function updateUserProfileImage(req, res) {
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return res.status(400).json({
      success: false,
      message: "Profile image file is required.",
    });
  }

  if (!uploadedFile.mimetype || !uploadedFile.mimetype.startsWith("image/")) {
    await fs.unlink(uploadedFile.path).catch(() => {});

    return res.status(400).json({
      success: false,
      message: "Only image files are allowed.",
    });
  }

  try {
    const { userId, role } = req.user;
    const user = await getUserProfileRow(userId);

    if (!user) {
      await fs.unlink(uploadedFile.path).catch(() => {});

      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const newProfileImageUrl = createProfileImageUrl(uploadedFile.filename);

    await query("UPDATE Users SET ProfileImageUrl = ? WHERE UserID = ?", [
      newProfileImageUrl,
      userId,
    ]);

    await removeStoredProfileImage(user.ProfileImageUrl);

    const updatedUser = await getUserProfileRow(userId);

    return res.json({
      success: true,
      message: "Profile image updated successfully.",
      data: buildRoleAwareProfile(updatedUser, role),
    });
  } catch (error) {
    await fs.unlink(uploadedFile.path).catch(() => {});

    console.error("Update profile image error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

/**
 * Change user password
 */
async function changeUserPassword(req, res) {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new passwords are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    // Verify current password
    const [rows] = await query(
      "SELECT PasswordHash FROM Users WHERE UserID = ? LIMIT 1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      rows[0].PasswordHash
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await query("UPDATE Users SET PasswordHash = ? WHERE UserID = ?", [
      newPasswordHash,
      userId,
    ]);

    return res.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

/**
 * Verify email and activate user account
 * Used when user clicks the verification link in their email
 */
async function verifyEmailAndActivateAccount(req, res) {
  const { token } = req.query;

  try {
    // Trim and validate token
    const verificationToken = token ? String(token).trim() : "";

    if (!verificationToken) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required.",
      });
    }

    // Verify token and get token record
    const tokenRecord = await emailVerificationService.verifyToken(
      verificationToken,
      'account_activation'
    );

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token. Please request a new one.",
      });
    }

    // Activate user account
    const activatedUser = await emailVerificationService.activateUserAccount(tokenRecord.UserID);

    if (!activatedUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to activate account. Please contact support.",
      });
    }

    // Return success response with user info
    return res.json({
      success: true,
      message: "Email verified successfully! Your account is now active. You can now log in.",
      data: {
        userId: activatedUser.UserID,
        username: activatedUser.Username,
        email: activatedUser.Email,
        fullName: activatedUser.FullName,
        isActive: Boolean(activatedUser.IsActive),
        status: activatedUser.Status,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while verifying your email.",
    });
  }
}

module.exports = {
  loginUser,
  getUserProfile,
  updateUserProfile,
  updateUserProfileImage,
  changeUserPassword,
  verifyEmailAndActivateAccount,
};
