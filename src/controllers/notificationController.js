const notificationService = require("../services/notificationService");

/**
 * Controller for user notifications and announcements.
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
        id: a.AnnouncementID,
        title: a.Title,
        teaser: String(a.Content || "").length > 95
          ? `${String(a.Content || "").slice(0, 92)}...`
          : String(a.Content || ""),
        fullDesc: a.Content,
        content: a.Content,
        expiryDate: a.ExpiryDate,
        posted: a.ExpiryDate ? `Expires on ${a.ExpiryDate}` : "Recently",
        avatarLabel: (String(a.Title || "").match(/\bL\s*(\d+)\b/i) || [])[1]
          ? `L${String(a.Title || "").match(/\bL\s*(\d+)\b/i)[1]}`
          : "AN",
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

module.exports = {
  getUserNotifications,
  getAnnouncements,
  // getUserSchedules removed
};
