-- Multi-Assessment System Database Migration
-- This migration adds support for multiple unique assessments per module with badge linking

-- ===== 1. Update Assessments Table =====
ALTER TABLE Assessments 
ADD COLUMN IF NOT EXISTS DurationMinutes INT UNSIGNED DEFAULT 120 AFTER PassingScore,
ADD COLUMN IF NOT EXISTS QuestionCount INT UNSIGNED DEFAULT 0 AFTER DurationMinutes,
ADD COLUMN IF NOT EXISTS BadgeID INT UNSIGNED NULL AFTER QuestionCount,
ADD COLUMN IF NOT EXISTS CreatedBy INT UNSIGNED NULL AFTER BadgeID,
ADD COLUMN IF NOT EXISTS CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER CreatedBy,
ADD COLUMN IF NOT EXISTS UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER CreatedAt,
ADD CONSTRAINT fk_assessments_badge FOREIGN KEY (BadgeID) REFERENCES Badges (BadgeID) ON DELETE SET NULL,
ADD CONSTRAINT fk_assessments_created_by FOREIGN KEY (CreatedBy) REFERENCES Users (UserID) ON DELETE SET NULL;

-- Create index for badge lookups
CREATE INDEX IF NOT EXISTS idx_assessments_badge ON Assessments(BadgeID);
CREATE INDEX IF NOT EXISTS idx_assessments_module ON Assessments(ModuleID);

-- ===== 2. Update AssessmentQuestions Table =====
ALTER TABLE AssessmentQuestions 
ADD COLUMN IF NOT EXISTS Topic VARCHAR(255) DEFAULT 'General' AFTER QuestionType,
ADD COLUMN IF NOT EXISTS CorrectAnswer TEXT AFTER Topic,
ADD COLUMN IF NOT EXISTS Explanation TEXT AFTER CorrectAnswer,
ADD COLUMN IF NOT EXISTS CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER Explanation,
ADD COLUMN IF NOT EXISTS UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER CreatedAt;

-- Create index for assessment lookup
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment ON AssessmentQuestions(AssessmentID);

-- ===== 3. Update AssessmentOptions Table =====
-- Rename OptionText to OptionText if not already done
ALTER TABLE AssessmentOptions 
MODIFY COLUMN OptionText TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER IsCorrect;

-- ===== 4. Update AssessmentAttempts Table =====
ALTER TABLE AssessmentAttempts 
ADD COLUMN IF NOT EXISTS TimeUsedSeconds INT UNSIGNED DEFAULT 0 AFTER SubmittedAt,
ADD COLUMN IF NOT EXISTS Answers JSON AFTER TimeUsedSeconds,
ADD COLUMN IF NOT EXISTS UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER Answers,
MODIFY COLUMN Score DECIMAL(5,2) NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON AssessmentAttempts(AssessmentID);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user ON AssessmentAttempts(UserID);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user_assessment ON AssessmentAttempts(UserID, AssessmentID);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_submitted ON AssessmentAttempts(SubmittedAt);

-- ===== 5. Create Badge-Assessment Mapping Table (Optional - for future N:M relationships) =====
CREATE TABLE IF NOT EXISTS BadgeAssessmentMapping (
  MappingID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  BadgeID INT UNSIGNED NOT NULL,
  AssessmentID INT UNSIGNED NOT NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_badge_assessment_mapping (BadgeID, AssessmentID),
  CONSTRAINT fk_mapping_badge FOREIGN KEY (BadgeID) REFERENCES Badges (BadgeID) ON DELETE CASCADE,
  CONSTRAINT fk_mapping_assessment FOREIGN KEY (AssessmentID) REFERENCES Assessments (AssessmentID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_badge_assessment_mapping_badge ON BadgeAssessmentMapping(BadgeID);
CREATE INDEX IF NOT EXISTS idx_badge_assessment_mapping_assessment ON BadgeAssessmentMapping(AssessmentID);

-- ===== 6. Data Migration (set QuestionCount for existing assessments) =====
UPDATE Assessments a 
SET QuestionCount = (
  SELECT COUNT(*) FROM AssessmentQuestions aq 
  WHERE aq.AssessmentID = a.AssessmentID
);

-- ===== 7. Ensure foreign key constraints are enabled =====
SET FOREIGN_KEY_CHECKS = 1;
