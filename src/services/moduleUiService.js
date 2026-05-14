const { query } = require("../config/db");

const FALLBACK_MODULE_IMAGES = [
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
  "https://imgs.mongabay.com/wp-content/uploads/sites/20/2018/03/09165734/20171123-153037-4-2.jpg",
  "https://mongabay-images.s3.amazonaws.com/780/malaysia/sabah_sepilok_0337.jpg",
  "https://gofbonline.com/wp-content/uploads/2017/06/sustainability-sarawak-banner.jpg",
  "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
];

let moduleUiSchemaPromise;

async function ensureModuleUiSchema() {
  if (!moduleUiSchemaPromise) {
    moduleUiSchemaPromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS ModuleUiMeta (
          ModuleID INT UNSIGNED NOT NULL PRIMARY KEY,
          CoverImageUrl VARCHAR(500) NULL,
          Summary TEXT NULL,
          UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_module_ui_meta_module
            FOREIGN KEY (ModuleID)
            REFERENCES Modules (ModuleID)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );

      const [summaryColumnRows] = await query(
        `SELECT COUNT(*) AS columnCount
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'ModuleUiMeta'
            AND COLUMN_NAME = 'Summary'`
      );

      if (!summaryColumnRows.length || Number(summaryColumnRows[0].columnCount || 0) === 0) {
        await query(
          `ALTER TABLE ModuleUiMeta
             ADD COLUMN Summary TEXT NULL AFTER CoverImageUrl`
        );
      }

      await query(
        `UPDATE ModuleUiMeta
            SET CoverImageUrl = NULL
          WHERE CoverImageUrl IS NOT NULL
            AND (
              LOWER(CoverImageUrl) LIKE 'blob:%'
              OR LOWER(CoverImageUrl) LIKE 'data:%'
              OR LOWER(CoverImageUrl) LIKE 'file:%'
            )`
      );
    })().catch((error) => {
      moduleUiSchemaPromise = null;
      throw error;
    });
  }

  return moduleUiSchemaPromise;
}

async function getDefaultQualificationId() {
  const [existingQualifications] = await query(
    "SELECT QualificationID FROM Qualifications ORDER BY QualificationID ASC LIMIT 1"
  );

  if (existingQualifications.length > 0) {
    return existingQualifications[0].QualificationID;
  }

  const [insertResult] = await query(
    "INSERT INTO Qualifications (QualificationName, Status) VALUES (?, 'Active')",
    ["General Training"]
  );

  return insertResult.insertId;
}

function normalizeModuleCoverImageUrl(coverImageUrl) {
  const normalizedCover =
    typeof coverImageUrl === "string" ? coverImageUrl.trim().replace(/\\/g, "/") : "";

  if (!normalizedCover) {
    return "";
  }

  if (/^(blob:|data:|file:)/i.test(normalizedCover)) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedCover)) {
    return normalizedCover;
  }

  if (/^\/uploads\/module-covers\/[a-zA-Z0-9._-]+$/i.test(normalizedCover)) {
    return normalizedCover;
  }

  if (/^uploads\/module-covers\/[a-zA-Z0-9._-]+$/i.test(normalizedCover)) {
    return `/${normalizedCover}`;
  }

  return "";
}

function resolveModuleCoverImage(moduleId, coverImageUrl) {
  const normalizedCover = normalizeModuleCoverImageUrl(coverImageUrl);

  if (normalizedCover.length > 0) {
    return normalizedCover;
  }

  const safeIndex = Math.max(0, Number(moduleId) - 1) % FALLBACK_MODULE_IMAGES.length;
  return FALLBACK_MODULE_IMAGES[safeIndex];
}

module.exports = {
  ensureModuleUiSchema,
  getDefaultQualificationId,
  normalizeModuleCoverImageUrl,
  resolveModuleCoverImage,
};
