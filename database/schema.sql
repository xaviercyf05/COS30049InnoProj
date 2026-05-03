SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS
  Notifications,
  Badges,
  Announcements,
  Schedules,
  Certificates,
  MaterialProgress,
  LearningMaterials,
  AssessmentAttempts,
  AssessmentOptions,
  AssessmentQuestions,
  Assessments,
  Subtitles,
  ModuleUiMeta,
  Modules,
  RegistrationRequests,
  Users,
  Qualifications,
  Roles,
  posts,
  users,
  roles;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS Roles (
  RoleID TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  RoleTitle VARCHAR(50) NOT NULL UNIQUE,
  Description VARCHAR(255) NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO Roles (RoleTitle, Description) VALUES
  ('Admin', 'Administrator with full access to the system'),
  ('User', 'Regular user with limited access');

CREATE TABLE IF NOT EXISTS Qualifications (
  QualificationID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  QualificationName VARCHAR(150) NOT NULL UNIQUE,
  Status VARCHAR(50) NOT NULL DEFAULT 'Active',
  CONSTRAINT chk_qualifications_status CHECK (Status IN ('Active', 'Inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Users (
  UserID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  Username VARCHAR(100) NOT NULL UNIQUE,
  PasswordHash VARCHAR(255) NOT NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  QualificationID INT UNSIGNED NULL,
  FullName VARCHAR(150) NOT NULL,
  Email VARCHAR(150) NOT NULL UNIQUE,
  ProfileImageUrl VARCHAR(255) NULL,
  Progress INT UNSIGNED NOT NULL DEFAULT 0,
  Status VARCHAR(50) NOT NULL DEFAULT 'Inactive',
  RoleID TINYINT UNSIGNED NOT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (RoleID) REFERENCES Roles (RoleID),
  CONSTRAINT fk_users_qualification FOREIGN KEY (QualificationID) REFERENCES Qualifications (QualificationID),
  CONSTRAINT chk_users_status CHECK (Status IN ('Active', 'Inactive', 'Suspended')),
  CONSTRAINT chk_users_is_active CHECK (IsActive IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE Users AUTO_INCREMENT = 10000000;

INSERT INTO Users (Username, PasswordHash, FullName, Email, RoleID, Status) VALUES
  ('admin', '$2b$12$wu/Z2nMiZ2PkeXBBe8ll0OLidJrkK7tpLIQqjHe909pYajrEyWzEW', 'Default Admin', 'admin@default.com', 1, 'Active');
INSERT INTO Users (Username, PasswordHash, FullName, Email, RoleID, Status) VALUES
  ('user', '$2b$12$JAr3wFTivDH3xBUnbBEJseQOvzGuJPyoxdkK3rXo2ZeBlIe5rhpHq', 'Default User', 'user@default.com', 2, 'Active');

CREATE INDEX idx_users_role_status ON Users (RoleID, Status);

CREATE TABLE IF NOT EXISTS RegistrationRequests (
  RegistrationID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  Username VARCHAR(100) NOT NULL,
  PasswordHash VARCHAR(255) NOT NULL,
  FullName VARCHAR(150) NOT NULL,
  PhoneNumber VARCHAR(50) NOT NULL,
  Email VARCHAR(150) NOT NULL,
  ResumeFilePath VARCHAR(500) NOT NULL,
  ResumeOriginalName VARCHAR(255) NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  ReviewedBy INT UNSIGNED NULL,
  ReviewedAt TIMESTAMP NULL,
  ReviewRemark VARCHAR(255) NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_registration_requests_status CHECK (Status IN ('Pending', 'Approved', 'Rejected')),
  CONSTRAINT fk_registration_requests_reviewer FOREIGN KEY (ReviewedBy) REFERENCES Users (UserID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_registration_requests_status_created ON RegistrationRequests (Status, CreatedAt);

CREATE TABLE IF NOT EXISTS Modules (
  ModuleID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  QualificationID INT UNSIGNED NOT NULL,
  ModuleTitle VARCHAR(160) NOT NULL,
  CONSTRAINT fk_modules_qualification FOREIGN KEY (QualificationID) REFERENCES Qualifications (QualificationID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ModuleUiMeta (
  ModuleID INT UNSIGNED NOT NULL PRIMARY KEY,
  CoverImageUrl VARCHAR(500) NULL,
  UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_module_ui_meta_module FOREIGN KEY (ModuleID) REFERENCES Modules (ModuleID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Subtitles (
  SubTitleID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ModuleID INT UNSIGNED NOT NULL,
  QualificationID INT UNSIGNED NOT NULL,
  ModuleTitle VARCHAR(160) NOT NULL,
  CONSTRAINT fk_subtitles_module FOREIGN KEY (ModuleID) REFERENCES Modules (ModuleID) ON DELETE CASCADE,
  CONSTRAINT fk_subtitles_qualification FOREIGN KEY (QualificationID) REFERENCES Qualifications (QualificationID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Assessments (
  AssessmentID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ModuleID INT UNSIGNED NOT NULL,
  Title VARCHAR(160) NOT NULL,
  PassingScore INT UNSIGNED NOT NULL,
  AttemptLimit INT UNSIGNED NOT NULL DEFAULT 1,
  CONSTRAINT fk_assessments_module FOREIGN KEY (ModuleID) REFERENCES Modules (ModuleID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AssessmentQuestions (
  QuestionID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  AssessmentID INT UNSIGNED NOT NULL,
  QuestionText TEXT NOT NULL,
  QuestionType VARCHAR(50) NOT NULL,
  CONSTRAINT fk_assessment_questions_assessment FOREIGN KEY (AssessmentID) REFERENCES Assessments (AssessmentID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AssessmentOptions (
  OptionID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  QuestionID INT UNSIGNED NOT NULL,
  OptionText TEXT NOT NULL,
  IsCorrect TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_assessment_options_question FOREIGN KEY (QuestionID) REFERENCES AssessmentQuestions (QuestionID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AssessmentAttempts (
  AttemptID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  AssessmentID INT UNSIGNED NOT NULL,
  Score DECIMAL(5,2) NULL,
  Status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  SubmittedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assessment_attempts_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_attempts_assessment FOREIGN KEY (AssessmentID) REFERENCES Assessments (AssessmentID) ON DELETE CASCADE,
  CONSTRAINT chk_assessment_attempts_status CHECK (Status IN ('Pending', 'Submitted', 'Passed', 'Failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS LearningMaterials (
  MaterialID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ModuleID INT UNSIGNED NOT NULL,
  Chapter VARCHAR(160) NOT NULL,
  Title VARCHAR(160) NOT NULL,
  ContentType VARCHAR(50) NOT NULL,
  ContentText LONGTEXT NOT NULL,
  CONSTRAINT fk_learning_materials_module FOREIGN KEY (ModuleID) REFERENCES Modules (ModuleID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS MaterialProgress (
  MaterialProgressID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MaterialID INT UNSIGNED NOT NULL,
  UserID INT UNSIGNED NOT NULL,
  IsCompleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_material_progress (MaterialID, UserID),
  CONSTRAINT fk_material_progress_material FOREIGN KEY (MaterialID) REFERENCES LearningMaterials (MaterialID) ON DELETE CASCADE,
  CONSTRAINT fk_material_progress_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Certificates (
  CertificateID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  QualificationID INT UNSIGNED NOT NULL,
  QualificationName VARCHAR(150) NOT NULL,
  Status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  UNIQUE KEY uq_certificates_user_qualification (UserID, QualificationID),
  CONSTRAINT fk_certificates_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE,
  CONSTRAINT fk_certificates_qualification FOREIGN KEY (QualificationID) REFERENCES Qualifications (QualificationID) ON DELETE CASCADE,
  CONSTRAINT chk_certificates_status CHECK (Status IN ('Pending', 'Issued', 'Revoked'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Schedules (
  ScheduleID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  QualificationID INT UNSIGNED NOT NULL,
  Title VARCHAR(160) NOT NULL,
  Description TEXT NULL,
  EventDate DATE NOT NULL,
  StartTime TIME NOT NULL,
  EndTime TIME NOT NULL,
  CONSTRAINT fk_schedules_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE,
  CONSTRAINT fk_schedules_qualification FOREIGN KEY (QualificationID) REFERENCES Qualifications (QualificationID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Announcements (
  AnnouncementID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  Title VARCHAR(160) NOT NULL,
  Content TEXT NOT NULL,
  TargetRole VARCHAR(50) NOT NULL,
  ExpiryDate DATE NULL,
  CreatedBy INT UNSIGNED NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_announcements_created_by FOREIGN KEY (CreatedBy) REFERENCES Users (UserID) ON DELETE SET NULL,
  CONSTRAINT chk_announcements_target_role CHECK (TargetRole IN ('Admin', 'User', 'All'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Badges (
  BadgeID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  BadgeName VARCHAR(160) NOT NULL,
  IconUrl VARCHAR(500) NULL,
  UnlockThreshold INT UNSIGNED NOT NULL DEFAULT 0,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  CreatedBy INT UNSIGNED NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_badges_created_by FOREIGN KEY (CreatedBy) REFERENCES Users (UserID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Notifications (
  NotificationID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  Title VARCHAR(160) NOT NULL,
  Message TEXT NOT NULL,
  CONSTRAINT fk_notifications_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS EmailVerificationTokens (
  TokenID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  Token VARCHAR(255) NOT NULL UNIQUE,
  TokenType VARCHAR(50) NOT NULL,
  ExpiresAt TIMESTAMP NOT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_verification_tokens_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE,
  CONSTRAINT chk_email_verification_token_type CHECK (TokenType IN ('account_activation', 'password_reset'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_email_verification_tokens_token ON EmailVerificationTokens (Token);
CREATE INDEX idx_email_verification_tokens_user_type ON EmailVerificationTokens (UserID, TokenType);
CREATE INDEX idx_email_verification_tokens_expires ON EmailVerificationTokens (ExpiresAt);