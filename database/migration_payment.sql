-- Migration: Add Payments table for module payment evidence
-- Run this on your production database to create the Payments table and index

CREATE TABLE IF NOT EXISTS Payments (
  PaymentID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  ModuleID INT UNSIGNED NOT NULL,
  ModulePrice DECIMAL(10,2) NULL,
  Reference VARCHAR(255) NULL,
  EvidenceFilePath VARCHAR(500) NULL,
  EvidenceFileName VARCHAR(255) NULL,
  EvidenceMimeType VARCHAR(120) NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ReviewedBy INT UNSIGNED NULL,
  ReviewedAt TIMESTAMP NULL,
  ReviewRemark VARCHAR(255) NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE,
  CONSTRAINT fk_payments_module FOREIGN KEY (ModuleID) REFERENCES Modules (ModuleID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_payments_user_module ON Payments (UserID, ModuleID);

-- Notes:
-- 1. The backend expects uploaded evidence files to be stored under /uploads/payment-evidence/
-- 2. After running the migration, restart the API server so the new endpoints operate against the updated schema.
