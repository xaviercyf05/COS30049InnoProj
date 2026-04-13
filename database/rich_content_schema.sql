-- Convenience copy of portable module SQL
-- Source of truth: feature_modules/rich-content/db/rich_content_schema.sql

CREATE TABLE IF NOT EXISTS RichContents (
  ContentID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  CreatedByUserID INT UNSIGNED NOT NULL,
  Title VARCHAR(200) NOT NULL,
  ContentHtml LONGTEXT NOT NULL,
  ContentPlainText LONGTEXT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rich_contents_user
    FOREIGN KEY (CreatedByUserID) REFERENCES Users (UserID)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS RichContentAttachments (
  AttachmentID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ContentID INT UNSIGNED NOT NULL,
  OriginalFileName VARCHAR(255) NOT NULL,
  StoredFileName VARCHAR(255) NOT NULL,
  MimeType VARCHAR(120) NOT NULL,
  FileSizeBytes BIGINT UNSIGNED NOT NULL,
  RelativePath VARCHAR(500) NOT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rich_attachments_content
    FOREIGN KEY (ContentID) REFERENCES RichContents (ContentID)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rich_contents_created_by ON RichContents (CreatedByUserID);
CREATE INDEX idx_rich_attachments_content ON RichContentAttachments (ContentID);
