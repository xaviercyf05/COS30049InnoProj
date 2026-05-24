-- Migration: Add LinkedTpaModuleID support to Modules table
-- This allows On-Site Training Modules to be linked to Total Protected Area (TPA) modules.
-- Includes a safe, non-destructive backfill for existing data.

USE appdb;

-- Add LinkedTpaModuleID column to Modules table (self-referential for TPA linking)
ALTER TABLE Modules ADD COLUMN IF NOT EXISTS LinkedTpaModuleID INT UNSIGNED NULL;

-- Add foreign key constraint for linked TPA module (self-referential)
ALTER TABLE Modules
  ADD CONSTRAINT fk_modules_linked_tpa_module
  FOREIGN KEY (LinkedTpaModuleID) REFERENCES Modules (ModuleID) ON DELETE SET NULL;

-- Add index on LinkedTpaModuleID for better query performance
CREATE INDEX idx_modules_linked_tpa ON Modules (LinkedTpaModuleID);

-- Add composite index on module type and linked TPA for filtering
CREATE INDEX idx_modules_type_linked_tpa ON Modules (ModuleTypeID, LinkedTpaModuleID);

-- Add LinkedOnsiteModuleID column to support reverse lookup from TPA to On-Site module
ALTER TABLE Modules ADD COLUMN IF NOT EXISTS LinkedOnsiteModuleID INT UNSIGNED NULL;

-- Add foreign key constraint for linked On-Site module (self-referential)
ALTER TABLE Modules
  ADD CONSTRAINT fk_modules_linked_onsite_module
  FOREIGN KEY (LinkedOnsiteModuleID) REFERENCES Modules (ModuleID) ON DELETE SET NULL;

-- Add index on LinkedOnsiteModuleID for reverse query performance
CREATE INDEX idx_modules_linked_onsite ON Modules (LinkedOnsiteModuleID);

-- Add composite index on module type and linked On-Site for filtering
CREATE INDEX idx_modules_type_linked_onsite ON Modules (ModuleTypeID, LinkedOnsiteModuleID);

-- Safe backfill: link existing On-Site modules to existing TPA modules only when
-- there is exactly one normalized title match in the same qualification.
-- This updates only rows where LinkedTpaModuleID is currently NULL.
UPDATE Modules onsite
JOIN (
  SELECT
    os.ModuleID AS OnsiteModuleID,
    MIN(tpa.ModuleID) AS MatchedTpaModuleID,
    COUNT(*) AS MatchCount
  FROM Modules os
  JOIN ModuleTypes osType ON osType.ModuleTypeID = os.ModuleTypeID
  JOIN Modules tpa
    ON tpa.QualificationID = os.QualificationID
   AND LOWER(TRIM(
         REPLACE(
           REPLACE(
             REPLACE(
               REPLACE(
                 REPLACE(
                   REPLACE(os.ModuleTitle,
                     'On-Site Training Module:', ''),
                     'On Site Training Module:', ''),
                   'On-Site Training Module', ''),
                 'On Site Training Module', ''),
               'On-Site Module:', ''),
             'On Site Module:', '')
       )) = LOWER(TRIM(
         REPLACE(
           REPLACE(
             REPLACE(
               REPLACE(
                 tpa.ModuleTitle,
                 'Total Protected Area Module:', ''),
               'TPA Module:', ''),
             'Total Protected Area:', ''),
           'TPA:', '')
       ))
  JOIN ModuleTypes tpaType ON tpaType.ModuleTypeID = tpa.ModuleTypeID
  WHERE osType.TypeName = 'On-Site Training Modules'
    AND tpaType.TypeName = 'Total Protected Area Modules'
  GROUP BY os.ModuleID
  HAVING COUNT(*) = 1
) map ON map.OnsiteModuleID = onsite.ModuleID
SET onsite.LinkedTpaModuleID = map.MatchedTpaModuleID
WHERE onsite.LinkedTpaModuleID IS NULL;

-- Safe reverse backfill: for TPA modules that have exactly one linked On-Site module,
-- set LinkedOnsiteModuleID when currently NULL.
UPDATE Modules tpa
JOIN (
  SELECT
    os.LinkedTpaModuleID AS TpaModuleID,
    MIN(os.ModuleID) AS OnsiteModuleID,
    COUNT(*) AS LinkCount
  FROM Modules os
  JOIN ModuleTypes osType ON osType.ModuleTypeID = os.ModuleTypeID
  WHERE osType.TypeName = 'On-Site Training Modules'
    AND os.LinkedTpaModuleID IS NOT NULL
  GROUP BY os.LinkedTpaModuleID
  HAVING COUNT(*) = 1
) map ON map.TpaModuleID = tpa.ModuleID
JOIN ModuleTypes tpaType ON tpaType.ModuleTypeID = tpa.ModuleTypeID
SET tpa.LinkedOnsiteModuleID = map.OnsiteModuleID
WHERE tpaType.TypeName = 'Total Protected Area Modules'
  AND tpa.LinkedOnsiteModuleID IS NULL;
