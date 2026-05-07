const { query } = require("../config/db");

/**
 * Service for handling user module progress tracking
 */

/**
 * Get user's progress for a module
 * @param {number} userId - User ID
 * @param {number} moduleId - Module ID
 * @returns {Promise<Object>} Progress data or null if not found
 */
async function getUserModuleProgress(userId, moduleId) {
  try {
    const [rows] = await query(
      "SELECT id, userId, moduleId, visitedSectionIds, progressPercent, lastSectionId, updatedAt FROM user_progress WHERE userId = ? AND moduleId = ?",
      [userId, moduleId]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      id: rows[0].id,
      userId: rows[0].userId,
      moduleId: rows[0].moduleId,
      visitedSectionIds: rows[0].visitedSectionIds ? JSON.parse(rows[0].visitedSectionIds) : [],
      progressPercent: rows[0].progressPercent || 0,
      lastSectionId: rows[0].lastSectionId,
      updatedAt: rows[0].updatedAt,
    };
  } catch (error) {
    console.error("Error fetching user module progress:", error);
    throw error;
  }
}

/**
 * Save or update user's progress for a module
 * @param {number} userId - User ID
 * @param {number} moduleId - Module ID
 * @param {Array} visitedSectionIds - Array of visited section IDs
 * @param {number} progressPercent - Progress percentage (0-100)
 * @param {string} lastSectionId - Last read section ID (optional)
 * @returns {Promise<Object>} Saved progress data
 */
async function saveUserModuleProgress(userId, moduleId, visitedSectionIds = [], progressPercent = 0, lastSectionId = null) {
  try {
    // Validate progressPercent
    const validProgressPercent = Math.min(100, Math.max(0, Math.round(progressPercent)));

    // Convert array to JSON string
    const visitedSectionIdsJson = JSON.stringify(visitedSectionIds || []);

    // Try to insert or update
    const [result] = await query(
      `INSERT INTO user_progress (userId, moduleId, visitedSectionIds, progressPercent, lastSectionId)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       visitedSectionIds = VALUES(visitedSectionIds),
       progressPercent = VALUES(progressPercent),
       lastSectionId = VALUES(lastSectionId),
       updatedAt = CURRENT_TIMESTAMP`,
      [userId, moduleId, visitedSectionIdsJson, validProgressPercent, lastSectionId]
    );

    // Fetch and return the updated record
    return await getUserModuleProgress(userId, moduleId);
  } catch (error) {
    console.error("Error saving user module progress:", error);
    throw error;
  }
}

/**
 * Calculate progress percentage based on visited sections
 * @param {number} moduleId - Module ID
 * @param {Array} visitedSectionIds - Array of visited section IDs
 * @returns {Promise<number>} Progress percentage
 */
async function calculateProgressPercent(moduleId, visitedSectionIds = []) {
  try {
    // Get total number of sections and subsections for the module
    const [result] = await query(
      `SELECT 
       COUNT(DISTINCT s.SectionID) as totalSections,
       COUNT(DISTINCT ss.SubsectionID) as totalSubsections
       FROM Modules m
       LEFT JOIN Sections s ON s.ModuleID = m.ModuleID
       LEFT JOIN Subsections ss ON ss.SectionID = s.SectionID
       WHERE m.ModuleID = ?`,
      [moduleId]
    );

    if (result.length === 0) {
      return 0;
    }

    const totalSections = result[0].totalSections || 0;
    const totalSubsections = result[0].totalSubsections || 0;
    const totalItems = totalSections + totalSubsections;

    if (totalItems === 0) {
      return 0;
    }

    const visitedCount = visitedSectionIds ? visitedSectionIds.length : 0;
    const progressPercent = Math.round((visitedCount / totalItems) * 100);

    return Math.min(100, progressPercent);
  } catch (error) {
    console.error("Error calculating progress percent:", error);
    return 0;
  }
}

/**
 * Get all user progress records (for admin dashboard)
 * @param {number} limit - Limit number of results
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} Array of progress records
 */
async function getAllUserProgress(limit = 100, offset = 0) {
  try {
    const [rows] = await query(
      `SELECT id, userId, moduleId, visitedSectionIds, progressPercent, lastSectionId, updatedAt
       FROM user_progress
       ORDER BY updatedAt DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      moduleId: row.moduleId,
      visitedSectionIds: row.visitedSectionIds ? JSON.parse(row.visitedSectionIds) : [],
      progressPercent: row.progressPercent || 0,
      lastSectionId: row.lastSectionId,
      updatedAt: row.updatedAt,
    }));
  } catch (error) {
    console.error("Error fetching all user progress:", error);
    throw error;
  }
}

/**
 * Delete user progress for a module
 * @param {number} userId - User ID
 * @param {number} moduleId - Module ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteUserModuleProgress(userId, moduleId) {
  try {
    const [result] = await query(
      "DELETE FROM user_progress WHERE userId = ? AND moduleId = ?",
      [userId, moduleId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error("Error deleting user module progress:", error);
    throw error;
  }
}

module.exports = {
  getUserModuleProgress,
  saveUserModuleProgress,
  calculateProgressPercent,
  getAllUserProgress,
  deleteUserModuleProgress,
};
