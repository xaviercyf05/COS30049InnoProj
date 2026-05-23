-- Migration: Add persisted module pricing and payment price snapshots
-- Run this on existing databases after deploying the backend changes.

ALTER TABLE Modules
  ADD COLUMN IF NOT EXISTS ModulePrice DECIMAL(10,2) NULL AFTER ModuleTypeID;

UPDATE Modules m
LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
   SET m.ModulePrice = CASE
     WHEN m.ModulePrice IS NOT NULL THEN m.ModulePrice
     WHEN LOWER(COALESCE(mt.TypeName, '')) LIKE '%on-site%' THEN NULL
     ELSE 0.00
   END;

ALTER TABLE Payments
  ADD COLUMN IF NOT EXISTS ModulePrice DECIMAL(10,2) NULL AFTER ModuleID;

UPDATE Payments p
LEFT JOIN Modules m ON m.ModuleID = p.ModuleID
LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
   SET p.ModulePrice = CASE
     WHEN p.ModulePrice IS NOT NULL THEN p.ModulePrice
     WHEN m.ModulePrice IS NOT NULL THEN m.ModulePrice
     WHEN LOWER(COALESCE(mt.TypeName, '')) LIKE '%on-site%' THEN NULL
     ELSE 0.00
   END;