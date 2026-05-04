const bcrypt = require("bcryptjs");
const fs = require("fs/promises");
const path = require("path");
const { query } = require("../config/db");
const emailService = require("../services/emailService");
const emailVerificationService = require("../services/emailVerificationService");
const { createAuthTokenService } = require("../services/authTokenService");

const profileImagePrefix = "/uploads/profile-images/";
const profileImageStorageDir = path.join(__dirname, "..", "..", "uploads", "profile-images");
const authTokenService = createAuthTokenService();
const passwordResetBaseUrl = "https://api.innopappserver.xyz";

function buildPasswordResetLink(token) {
  return `${passwordResetBaseUrl}/api/v1/auth/reset-password?token=${encodeURIComponent(token)}`;
}

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
    const { identifier, username, userId, password, remember } = req.body;

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

    const [allUserRows] = await query(
      `SELECT u.UserID, u.Username, u.PasswordHash, u.Status, u.IsActive, r.RoleTitle
       FROM Users u
       INNER JOIN Roles r ON r.RoleID = u.RoleID
       WHERE (
         u.Username = ?
         OR (? IS NOT NULL AND u.UserID = ?)
       )
       LIMIT 1`,
      [loginIdentifier, parsedUserId, parsedUserId]
    );

    if (allUserRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const user = allUserRows[0];

    if (user.IsActive === 0) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please verify your email using the verification link sent to you to activate your account.",
        isInactive: true,
      });
    }

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

    const tokenPair = await authTokenService.issueTokenPair({
      user,
      remember: !!remember,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
    });

    return res.json({
      success: true,
      data: {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        tokenType: "Bearer",
        expiresIn: tokenPair.accessTokenExpiresIn,
        refreshTokenExpiresIn: tokenPair.refreshTokenExpiresIn,
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
 * Refresh refresh-token-bound session and return a new access/refresh token pair.
 */
async function refreshToken(req, res) {
  try {
    const refreshTokenValue = String(req.body?.refreshToken || '').trim();

    if (!refreshTokenValue) {
      return res.status(400).json({ success: false, message: 'Refresh token is required.' });
    }

    const refreshed = await authTokenService.rotateRefreshToken({
      refreshToken: refreshTokenValue,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
    });

    return res.json({
      success: true,
      data: {
        token: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresIn: refreshed.accessTokenExpiresIn,
        refreshTokenExpiresIn: refreshed.refreshTokenExpiresIn,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('Refresh token error:', error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 401 ? error.message : 'Internal server error.',
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

    await authTokenService.revokeRefreshTokensForUser(userId);

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
 * Request a password reset email.
 */
async function requestPasswordReset(req, res) {
  const email = String(req.body?.email || "").trim();

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }

  try {
    const [rows] = await query(
      `SELECT UserID, FullName, Email, IsActive, Status
         FROM Users
        WHERE Email = ?
        LIMIT 1`,
      [email]
    );

    if (rows.length > 0) {
      const user = rows[0];

      if (Number(user.IsActive) === 1 && String(user.Status || "").toLowerCase() === "active") {
        const token = await emailVerificationService.createVerificationToken(
          user.UserID,
          "password_reset"
        );

        try {
          const resetLink = buildPasswordResetLink(token);
          await emailService.sendPasswordResetEmail(
            user.Email,
            user.FullName || user.Email,
            resetLink
          );
        } catch (sendError) {
          await emailVerificationService.deleteVerificationToken?.(token).catch(() => {});
          console.error("Password reset email send failed:", sendError);
        }
      }
    }

    return res.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Request password reset error:", error);

    return res.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  }
}

/**
 * Render the password reset form for a valid token.
 */
async function showPasswordResetPage(req, res) {
  const verificationToken = req.query?.token ? String(req.query.token).trim() : "";

  try {
    if (!verificationToken) {
      return res.status(400).send(getErrorPage("Password reset token is required."));
    }

    const tokenRecord = await emailVerificationService.verifyToken(
      verificationToken,
      "password_reset"
    );

    if (!tokenRecord) {
      return res.status(400).send(
        getErrorPage("Invalid or expired password reset token. Please request a new link from the login page.")
      );
    }

    const user = await emailVerificationService.getUserFromToken(
      verificationToken,
      "password_reset"
    );

    return res.send(
      getPasswordResetPage({
        token: verificationToken,
        fullName: user?.FullName || "",
        email: user?.Email || "",
      })
    );
  } catch (error) {
    console.error("Show password reset page error:", error);
    return res.status(500).send(getErrorPage("Unable to load the password reset page."));
  }
}

/**
 * Update the user's password after validating a reset token.
 */
async function completePasswordReset(req, res) {
  const token = String(req.body?.token || req.query?.token || "").trim();
  const newPassword = String(req.body?.newPassword || "");
  const confirmPassword = String(req.body?.confirmPassword || "");
  
  // Detect if this is a JSON request (from fetch) or form submission
  const isJsonRequest = req.get("Content-Type")?.includes("application/json");

  if (!token) {
    if (isJsonRequest) {
      return res.status(400).json({ message: "Password reset token is required." });
    }
    return res.status(400).send(getErrorPage("Password reset token is required."));
  }

  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    if (isJsonRequest) {
      return res.status(400).json({ message: "New password must be between 8 and 128 characters." });
    }
    return res.status(400).send(
      getPasswordResetPage({
        token,
        errorMessage: "New password must be between 8 and 128 characters.",
      })
    );
  }

  if (newPassword !== confirmPassword) {
    if (isJsonRequest) {
      return res.status(400).json({ message: "Passwords do not match." });
    }
    return res.status(400).send(
      getPasswordResetPage({
        token,
        errorMessage: "Passwords do not match.",
      })
    );
  }

  try {
    const tokenRecord = await emailVerificationService.verifyToken(token, "password_reset");

    if (!tokenRecord) {
      if (isJsonRequest) {
        return res.status(400).json({ message: "Invalid or expired password reset token. Please request a new link from the login page." });
      }
      return res.status(400).send(
        getErrorPage("Invalid or expired password reset token. Please request a new link from the login page.")
      );
    }

    const user = await emailVerificationService.getUserFromToken(token, "password_reset");

    if (!user) {
      if (isJsonRequest) {
        return res.status(404).json({ message: "User account not found for this reset token." });
      }
      return res.status(404).send(getErrorPage("User account not found for this reset token."));
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const [result] = await query("UPDATE Users SET PasswordHash = ? WHERE UserID = ?", [
      passwordHash,
      tokenRecord.UserID,
    ]);

    if (result.affectedRows === 0) {
      if (isJsonRequest) {
        return res.status(404).json({ message: "User account not found." });
      }
      return res.status(404).send(getErrorPage("User account not found."));
    }

    await authTokenService.revokeRefreshTokensForUser(tokenRecord.UserID);
    await emailVerificationService.deleteVerificationToken(tokenRecord.TokenID);

    if (isJsonRequest) {
      return res.json({ 
        success: true,
        message: "Password updated successfully. All your active sessions have been signed out.",
        user: {
          UserID: user.UserID,
          Email: user.Email,
          FullName: user.FullName,
        }
      });
    }
    return res.send(getPasswordResetSuccessPage(user));
  } catch (error) {
    console.error("Complete password reset error:", error);
    if (isJsonRequest) {
      return res.status(500).json({ message: "Failed to reset password. Please try again later." });
    }
    return res.status(500).send(getErrorPage("Failed to reset password. Please try again later."));
  }
}

/**
 * Verify email and activate user account
 * Serves an HTML page with verification status
 */
async function verifyEmailAndActivateAccount(req, res) {
  const { token } = req.query;

  try {
    // Trim and validate token
    const verificationToken = token ? String(token).trim() : "";

    if (!verificationToken) {
      return res.status(400).send(getErrorPage("Verification token is required."));
    }

    // Verify token and get token record
    const tokenRecord = await emailVerificationService.verifyToken(
      verificationToken,
      'account_activation'
    );

    if (!tokenRecord) {
      return res.status(400).send(getErrorPage("Invalid or expired verification token. Please request a new one from your email."));
    }

    // Activate user account
    const activatedUser = await emailVerificationService.activateUserAccount(tokenRecord.UserID);

    if (!activatedUser) {
      return res.status(500).send(getErrorPage("Failed to activate account. Please contact support."));
    }

    // Return success page with user info
    return res.send(getSuccessPage(activatedUser));
  } catch (error) {
    console.error("Email verification error:", error);
    return res.status(500).send(getErrorPage("An error occurred while verifying your email. Please try again later."));
  }
}

/**
 * Generate success HTML page for email verification
 */
function getSuccessPage(user) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verified - Sarawak Park Guide Training</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          background: linear-gradient(135deg, #071407 0%, #0a1d0a 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
          overflow: hidden;
          animation: slideUp 0.6s ease-out;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .header {
          background: linear-gradient(135deg, #2E6B4D 0%, #445A4D 100%);
          padding: 40px 20px;
          text-align: center;
          color: #ffffff;
        }
        .header-icon {
          font-size: 60px;
          margin-bottom: 16px;
          display: block;
          animation: checkmark 0.8s ease-out 0.3s both;
        }
        @keyframes checkmark {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .header h1 {
          font-size: 28px;
          font-weight: 800;
          margin: 0;
        }
        .content {
          padding: 40px 30px;
        }
        .title {
          font-size: 22px;
          font-weight: 800;
          color: #20372A;
          margin-bottom: 12px;
          text-align: center;
        }
        .message {
          font-size: 15px;
          color: #445A4D;
          text-align: center;
          line-height: 24px;
          margin-bottom: 28px;
        }
        .user-info {
          background-color: #ECF2E5;
          border: 1px solid #D8E2CF;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 28px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 14px;
        }
        .info-row:last-child {
          margin-bottom: 0;
        }
        .info-label {
          color: #6A7A67;
          font-weight: 600;
        }
        .info-value {
          color: #20372A;
          font-weight: 500;
        }
        .next-steps {
          background-color: #F9FBF7;
          border-left: 4px solid #2E6B4D;
          padding: 16px;
          border-radius: 4px;
          margin-bottom: 24px;
          font-size: 13px;
          color: #445A4D;
          line-height: 20px;
        }
        .next-steps strong {
          color: #20372A;
          display: block;
          margin-bottom: 8px;
        }
        .button-group {
          display: flex;
          gap: 12px;
          flex-direction: column;
        }
        .button {
          padding: 14px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          text-align: center;
        }
        .button-primary {
          background-color: #2E6B4D;
          color: #ffffff;
        }
        .button-primary:hover {
          background-color: #1f4a37;
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(46, 107, 77, 0.3);
        }
        .button-secondary {
          background-color: #F2F5ED;
          color: #2E6B4D;
          border: 1px solid #D8E2CF;
        }
        .button-secondary:hover {
          background-color: #E8EEE3;
        }
        .footer {
          background-color: #F5F5F5;
          border-top: 1px solid #E0E0E0;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="header-icon">✓</span>
          <h1>Email Verified!</h1>
        </div>
        <div class="content">
          <div class="title">Your Account is Now Active</div>
          <p class="message">
            Congratulations! Your email has been verified and your account is ready to use.
          </p>
          
          <div class="user-info">
            <div class="info-row">
              <span class="info-label">Full Name:</span>
              <span class="info-value">${escapeHtml(user.FullName)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Username:</span>
              <span class="info-value">${escapeHtml(user.Username)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${escapeHtml(user.Email)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">Active ✓</span>
            </div>
          </div>

          <div class="next-steps">
            <strong>You can now:</strong>
            Access your training modules<br>
            Complete assessments and earn badges<br>
            Track your progress and learn at your own pace
          </div>

          <div class="button-group">
            <a href="https://innopappserver.xyz" class="button button-primary">Go to Training Portal</a>
            <a href="javascript:history.back()" class="button button-secondary">Go Back</a>
          </div>
        </div>
        <div class="footer">
          <strong>Sarawak Forestry Corporation</strong><br>
          Park Guide Training & Qualification Program<br>
          <span style="display: block; margin-top: 8px; opacity: 0.7;">© 2026 All rights reserved</span>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Render the password reset form.
 */
function getPasswordResetPage({ token, fullName = "", email = "", errorMessage = "" }) {
  const greetingName = fullName ? escapeHtml(fullName) : "there";
  const encodedToken = escapeHtml(token || "");
  const encodedEmail = email ? escapeHtml(email) : "your account email";
  const errorMarkup = errorMessage
    ? `<div class="error">${escapeHtml(errorMessage)}</div>`
    : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Password - Sarawak Park Guide Training</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          background: linear-gradient(135deg, #071407 0%, #0a1d0a 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 520px;
          width: 100%;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #2E6B4D 0%, #445A4D 100%);
          padding: 36px 20px;
          text-align: center;
          color: #ffffff;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 800;
          margin: 0;
        }
        .content {
          padding: 34px 28px 30px;
        }
        .title {
          font-size: 22px;
          font-weight: 800;
          color: #20372A;
          margin-bottom: 12px;
          text-align: center;
        }
        .message {
          font-size: 15px;
          color: #445A4D;
          text-align: center;
          line-height: 24px;
          margin-bottom: 24px;
        }
        .account-box {
          background-color: #ECF2E5;
          border: 1px solid #D8E2CF;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 22px;
          color: #20372A;
          font-size: 13px;
        }
        .error {
          background: #FDECEC;
          color: #A12626;
          border: 1px solid #F3C1C1;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 18px;
          font-size: 13px;
          line-height: 18px;
        }
        .field {
          margin-bottom: 14px;
        }
        .field label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #20372A;
          margin-bottom: 8px;
        }
        .field input {
          width: 100%;
          padding: 14px 14px;
          border-radius: 10px;
          border: 1px solid #D8E2CF;
          font-size: 15px;
          color: #20372A;
          outline: none;
        }
        .field input:focus {
          border-color: #2E6B4D;
          box-shadow: 0 0 0 3px rgba(46, 107, 77, 0.12);
        }
        .button {
          width: 100%;
          border: none;
          border-radius: 10px;
          padding: 14px 18px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          background: #2E6B4D;
          color: #ffffff;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          margin-top: 6px;
        }
        .button:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(46, 107, 77, 0.2);
        }
        .security-note {
          background-color: #F9FBF7;
          border-left: 4px solid #2E6B4D;
          padding: 14px 16px;
          border-radius: 6px;
          margin-top: 18px;
          font-size: 13px;
          color: #445A4D;
          line-height: 20px;
        }
        .footer {
          text-align: center;
          padding-top: 12px;
          color: #6A7A67;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Password</h1>
        </div>
        <div class="content">
          <div class="title">Set a New Password</div>
          <p class="message">
            Hello ${greetingName}, choose a strong new password for ${encodedEmail}.
          </p>

          <div class="account-box">
            This reset link is valid for one use only. If you did not request it, you can close this page.
          </div>

          ${errorMarkup}
          <form method="POST" action="/api/v1/auth/reset-password">
            <input type="hidden" id="tokenField" name="token" value="${encodedToken}" />
            <div class="field">
              <label for="newPassword">New Password</label>
              <input id="newPassword" name="newPassword" type="password" minlength="8" maxlength="128" required />
            </div>
            <div class="field">
              <label for="confirmPassword">Confirm New Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" minlength="8" maxlength="128" required />
            </div>
            <button class="button" id="submitBtn" type="submit">Update Password</button>
          </form>

          <div class="security-note">
            Your active login sessions will be signed out after the password changes.
          </div>

          <div class="footer" style="margin-top: 18px;">
            Return to the app after you finish resetting your password.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Render the password reset success page.
 */
function getPasswordResetSuccessPage(user) {
  const displayName = user?.FullName ? escapeHtml(user.FullName) : "Your account";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Updated - Sarawak Park Guide Training</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          background: linear-gradient(135deg, #071407 0%, #0a1d0a 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #2E6B4D 0%, #445A4D 100%);
          padding: 40px 20px;
          text-align: center;
          color: #ffffff;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 800;
          margin: 0;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .title {
          font-size: 22px;
          font-weight: 800;
          color: #20372A;
          margin-bottom: 12px;
        }
        .message {
          font-size: 15px;
          color: #445A4D;
          line-height: 24px;
          margin-bottom: 24px;
        }
        .button-group {
          display: flex;
          gap: 12px;
          flex-direction: column;
        }
        .button {
          padding: 14px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          text-align: center;
        }
        .button-primary {
          background-color: #2E6B4D;
          color: #ffffff;
        }
        .button-primary:hover {
          background-color: #1f4a37;
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(46, 107, 77, 0.3);
        }
        .button-secondary {
          background-color: #F2F5ED;
          color: #2E6B4D;
          border: 1px solid #D8E2CF;
        }
        .button-secondary:hover {
          background-color: #E8EEE3;
        }
        .footer {
          background-color: #F5F5F5;
          border-top: 1px solid #E0E0E0;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Updated</h1>
        </div>
        <div class="content">
          <div class="title">${displayName} is Secured Again</div>
          <p class="message">
            Your password has been updated successfully. You can now return to the training portal and sign in with your new password.
          </p>

          <div class="button-group">
            <a href="https://innopappserver.xyz" class="button button-primary">Go to Training Portal</a>
            <a href="javascript:history.back()" class="button button-secondary">Go Back</a>
          </div>
        </div>
        <div class="footer">
          <strong>Sarawak Forestry Corporation</strong><br>
          Park Guide Training & Qualification Program
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate error HTML page for email verification
 */
function getErrorPage(errorMessage) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Failed - Sarawak Park Guide Training</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          background: linear-gradient(135deg, #071407 0%, #0a1d0a 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
          overflow: hidden;
          animation: slideUp 0.6s ease-out;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .header {
          background: linear-gradient(135deg, #C73737 0%, #9d1f1f 100%);
          padding: 40px 20px;
          text-align: center;
          color: #ffffff;
        }
        .header-icon {
          font-size: 60px;
          margin-bottom: 16px;
          display: block;
          animation: shake 0.8s ease-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .header h1 {
          font-size: 28px;
          font-weight: 800;
          margin: 0;
        }
        .content {
          padding: 40px 30px;
        }
        .title {
          font-size: 22px;
          font-weight: 800;
          color: #20372A;
          margin-bottom: 12px;
          text-align: center;
        }
        .message {
          font-size: 15px;
          color: #445A4D;
          text-align: center;
          line-height: 24px;
          margin-bottom: 28px;
        }
        .error-box {
          background-color: #fdeaea;
          border: 1px solid #f5c2c7;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          font-size: 14px;
          color: #721c24;
          line-height: 20px;
        }
        .help-section {
          background-color: #F9FBF7;
          border-left: 4px solid #6A7A67;
          padding: 16px;
          border-radius: 4px;
          margin-bottom: 24px;
          font-size: 13px;
          color: #445A4D;
          line-height: 20px;
        }
        .help-section strong {
          color: #20372A;
          display: block;
          margin-bottom: 8px;
        }
        .button-group {
          display: flex;
          gap: 12px;
          flex-direction: column;
        }
        .button {
          padding: 14px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          text-align: center;
        }
        .button-primary {
          background-color: #656D4A;
          color: #ffffff;
        }
        .button-primary:hover {
          background-color: #4d5239;
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(101, 109, 74, 0.3);
        }
        .button-secondary {
          background-color: #F2F5ED;
          color: #656D4A;
          border: 1px solid #D8E2CF;
        }
        .button-secondary:hover {
          background-color: #E8EEE3;
        }
        .footer {
          background-color: #F5F5F5;
          border-top: 1px solid #E0E0E0;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="header-icon">✕</span>
          <h1>Verification Failed</h1>
        </div>
        <div class="content">
          <div class="title">Unable to Verify Your Email</div>
          <p class="message">
            We encountered an issue while trying to verify your account.
          </p>
          
          <div class="error-box">
            ${escapeHtml(errorMessage)}
          </div>

          <div class="help-section">
            <strong>What you can do:</strong>
            • Check that you're using the correct link from your email<br>
            • Verify links expire after 7 days - request a new one if needed<br>
            • Contact support if the problem persists
          </div>

          <div class="button-group">
            <a href="https://innopappserver.xyz" class="button button-primary">Go to Training Portal</a>
            <a href="javascript:history.back()" class="button button-secondary">Go Back</a>
          </div>
        </div>
        <div class="footer">
          <strong>Sarawak Forestry Corporation</strong><br>
          Park Guide Training & Qualification Program<br>
          <span style="display: block; margin-top: 8px; opacity: 0.7;">© 2026 All rights reserved</span>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Escape HTML special characters to prevent injection attacks
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

module.exports = {
  loginUser,
  refreshToken,
  getUserProfile,
  updateUserProfile,
  updateUserProfileImage,
  changeUserPassword,
  requestPasswordReset,
  showPasswordResetPage,
  completePasswordReset,
  verifyEmailAndActivateAccount,
};
