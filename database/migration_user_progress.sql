-- Migration: Add user_progress table for tracking module reading progress
-- Purpose: Store user's reading progress for each module, including visited sections and overall progress percentage

-- Create user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  moduleId INT UNSIGNED NOT NULL,
  visitedSectionIds JSON DEFAULT '[]' COMMENT 'Array of visited section/subsection IDs',
  progressPercent INT DEFAULT 0 COMMENT 'Overall progress percentage (0-100)',
  lastSectionId VARCHAR(100) NULL COMMENT 'Last read section ID for resume functionality',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_module (userId, moduleId),
  FOREIGN KEY (userId) REFERENCES Users(UserID) ON DELETE CASCADE,
  FOREIGN KEY (moduleId) REFERENCES Modules(ModuleID) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_moduleId (moduleId),
  INDEX idx_user_module (userId, moduleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index for efficient queries
ALTER TABLE user_progress ADD INDEX idx_updated_at (updatedAt);
