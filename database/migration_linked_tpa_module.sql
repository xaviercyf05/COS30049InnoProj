-- Migration: Add LinkedTpaModuleID support to Modules table
-- This allows On-Site Training Modules to be linked to Total Protected Area (TPA) modules
-- Used for result verification to show correct pairing between TPA assessment pass and on-site module completion

USE appdb;

-- Add LinkedTpaModuleID column to Modules table (self-referential for TPA linking)
ALTER TABLE Modules ADD COLUMN IF NOT EXISTS LinkedTpaModuleID INT UNSIGNED NULL;

-- Add foreign key constraint for linked TPA module (self-referential)
ALTER TABLE Modules ADD CONSTRAINT fk_modules_linked_tpa_module 
  FOREIGN KEY (LinkedTpaModuleID) REFERENCES Modules (ModuleID) ON DELETE SET NULL;

-- Add index on LinkedTpaModuleID for better query performance
CREATE INDEX idx_modules_linked_tpa ON Modules (LinkedTpaModuleID);

-- Add composite index on module type and linked TPA for filtering
CREATE INDEX idx_modules_type_linked_tpa ON Modules (ModuleTypeID, LinkedTpaModuleID);
