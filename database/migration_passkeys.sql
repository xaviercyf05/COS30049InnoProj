-- Passkey authentication migration

CREATE TABLE IF NOT EXISTS PasskeyCredentials (
  PasskeyCredentialID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  CredentialID VARCHAR(255) NOT NULL UNIQUE,
  UserID INT UNSIGNED NOT NULL,
  PublicKey LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  Counter INT UNSIGNED NOT NULL DEFAULT 0,
  Transports JSON NULL,
  DeviceName VARCHAR(120) NULL,
  AAGUID VARCHAR(64) NULL,
  BackupEligible TINYINT(1) NOT NULL DEFAULT 0,
  IsDiscoverable TINYINT(1) NOT NULL DEFAULT 1,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  LastUsedAt TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_passkey_credentials_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_passkey_credentials_user ON PasskeyCredentials (UserID, CreatedAt);
CREATE INDEX idx_passkey_credentials_credential ON PasskeyCredentials (CredentialID);