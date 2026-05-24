-- MFA (Multi-Factor Authentication) Migration
-- Adds MFA support to Users table
USE appdb;

ALTER TABLE Users ADD COLUMN MFAEnabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE Users ADD COLUMN MFASecret VARCHAR(255) NULL;
ALTER TABLE Users ADD COLUMN MFAMethod VARCHAR(50) DEFAULT 'TOTP';
ALTER TABLE Users ADD COLUMN BackupCodes JSON NULL;
ALTER TABLE Users ADD COLUMN MFASetupAt TIMESTAMP NULL;

-- Add index for MFA enabled users
CREATE INDEX idx_users_mfa_enabled ON Users (MFAEnabled);

-- Create MFA recovery codes table for better recovery management
CREATE TABLE IF NOT EXISTS MFARecoveryCodes (
  RecoveryCodeID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  RecoveryCode VARCHAR(50) NOT NULL UNIQUE,
  IsUsed TINYINT(1) DEFAULT 0,
  UsedAt TIMESTAMP NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mfa_recovery_codes_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create index for quick lookups
CREATE INDEX idx_mfa_recovery_codes_user ON MFARecoveryCodes (UserID, IsUsed);

-- Audit table for MFA activities
CREATE TABLE IF NOT EXISTS MFAAudit (
  AuditID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  Action VARCHAR(100) NOT NULL,
  Details JSON NULL,
  IPAddress VARCHAR(45) NULL,
  UserAgent VARCHAR(500) NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mfa_audit_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_mfa_audit_user_date ON MFAAudit (UserID, CreatedAt);
