-- Migration: Add ModuleType support to Modules table
-- This allows modules to be organized into correct sections based on their type

-- Create ModuleTypes lookup table (if not exists)
CREATE TABLE IF NOT EXISTS ModuleTypes (
  ModuleTypeID TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  TypeName VARCHAR(50) NOT NULL UNIQUE,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default module types
INSERT IGNORE INTO ModuleTypes (TypeName) VALUES
  ('General Modules'),
  ('Total Protected Area Modules'),
  ('On-Site Training Modules');

-- Add ModuleType column to Modules table
ALTER TABLE Modules ADD COLUMN IF NOT EXISTS ModuleTypeID TINYINT UNSIGNED NULL DEFAULT 1;

-- Add foreign key constraint for ModuleType
ALTER TABLE Modules ADD CONSTRAINT fk_modules_module_type 
  FOREIGN KEY (ModuleTypeID) REFERENCES ModuleTypes (ModuleTypeID) ON DELETE SET NULL;

-- Add index on ModuleTypeID for better query performance
CREATE INDEX idx_modules_module_type ON Modules (ModuleTypeID);

-- Create index on qualification and type for faster filtering
CREATE INDEX idx_modules_qualification_type ON Modules (QualificationID, ModuleTypeID);
