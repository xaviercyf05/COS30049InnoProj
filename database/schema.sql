SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS
  Notifications,
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
  Modules,
  Users,
  Qualifications,
  Roles,
  posts,
  users,
  roles;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS Roles (
  RoleId TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  RoleTitle VARCHAR(50) NOT NULL UNIQUE,
  Description VARCHAR(255) NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO Roles (RoleTitle, Description)
VALUES ('Admin', 'Administrator with read and write access')
ON DUPLICATE KEY UPDATE Description = VALUES(Description);

CREATE TABLE IF NOT EXISTS Qualifications (
  QualificationId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  QualificationName VARCHAR(150) NOT NULL UNIQUE,
  Status VARCHAR(50) NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Users (
  UserId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  Username VARCHAR(100) NOT NULL UNIQUE,
  PasswordHash VARCHAR(255) NOT NULL,
  IsActive TINYINT(1) NOT NULL DEFAULT 1,
  QualificationId INT UNSIGNED NULL,
  UserQualificationId INT UNSIGNED NULL,
  FullName VARCHAR(150) NOT NULL,
  Email VARCHAR(150) NOT NULL UNIQUE,
  Password VARCHAR(255) NOT NULL,
  Progress INT UNSIGNED NOT NULL DEFAULT 0,
  Status VARCHAR(50) NOT NULL DEFAULT 'Active',
  RoleId TINYINT UNSIGNED NOT NULL,
  Role VARCHAR(50) NOT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (RoleId) REFERENCES Roles (RoleId),
  CONSTRAINT fk_users_qualification FOREIGN KEY (QualificationId) REFERENCES Qualifications (QualificationId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_role_status ON Users (RoleId, Status);

CREATE TABLE IF NOT EXISTS Modules (
  ModuleId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  QualificationId INT UNSIGNED NOT NULL,
  ModuleTitle VARCHAR(160) NOT NULL,
  CONSTRAINT fk_modules_qualification FOREIGN KEY (QualificationId) REFERENCES Qualifications (QualificationId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Subtitles (
  SubTitleId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ModuleId INT UNSIGNED NOT NULL,
  QualificationId INT UNSIGNED NOT NULL,
  ModuleTitle VARCHAR(160) NOT NULL,
  CONSTRAINT fk_subtitles_module FOREIGN KEY (ModuleId) REFERENCES Modules (ModuleId) ON DELETE CASCADE,
  CONSTRAINT fk_subtitles_qualification FOREIGN KEY (QualificationId) REFERENCES Qualifications (QualificationId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Assessments (
  AssessmentId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ModuleId INT UNSIGNED NOT NULL,
  Title VARCHAR(160) NOT NULL,
  PassingScore INT UNSIGNED NOT NULL,
  AttemptLimit INT UNSIGNED NOT NULL DEFAULT 1,
  CONSTRAINT fk_assessments_module FOREIGN KEY (ModuleId) REFERENCES Modules (ModuleId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AssessmentQuestions (
  QuestionId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  AssessmentId INT UNSIGNED NOT NULL,
  QuestionText TEXT NOT NULL,
  QuestionType VARCHAR(50) NOT NULL,
  CONSTRAINT fk_assessment_questions_assessment FOREIGN KEY (AssessmentId) REFERENCES Assessments (AssessmentId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AssessmentOptions (
  OptionId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  QuestionId INT UNSIGNED NOT NULL,
  OptionText TEXT NOT NULL,
  IsCorrect TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_assessment_options_question FOREIGN KEY (QuestionId) REFERENCES AssessmentQuestions (QuestionId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AssessmentAttempts (
  AttemptId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId INT UNSIGNED NOT NULL,
  AssessmentId INT UNSIGNED NOT NULL,
  Score DECIMAL(5,2) NULL,
  Status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  SubmittedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assessment_attempts_user FOREIGN KEY (UserId) REFERENCES Users (UserId) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_attempts_assessment FOREIGN KEY (AssessmentId) REFERENCES Assessments (AssessmentId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS LearningMaterials (
  MaterialId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ModuleId INT UNSIGNED NOT NULL,
  Chapter VARCHAR(160) NOT NULL,
  Title VARCHAR(160) NOT NULL,
  ContentType VARCHAR(50) NOT NULL,
  ContentText LONGTEXT NOT NULL,
  CONSTRAINT fk_learning_materials_module FOREIGN KEY (ModuleId) REFERENCES Modules (ModuleId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS MaterialProgress (
  MaterialProgressId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  MaterialId INT UNSIGNED NOT NULL,
  UserId INT UNSIGNED NOT NULL,
  IsCompleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_material_progress (MaterialId, UserId),
  CONSTRAINT fk_material_progress_material FOREIGN KEY (MaterialId) REFERENCES LearningMaterials (MaterialId) ON DELETE CASCADE,
  CONSTRAINT fk_material_progress_user FOREIGN KEY (UserId) REFERENCES Users (UserId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Certificates (
  CertificateId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId INT UNSIGNED NOT NULL,
  QualificationId INT UNSIGNED NOT NULL,
  QualificationName VARCHAR(150) NOT NULL,
  Status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  UNIQUE KEY uq_certificates_user_qualification (UserId, QualificationId),
  CONSTRAINT fk_certificates_user FOREIGN KEY (UserId) REFERENCES Users (UserId) ON DELETE CASCADE,
  CONSTRAINT fk_certificates_qualification FOREIGN KEY (QualificationId) REFERENCES Qualifications (QualificationId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Schedules (
  ScheduleId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId INT UNSIGNED NOT NULL,
  QualificationId INT UNSIGNED NOT NULL,
  Title VARCHAR(160) NOT NULL,
  Description TEXT NULL,
  EventDate DATE NOT NULL,
  StartTime TIME NOT NULL,
  EndTime TIME NOT NULL,
  CONSTRAINT fk_schedules_user FOREIGN KEY (UserId) REFERENCES Users (UserId) ON DELETE CASCADE,
  CONSTRAINT fk_schedules_qualification FOREIGN KEY (QualificationId) REFERENCES Qualifications (QualificationId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Announcements (
  AnnouncementId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  Title VARCHAR(160) NOT NULL,
  Content TEXT NOT NULL,
  TargetRole VARCHAR(50) NOT NULL,
  ExpiryDate DATE NULL,
  CreatedBy INT UNSIGNED NULL,
  CONSTRAINT fk_announcements_created_by FOREIGN KEY (CreatedBy) REFERENCES Users (UserId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Notifications (
  NotificationId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId INT UNSIGNED NOT NULL,
  Title VARCHAR(160) NOT NULL,
  Message TEXT NOT NULL,
  CONSTRAINT fk_notifications_user FOREIGN KEY (UserId) REFERENCES Users (UserId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;