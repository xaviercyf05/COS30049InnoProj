const { query } = require("../config/db");

const DEFAULT_BADGE_ICON =
  "https://cdn-icons-png.flaticon.com/512/16779/16779402.png";

const DEFAULT_BADGES = [
  { name: "Bako National Park", threshold: 20 },
  { name: "Similajau National Park", threshold: 40 },
  { name: "Kubah National Park", threshold: 60 },
  { name: "Gunung Mulu National Park", threshold: 80 },
  { name: "Maludam National Park", threshold: 100 },
];

let badgeSchemaPromise;

async function ensureBadgeSchema() {
  if (!badgeSchemaPromise) {
    badgeSchemaPromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS Badges (
          BadgeID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          BadgeName VARCHAR(160) NOT NULL,
          IconUrl VARCHAR(500) NULL,
          UnlockThreshold INT UNSIGNED NOT NULL DEFAULT 0,
          IsActive TINYINT(1) NOT NULL DEFAULT 1,
          CreatedBy INT UNSIGNED NULL,
          CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_badges_created_by
            FOREIGN KEY (CreatedBy)
            REFERENCES Users (UserID)
            ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );

      const [existingRows] = await query(
        "SELECT BadgeID FROM Badges WHERE IsActive = 1 LIMIT 1"
      );

      if (existingRows.length === 0) {
        for (const badge of DEFAULT_BADGES) {
          await query(
            `INSERT INTO Badges (BadgeName, IconUrl, UnlockThreshold, IsActive)
             VALUES (?, ?, ?, 1)`,
            [badge.name, DEFAULT_BADGE_ICON, badge.threshold]
          );
        }
      }
    })().catch((error) => {
      badgeSchemaPromise = null;
      throw error;
    });
  }

  return badgeSchemaPromise;
}

function toNumberOrDefault(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function mapBadgeRow(badge, unlocked = false) {
  return {
    badgeId: badge.BadgeID,
    id: badge.BadgeID,
    name: badge.BadgeName,
    image: badge.IconUrl || DEFAULT_BADGE_ICON,
    iconUrl: badge.IconUrl || DEFAULT_BADGE_ICON,
    unlocked,
    unlockThreshold: Number(badge.UnlockThreshold || 0),
  };
}

/**
 * User: list available badges and unlocked status.
 */
async function getUserBadges(req, res) {
  try {
    await ensureBadgeSchema();

    const { userId } = req.user;

    const [progressRows] = await query(
      "SELECT Progress FROM Users WHERE UserID = ? LIMIT 1",
      [userId]
    );

    if (progressRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const userProgress = Number(progressRows[0].Progress || 0);

    const [badges] = await query(
      `SELECT BadgeID, BadgeName, IconUrl, UnlockThreshold
         FROM Badges
        WHERE IsActive = 1
        ORDER BY UnlockThreshold ASC, BadgeID ASC`
    );

    return res.json({
      success: true,
      data: badges.map((badge) =>
        mapBadgeRow(badge, userProgress >= Number(badge.UnlockThreshold || 0))
      ),
    });
  } catch (error) {
    console.error("Get user badges error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch badges.",
    });
  }
}

/**
 * Admin: list all badges.
 */
async function getAllBadges(req, res) {
  try {
    await ensureBadgeSchema();

    const [badges] = await query(
      `SELECT BadgeID, BadgeName, IconUrl, UnlockThreshold, IsActive
         FROM Badges
        ORDER BY BadgeID ASC`
    );

    return res.json({
      success: true,
      data: badges
        .filter((badge) => badge.IsActive === 1)
        .map((badge) => mapBadgeRow(badge, false)),
    });
  } catch (error) {
    console.error("Get all badges error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch badge management list.",
    });
  }
}

/**
 * Admin: create a badge.
 */
async function createBadge(req, res) {
  try {
    await ensureBadgeSchema();

    const { userId } = req.user;
    const name = String(req.body.name || req.body.badgeName || "").trim();
    const iconUrl = String(req.body.iconUrl || req.body.image || "").trim();
    const unlockThreshold = toNumberOrDefault(req.body.unlockThreshold, 0);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Badge name is required.",
      });
    }

    const [insertResult] = await query(
      `INSERT INTO Badges (BadgeName, IconUrl, UnlockThreshold, IsActive, CreatedBy)
       VALUES (?, ?, ?, 1, ?)`,
      [name, iconUrl || DEFAULT_BADGE_ICON, unlockThreshold, userId]
    );

    const [rows] = await query(
      `SELECT BadgeID, BadgeName, IconUrl, UnlockThreshold
         FROM Badges
        WHERE BadgeID = ?
        LIMIT 1`,
      [insertResult.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Badge created successfully.",
      data: mapBadgeRow(rows[0]),
    });
  } catch (error) {
    console.error("Create badge error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create badge.",
    });
  }
}

/**
 * Admin: update a badge.
 */
async function updateBadge(req, res) {
  try {
    await ensureBadgeSchema();

    const { badgeId } = req.params;
    const name = String(req.body.name || req.body.badgeName || "").trim();
    const iconUrl = String(req.body.iconUrl || req.body.image || "").trim();
    const unlockThreshold = toNumberOrDefault(req.body.unlockThreshold, 0);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Badge name is required.",
      });
    }

    const [result] = await query(
      `UPDATE Badges
          SET BadgeName = ?,
              IconUrl = ?,
              UnlockThreshold = ?
        WHERE BadgeID = ?
          AND IsActive = 1`,
      [name, iconUrl || DEFAULT_BADGE_ICON, unlockThreshold, badgeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Badge not found.",
      });
    }

    const [rows] = await query(
      `SELECT BadgeID, BadgeName, IconUrl, UnlockThreshold
         FROM Badges
        WHERE BadgeID = ?
        LIMIT 1`,
      [badgeId]
    );

    return res.json({
      success: true,
      message: "Badge updated successfully.",
      data: mapBadgeRow(rows[0]),
    });
  } catch (error) {
    console.error("Update badge error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update badge.",
    });
  }
}

/**
 * Admin: soft-delete a badge.
 */
async function deleteBadge(req, res) {
  try {
    await ensureBadgeSchema();

    const { badgeId } = req.params;

    const [result] = await query(
      "UPDATE Badges SET IsActive = 0 WHERE BadgeID = ? AND IsActive = 1",
      [badgeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Badge not found.",
      });
    }

    return res.json({
      success: true,
      message: "Badge deleted successfully.",
    });
  } catch (error) {
    console.error("Delete badge error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete badge.",
    });
  }
}

module.exports = {
  getUserBadges,
  getAllBadges,
  createBadge,
  updateBadge,
  deleteBadge,
};
