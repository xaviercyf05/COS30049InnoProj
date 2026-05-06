-- Migration: Add badge validity and linked module support
-- Purpose: Support badge validity tracking and module-to-badge linking

-- Add IsValid column (for badge validity status)
ALTER TABLE Badges
ADD COLUMN IsValid TINYINT(1) NOT NULL DEFAULT 1 AFTER IsActive,
ADD COLUMN ExpiryDate DATETIME NULL AFTER IsValid,
ADD COLUMN LinkedModuleID INT UNSIGNED NULL AFTER ExpiryDate,
ADD CONSTRAINT fk_badges_linked_module FOREIGN KEY (LinkedModuleID) REFERENCES Modules (ModuleID) ON DELETE SET NULL;

-- Create index for LinkedModuleID to speed up lookups
CREATE INDEX idx_badges_linked_module ON Badges(LinkedModuleID);

-- Verify migration
SELECT COUNT(*) as badge_count FROM Badges;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Badges' ORDER BY ORDINAL_POSITION;
