-- Migration: Move badge-module relation to junction table
-- Purpose: Support multi-module badge linking and keep validity fields

SET @has_is_valid := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'Badges'
		AND COLUMN_NAME = 'IsValid'
);

SET @add_is_valid_sql := IF(
	@has_is_valid = 0,
	'ALTER TABLE Badges ADD COLUMN IsValid TINYINT(1) NOT NULL DEFAULT 1 AFTER IsActive',
	'SELECT 1'
);
PREPARE stmt_add_is_valid FROM @add_is_valid_sql;
EXECUTE stmt_add_is_valid;
DEALLOCATE PREPARE stmt_add_is_valid;

SET @has_validity_months := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'Badges'
		AND COLUMN_NAME = 'ValidityMonths'
);

SET @add_validity_months_sql := IF(
	@has_validity_months = 0,
	'ALTER TABLE Badges ADD COLUMN ValidityMonths INT UNSIGNED NULL AFTER IsValid',
	'SELECT 1'
);
PREPARE stmt_add_validity_months FROM @add_validity_months_sql;
EXECUTE stmt_add_validity_months;
DEALLOCATE PREPARE stmt_add_validity_months;

SET @has_expiry_date := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'Badges'
		AND COLUMN_NAME = 'ExpiryDate'
);

SET @add_expiry_date_sql := IF(
	@has_expiry_date = 0,
	'ALTER TABLE Badges ADD COLUMN ExpiryDate DATETIME NULL AFTER ValidityMonths',
	'SELECT 1'
);
PREPARE stmt_add_expiry_date FROM @add_expiry_date_sql;
EXECUTE stmt_add_expiry_date;
DEALLOCATE PREPARE stmt_add_expiry_date;

CREATE TABLE IF NOT EXISTS BadgeLinkedModules (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill legacy single-link data if LinkedModuleID exists
SET @has_linked_module_col := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'Badges'
		AND COLUMN_NAME = 'LinkedModuleID'
);

SET @backfill_sql := IF(
	@has_linked_module_col > 0,
	'INSERT IGNORE INTO BadgeLinkedModules (BadgeID, ModuleID) SELECT BadgeID, LinkedModuleID FROM Badges WHERE LinkedModuleID IS NOT NULL',
	'SELECT 1'
);
PREPARE stmt_backfill FROM @backfill_sql;
EXECUTE stmt_backfill;
DEALLOCATE PREPARE stmt_backfill;

-- Drop legacy FK and index only if they exist
SET @has_old_fk := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
	WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'Badges'
		AND CONSTRAINT_NAME = 'fk_badges_linked_module'
);

SET @drop_old_fk_sql := IF(
	@has_old_fk > 0,
	'ALTER TABLE Badges DROP FOREIGN KEY fk_badges_linked_module',
	'SELECT 1'
);
PREPARE stmt_drop_fk FROM @drop_old_fk_sql;
EXECUTE stmt_drop_fk;
DEALLOCATE PREPARE stmt_drop_fk;

SET @has_old_index := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'Badges'
		AND INDEX_NAME = 'idx_badges_linked_module'
);

SET @drop_old_index_sql := IF(
	@has_old_index > 0,
	'DROP INDEX idx_badges_linked_module ON Badges',
	'SELECT 1'
);
PREPARE stmt_drop_idx FROM @drop_old_index_sql;
EXECUTE stmt_drop_idx;
DEALLOCATE PREPARE stmt_drop_idx;

-- Optional cleanup: fully switch to junction table by dropping legacy column
SET @drop_old_column_sql := IF(
	@has_linked_module_col > 0,
	'ALTER TABLE Badges DROP COLUMN LinkedModuleID',
	'SELECT 1'
);
PREPARE stmt_drop_col FROM @drop_old_column_sql;
EXECUTE stmt_drop_col;
DEALLOCATE PREPARE stmt_drop_col;

-- Verify migration
SELECT COUNT(*) AS badge_count FROM Badges;
SELECT COUNT(*) AS badge_module_links FROM BadgeLinkedModules;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
	AND TABLE_NAME = 'Badges'
ORDER BY ORDINAL_POSITION;
