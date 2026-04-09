const { query } = require("../config/db");
const notificationService = require("../services/notificationService");

/**
 * Controller for admin management - qualifications, announcements, schedules, users.
 */

/**
 * Create qualification (admin only)
 */
async function createQualification(req, res) {
  try {
    const { name, status = "Active" } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Qualification name is required.",
      });
    }

    const [result] = await query(
      "INSERT INTO Qualifications (QualificationName, Status) VALUES (?, ?)",
      [name, status]
    );

    return res.status(201).json({
      success: true,
      message: "Qualification created successfully.",
      data: {
        qualificationId: result.insertId,
        name,
        status,
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Qualification with this name already exists.",
      });
    }

    console.error("Create qualification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create qualification.",
    });
  }
}

/**
 * Create announcement (admin only)
 */
async function createAnnouncement(req, res) {
  try {
    const { userId } = req.user;
    const { title, content, targetRole, expiryDate } = req.body;

    if (!title || !content || !targetRole) {
      return res.status(400).json({
        success: false,
        message: "Title, content, and target role are required.",
      });
    }

    if (!["Admin", "User", "All"].includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target role. Must be Admin, User, or All.",
      });
    }

    const [result] = await query(
      "INSERT INTO Announcements (Title, Content, TargetRole, ExpiryDate, CreatedBy) VALUES (?, ?, ?, ?, ?)",
      [title, content, targetRole, expiryDate || null, userId]
    );

    // Notify all users of target role
    if (targetRole === "User" || targetRole === "All") {
      const [users] = await query(
        "SELECT UserID FROM Users WHERE RoleID = (SELECT RoleID FROM Roles WHERE RoleTitle = 'User')"
      );

      for (const user of users) {
        await notificationService.notificationHelpers.notifyAnnouncement(
          user.UserID,
          title
        );
      }
    }

    if (targetRole === "Admin" || targetRole === "All") {
      const [admins] = await query(
        "SELECT UserID FROM Users WHERE RoleID = (SELECT RoleID FROM Roles WHERE RoleTitle = 'Admin')"
      );

      for (const admin of admins) {
        await notificationService.notificationHelpers.notifyAnnouncement(
          admin.UserID,
          title
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Announcement created and notified to users.",
      data: {
        announcementId: result.insertId,
        title,
        content,
        targetRole,
      },
    });
  } catch (error) {
    console.error("Create announcement error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create announcement.",
    });
  }
}

/**
 * Create schedule event for a user (admin only)
 */
async function createSchedule(req, res) {
  try {
    const { userId } = req.user;
    const {
      targetUserId,
      qualificationId,
      title,
      description,
      eventDate,
      startTime,
      endTime,
    } = req.body;

    if (
      !targetUserId ||
      !qualificationId ||
      !title ||
      !eventDate ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "User ID, qualification ID, title, date, and times are required.",
      });
    }

    const [result] = await query(
      `INSERT INTO Schedules (UserID, QualificationID, Title, Description, EventDate, StartTime, EndTime)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        targetUserId,
        qualificationId,
        title,
        description || null,
        eventDate,
        startTime,
        endTime,
      ]
    );

    // Notify the user
    await notificationService.notificationHelpers.notifyScheduleEvent(
      targetUserId,
      title,
      eventDate
    );

    return res.status(201).json({
      success: true,
      message: "Schedule created and user notified.",
      data: {
        scheduleId: result.insertId,
        title,
        eventDate,
        startTime,
        endTime,
      },
    });
  } catch (error) {
    console.error("Create schedule error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create schedule.",
    });
  }
}

/**
 * Get all users (admin only)
 */
async function getAllUsers(req, res) {
  try {
    const [users] = await query(
      `SELECT u.UserID, u.Username, u.FullName, u.Email, u.Status, u.IsActive, r.RoleTitle, u.CreatedAt
       FROM Users u
       INNER JOIN Roles r ON r.RoleID = u.RoleID
       ORDER BY u.CreatedAt DESC`
    );

    return res.json({
      success: true,
      data: users.map((u) => ({
        userId: u.UserID,
        username: u.Username,
        fullName: u.FullName,
        email: u.Email,
        role: u.RoleTitle,
        status: u.Status,
        isActive: u.IsActive === 1,
        createdAt: u.CreatedAt,
      })),
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users.",
    });
  }
}

/**
 * Update user status (admin only)
 */
async function updateUserStatus(req, res) {
  try {
    const { targetUserId, status } = req.body;

    if (!targetUserId || !status) {
      return res.status(400).json({
        success: false,
        message: "User ID and status are required.",
      });
    }

    if (!["Active", "Inactive", "Suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be Active, Inactive, or Suspended.",
      });
    }

    await query("UPDATE Users SET Status = ? WHERE UserID = ?", [
      status,
      targetUserId,
    ]);

    return res.json({
      success: true,
      message: `User status updated to ${status}.`,
    });
  } catch (error) {
    console.error("Update user status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user status.",
    });
  }
}

/**
 * Get user enrollment details (admin only)
 */
async function getUserEnrollmentDetails(req, res) {
  try {
    const { userId } = req.params;

    // Get user info
    const [users] = await query(
      "SELECT UserID, Username, FullName, Email FROM Users WHERE UserID = ? LIMIT 1",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = users[0];

    // Get enrollments
    const [enrollments] = await query(
      `SELECT c.CertificateID, c.QualificationID, c.QualificationName, c.Status
       FROM Certificates c
       WHERE c.UserID = ?`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        userId: user.UserID,
        username: user.Username,
        fullName: user.FullName,
        email: user.Email,
        enrollments: enrollments.map((e) => ({
          certificateId: e.CertificateID,
          qualificationId: e.QualificationID,
          qualificationName: e.QualificationName,
          status: e.Status,
        })),
      },
    });
  } catch (error) {
    console.error("Get user enrollment details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch enrollment details.",
    });
  }
}

module.exports = {
  createQualification,
  createAnnouncement,
  createSchedule,
  getAllUsers,
  updateUserStatus,
  getUserEnrollmentDetails,
};
