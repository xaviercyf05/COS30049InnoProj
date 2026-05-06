-- Migration: add manual module completion tracking for admin-issued badge flow
CREATE TABLE IF NOT EXISTS ModuleCompletions (
  ModuleCompletionID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  ModuleID INT UNSIGNED NOT NULL,
  AssessmentID INT UNSIGNED NULL,
  CompletedBy INT UNSIGNED NULL,
  CompletedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_module_completions_user_module (UserID, ModuleID),
  CONSTRAINT fk_module_completions_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE,
  CONSTRAINT fk_module_completions_module FOREIGN KEY (ModuleID) REFERENCES Modules (ModuleID) ON DELETE CASCADE,
  CONSTRAINT fk_module_completions_assessment FOREIGN KEY (AssessmentID) REFERENCES Assessments (AssessmentID) ON DELETE SET NULL,
  CONSTRAINT fk_module_completions_completed_by FOREIGN KEY (CompletedBy) REFERENCES Users (UserID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;