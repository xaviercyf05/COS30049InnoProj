const { query } = require("../config/db");

/**
 * Service for managing user notifications.
 */

/**
 * Create a notification for a user
 */
async function createNotification(userId, title, message) {
  try {
    const [result] = await query(
      "INSERT INTO Notifications (UserID, Title, Message) VALUES (?, ?, ?)",
      [userId, title, message]
    );

    return {
      notificationId: result.insertId,
      userId,
      title,
      message,
      createdAt: new Date(),
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get all notifications for a user
 */
async function getUserNotifications(userId) {
  try {
    const [notifications] = await query(
      `SELECT NotificationID, Title, Message
       FROM Notifications
       WHERE UserID = ?
       ORDER BY NotificationID DESC`,
      [userId]
    );

    return notifications.map((notif) => ({
      notificationId: notif.NotificationID,
      title: notif.Title,
      message: notif.Message,
    }));
  } catch (error) {
    throw error;
  }
}

/**
 * Notification helper functions
 */
const notificationHelpers = {
  /**
   * Notify user upon enrollment in qualification
   */
  async notifyEnrollment(userId, qualificationName) {
    return createNotification(
      userId,
      "Enrollment Confirmation",
      `You have been enrolled in the ${qualificationName} program. Start with Module 1.`
    );
  },

  /**
   * Notify user upon assessment result
   */
  async notifyAssessmentResult(userId, moduleTitle, passed, score) {
    const title = passed ? "Assessment Passed! 🎉" : "Assessment Result";
    const message = passed
      ? `Congratulations! You passed the ${moduleTitle} assessment with a score of ${score}%. You can now unlock the next module.`
      : `You scored ${score}% on the ${moduleTitle} assessment. Keep studying and try again.`;

    return createNotification(userId, title, message);
  },

  /**
   * Notify user of schedule/event
   */
  async notifyScheduleEvent(userId, eventTitle, eventDate) {
    return createNotification(
      userId,
      `Upcoming Event: ${eventTitle}`,
      `You have an event scheduled for ${eventDate}. Please mark your calendar.`
    );
  },

  /**
   * Notify user about new announcement
   */
  async notifyAnnouncement(userId, announcementTitle) {
    return createNotification(
      userId,
      "New Announcement",
      announcementTitle
    );
  },
};

module.exports = {
  createNotification,
  getUserNotifications,
  notificationHelpers,
};
