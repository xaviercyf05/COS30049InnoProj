CREATE TABLE IF NOT EXISTS RefreshTokens (
  TokenID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  TokenJti VARCHAR(64) NOT NULL UNIQUE,
  TokenFamily VARCHAR(64) NOT NULL,
  TokenHash CHAR(64) NOT NULL UNIQUE,
  IsRemember TINYINT(1) NOT NULL DEFAULT 0,
  ExpiresAt TIMESTAMP NOT NULL,
  RevokedAt TIMESTAMP NULL,
  ReplacedByTokenID INT UNSIGNED NULL,
  UserAgent VARCHAR(255) NULL,
  IpAddress VARCHAR(64) NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  LastUsedAt TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_tokens_replaced_by FOREIGN KEY (ReplacedByTokenID) REFERENCES RefreshTokens (TokenID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_refresh_tokens_user_family ON RefreshTokens (UserID, TokenFamily);
CREATE INDEX idx_refresh_tokens_expires_at ON RefreshTokens (ExpiresAt);
CREATE INDEX idx_refresh_tokens_revoked_at ON RefreshTokens (RevokedAt);