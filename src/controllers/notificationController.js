const { query } = require("../config/db");
const notificationService = require("../services/notificationService");

/**
 * Controller for user notifications, announcements, schedules, and certificates.
 */

/**
 * Get user's notifications
 */
async function getUserNotifications(req, res) {
  try {
    const { userId } = req.user;

    const notifications = await notificationService.getUserNotifications(userId);

    return res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications.",
    });
  }
}

/**
 * Get announcements for user's role
 */
async function getAnnouncements(req, res) {
  try {
    const { role } = req.user;

    // Get announcements for user's role or 'All'
    const [announcements] = await query(
      `SELECT AnnouncementID, Title, Content, ExpiryDate
       FROM Announcements
       WHERE TargetRole IN (?, 'All')
       AND (ExpiryDate IS NULL OR ExpiryDate >= CURDATE())
       ORDER BY AnnouncementID DESC`,
      [role]
    );

    return res.json({
      success: true,
      data: announcements.map((a) => ({
        announcementId: a.AnnouncementID,
        title: a.Title,
        content: a.Content,
        expiryDate: a.ExpiryDate,
      })),
    });
  } catch (error) {
    console.error("Get announcements error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcements.",
    });
  }
}

/**
 * Get user's schedules/events
 */
async function getUserSchedules(req, res) {
  try {
    const { userId } = req.user;

    const [schedules] = await query(
      `SELECT ScheduleID, QualificationID, Title, Description, EventDate, StartTime, EndTime
       FROM Schedules
       WHERE UserID = ?
       ORDER BY EventDate ASC`,
      [userId]
    );

    return res.json({
      success: true,
      data: schedules.map((s) => ({
        scheduleId: s.ScheduleID,
        qualificationId: s.QualificationID,
        title: s.Title,
        description: s.Description,
        eventDate: s.EventDate,
        startTime: s.StartTime,
        endTime: s.EndTime,
      })),
    });
  } catch (error) {
    console.error("Get schedules error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch schedules.",
    });
  }
}

/**
 * Get user certificates
 */
async function getUserCertificates(req, res) {
  try {
    const { userId } = req.user;

    const [certificates] = await query(
      `SELECT CertificateID, QualificationID, QualificationName, Status
       FROM Certificates
       WHERE UserID = ?
       ORDER BY CertificateID DESC`,
      [userId]
    );

    return res.json({
      success: true,
      data: certificates.map((c) => ({
        certificateId: c.CertificateID,
        qualificationId: c.QualificationID,
        qualificationName: c.QualificationName,
        status: c.Status,
        isIssued: c.Status === "Issued",
      })),
    });
  } catch (error) {
    console.error("Get certificates error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch certificates.",
    });
  }
}

/**
 * Get certificate details
 */
async function getCertificateDetails(req, res) {
  try {
    const { userId } = req.user;
    const { certificateId } = req.params;

    const [certs] = await query(
      `SELECT CertificateID, UserID, QualificationID, QualificationName, Status
       FROM Certificates
       WHERE CertificateID = ? AND UserID = ?
       LIMIT 1`,
      [certificateId, userId]
    );

    if (certs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found.",
      });
    }

    const cert = certs[0];

    // Get user info for certificate
    const [users] = await query(
      "SELECT FullName, Username FROM Users WHERE UserID = ? LIMIT 1",
      [userId]
    );

    const user = users[0];

    return res.json({
      success: true,
      data: {
        certificateId: cert.CertificateID,
        qualificationName: cert.QualificationName,
        awardedTo: user.FullName || user.Username,
        status: cert.Status,
        issuedDate: cert.Status === "Issued" ? new Date().toISOString() : null,
      },
    });
  } catch (error) {
    console.error("Get certificate details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch certificate details.",
    });
  }
}

module.exports = {
  getUserNotifications,
  getAnnouncements,
  getUserSchedules,
  getUserCertificates,
  getCertificateDetails,
};
