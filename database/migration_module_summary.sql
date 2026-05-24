-- Migration: Add summary support for modules
-- Stores short module descriptions in ModuleUiMeta.
USE appdb;

ALTER TABLE ModuleUiMeta
  ADD COLUMN IF NOT EXISTS Summary TEXT NULL AFTER CoverImageUrl;
