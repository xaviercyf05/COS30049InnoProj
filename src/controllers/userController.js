const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const env = require("../config/env");

/**
 * Controller for user authentication and profile management.
 * Handles login for park guides and admin.
 */

/**
 * Login endpoint for users (park guides) and admin
 */
async function loginUser(req, res) {
  try {
    const { username, password } = req.body;

    const [rows] = await query(
      `SELECT u.UserID, u.Username, u.PasswordHash, u.Status, u.IsActive, r.RoleTitle
       FROM Users u
       INNER JOIN Roles r ON r.RoleID = u.RoleID
       WHERE u.Username = ? AND u.IsActive = 1
       LIMIT 1`,
      [username]
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
    const { userId } = req.user;

    const [rows] = await query(
      `SELECT u.UserID, u.Username, u.FullName, u.Email, u.Status, u.IsActive, u.Progress, u.CreatedAt, r.RoleTitle
       FROM Users u
       INNER JOIN Roles r ON r.RoleID = u.RoleID
       WHERE u.UserID = ?
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = rows[0];

    return res.json({
      success: true,
      data: {
        userId: user.UserID,
        username: user.Username,
        fullName: user.FullName,
        email: user.Email,
        role: user.RoleTitle,
        status: user.Status,
        isActive: user.IsActive === 1,
        progress: user.Progress,
        createdAt: user.CreatedAt,
      },
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
    const { userId } = req.user;
    const { fullName, email } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "Full name and email are required.",
      });
    }

    await query(
      "UPDATE Users SET FullName = ?, Email = ? WHERE UserID = ?",
      [fullName, email, userId]
    );

    return res.json({
      success: true,
      message: "Profile updated successfully.",
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email already in use.",
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

module.exports = {
  loginUser,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
};
