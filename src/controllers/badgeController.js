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

async function addMissingBadgeColumns() {
  const [columns] = await query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Badges'`
  );

  const existingColumns = new Set(columns.map((column) => column.COLUMN_NAME));
  const alterStatements = [];

  if (!existingColumns.has('IsValid')) {
    alterStatements.push('ADD COLUMN IsValid TINYINT(1) NOT NULL DEFAULT 1 AFTER IsActive');
  }

  if (!existingColumns.has('ValidityMonths')) {
    alterStatements.push('ADD COLUMN ValidityMonths INT UNSIGNED NULL AFTER IsValid');
  }

  if (!existingColumns.has('ExpiryDate')) {
    alterStatements.push('ADD COLUMN ExpiryDate DATETIME NULL AFTER ValidityMonths');
  }

  if (alterStatements.length > 0) {
    await query(`ALTER TABLE Badges ${alterStatements.join(', ')}`);
  }

  await query(
    `CREATE TABLE IF NOT EXISTS BadgeLinkedModules (
      BadgeID INT UNSIGNED NOT NULL,
      ModuleID INT UNSIGNED NOT NULL,
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (BadgeID, ModuleID),
      CONSTRAINT fk_badge_linked_modules_badge
        FOREIGN KEY (BadgeID)
        REFERENCES Badges (BadgeID)
        ON DELETE CASCADE,
      CONSTRAINT fk_badge_linked_modules_module
        FOREIGN KEY (ModuleID)
        REFERENCES Modules (ModuleID)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  if (existingColumns.has('LinkedModuleID')) {
    await query(
      `INSERT IGNORE INTO BadgeLinkedModules (BadgeID, ModuleID)
       SELECT BadgeID, LinkedModuleID
         FROM Badges
        WHERE LinkedModuleID IS NOT NULL`
    );
  }
}

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
          IsValid TINYINT(1) NOT NULL DEFAULT 1,
          ValidityMonths INT UNSIGNED NULL,
          ExpiryDate DATETIME NULL,
          CreatedBy INT UNSIGNED NULL,
          CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_badges_created_by
            FOREIGN KEY (CreatedBy)
            REFERENCES Users (UserID)
            ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );

      await addMissingBadgeColumns();

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

function toNullableInt(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeLinkedModuleIds(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.includes(',')
        ? value.split(',')
        : [value]
      : [value];

  const moduleIds = rawValues
    .map((item) => Number.parseInt(String(item).trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);

  return [...new Set(moduleIds)];
}

function parseCsvIntList(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);
}

async function buildLinkedModulesByBadgeIds(badgeIds) {
  const linkedModulesByBadgeId = new Map();

  if (!Array.isArray(badgeIds) || badgeIds.length === 0) {
    return linkedModulesByBadgeId;
  }

  const placeholders = badgeIds.map(() => '?').join(', ');
  const [rows] = await query(
    `SELECT blm.BadgeID, m.ModuleID, m.ModuleTitle
       FROM BadgeLinkedModules blm
       INNER JOIN Modules m ON m.ModuleID = blm.ModuleID
      WHERE blm.BadgeID IN (${placeholders})
      ORDER BY blm.BadgeID ASC, m.ModuleID ASC`,
    badgeIds
  );

  for (const row of rows) {
    if (!linkedModulesByBadgeId.has(row.BadgeID)) {
      linkedModulesByBadgeId.set(row.BadgeID, []);
    }

    linkedModulesByBadgeId.get(row.BadgeID).push({
      moduleId: row.ModuleID,
      moduleTitle: row.ModuleTitle,
    });
  }

  return linkedModulesByBadgeId;
}

async function hydrateBadgesWithLinkedModules(badgeRows) {
  const badgeIds = badgeRows.map((badge) => badge.BadgeID);
  const linkedModulesByBadgeId = await buildLinkedModulesByBadgeIds(badgeIds);

  return badgeRows.map((badge) => ({
    ...badge,
    linkedModules: linkedModulesByBadgeId.get(badge.BadgeID) || [],
  }));
}

function addMonthsToDate(months) {
  if (!Number.isFinite(months) || months <= 0) {
    return null;
  }

  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + months);
  return expiryDate.toISOString().slice(0, 19).replace('T', ' ');
}

function monthsUntilDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const expiryDate = new Date(dateValue);
  if (Number.isNaN(expiryDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMonths = (expiryDate.getFullYear() - now.getFullYear()) * 12 + (expiryDate.getMonth() - now.getMonth());
  return diffMonths >= 0 ? diffMonths : 0;
}

function mapBadgeRow(badge, unlocked = false) {
  const linkedModules = Array.isArray(badge.linkedModules) ? badge.linkedModules : [];
  const linkedModuleIds = linkedModules.map((module) => module.moduleId);
  const linkedModuleNames = linkedModules.map((module) => module.moduleTitle);

  return {
    badgeId: badge.BadgeID,
    id: badge.BadgeID,
    name: badge.BadgeName,
    image: badge.IconUrl || DEFAULT_BADGE_ICON,
    iconUrl: badge.IconUrl || DEFAULT_BADGE_ICON,
    unlocked,
    unlockThreshold: Number(badge.UnlockThreshold || 0),
    isValid: badge.IsValid === undefined ? true : Number(badge.IsValid) === 1,
    validity: badge.IsValid === undefined ? true : Number(badge.IsValid) === 1,
    validityMonths:
      badge.ValidityMonths === undefined || badge.ValidityMonths === null
        ? monthsUntilDate(badge.ExpiryDate)
        : Number(badge.ValidityMonths),
    expiryDate: badge.ExpiryDate || null,
    linkedModuleId: linkedModuleIds.length > 0 ? linkedModuleIds[0] : null,
    linkedModuleID: linkedModuleIds.length > 0 ? linkedModuleIds[0] : null,
    linkedModuleIds,
    linkedModuleNames,
    linkedModuleName: linkedModuleNames.length > 0 ? linkedModuleNames.join(', ') : null,
    linkedModules,
  };
}

async function syncBadgeModules(badgeId, linkedModuleIds) {
  await query('DELETE FROM BadgeLinkedModules WHERE BadgeID = ?', [badgeId]);

  if (!Array.isArray(linkedModuleIds) || linkedModuleIds.length === 0) {
    return null;
  }

  for (const moduleId of linkedModuleIds) {
    await query(
      `INSERT IGNORE INTO BadgeLinkedModules (BadgeID, ModuleID)
       VALUES (?, ?)`,
      [badgeId, moduleId]
    );
  }

  return linkedModuleIds;
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
      `SELECT BadgeID, BadgeName, IconUrl, UnlockThreshold, IsValid, ValidityMonths, ExpiryDate
         FROM Badges
        WHERE IsActive = 1
        ORDER BY UnlockThreshold ASC, BadgeID ASC`
    );

    const hydratedBadges = await hydrateBadgesWithLinkedModules(badges);

    return res.json({
      success: true,
      data: hydratedBadges.map((badge) =>
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
      `SELECT BadgeID, BadgeName, IconUrl, UnlockThreshold, IsActive, IsValid, ValidityMonths, ExpiryDate
         FROM Badges
        ORDER BY BadgeID ASC`
    );

    const hydratedBadges = await hydrateBadgesWithLinkedModules(badges);

    return res.json({
      success: true,
      data: hydratedBadges
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
    const isValid = req.body.isValid !== undefined ? (Number(req.body.isValid) === 1 ? 1 : 0) : 1;
    const validityMonths = toNullableInt(req.body.validityMonths ?? req.body.validity ?? req.body.validityMonth);
    const expiryDate = req.body.expiryDate || addMonthsToDate(validityMonths);
    const linkedModuleIds = normalizeLinkedModuleIds(req.body.linkedModuleIds);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Badge name is required.",
      });
    }

    const [insertResult] = await query(
      `INSERT INTO Badges (BadgeName, IconUrl, UnlockThreshold, IsActive, IsValid, ValidityMonths, ExpiryDate, CreatedBy)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
      [name, iconUrl || DEFAULT_BADGE_ICON, unlockThreshold, isValid, validityMonths, expiryDate, userId]
    );

    await syncBadgeModules(insertResult.insertId, linkedModuleIds);

    const [rows] = await query(
      `SELECT BadgeID, BadgeName, IconUrl, UnlockThreshold, IsValid, ValidityMonths, ExpiryDate
         FROM Badges
        WHERE BadgeID = ?
        LIMIT 1`,
      [insertResult.insertId]
    );

    const hydratedRows = await hydrateBadgesWithLinkedModules(rows);

    return res.status(201).json({
      success: true,
      message: "Badge created successfully.",
      data: mapBadgeRow(hydratedRows[0]),
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
    const isValid = req.body.isValid !== undefined ? (Number(req.body.isValid) === 1 ? 1 : 0) : 1;
    const validityMonths = toNullableInt(req.body.validityMonths ?? req.body.validity ?? req.body.validityMonth);
    const expiryDate = req.body.expiryDate || addMonthsToDate(validityMonths);
    const linkedModuleIds = normalizeLinkedModuleIds(req.body.linkedModuleIds);

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
              UnlockThreshold = ?,
              IsValid = ?,
              ValidityMonths = ?,
              ExpiryDate = ?
        WHERE BadgeID = ?
          AND IsActive = 1`,
      [name, iconUrl || DEFAULT_BADGE_ICON, unlockThreshold, isValid, validityMonths, expiryDate, badgeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Badge not found.",
      });
    }

    await syncBadgeModules(Number(badgeId), linkedModuleIds);

    const [rows] = await query(
      `SELECT BadgeID, BadgeName, IconUrl, UnlockThreshold, IsValid, ValidityMonths, ExpiryDate
         FROM Badges
        WHERE BadgeID = ?
        LIMIT 1`,
      [badgeId]
    );

    const hydratedRows = await hydrateBadgesWithLinkedModules(rows);

    return res.json({
      success: true,
      message: "Badge updated successfully.",
      data: mapBadgeRow(hydratedRows[0]),
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

async function getBadgesByModule(req, res) {
  try {
    await ensureBadgeSchema();

    const { moduleId } = req.params;

    const [rows] = await query(
      `SELECT b.BadgeID, b.BadgeName, b.IconUrl, b.UnlockThreshold, b.IsValid, b.ValidityMonths, b.ExpiryDate
         FROM BadgeLinkedModules blm
         INNER JOIN Badges b ON b.BadgeID = blm.BadgeID
        WHERE blm.ModuleID = ?
          AND b.IsActive = 1
        ORDER BY b.BadgeID ASC`,
      [moduleId]
    );

    const hydratedRows = await hydrateBadgesWithLinkedModules(rows);

    return res.json({
      success: true,
      data: hydratedRows.map((row) => mapBadgeRow(row, false)),
    });
  } catch (error) {
    console.error('Get badges by module error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch badges for module.',
    });
  }
}

module.exports = {
  getUserBadges,
  getAllBadges,
  createBadge,
  updateBadge,
  deleteBadge,
  getBadgesByModule,
};
