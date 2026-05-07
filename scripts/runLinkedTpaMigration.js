#!/usr/bin/env node
/**
 * Database Migration Runner - Linked TPA Module Support
 * Usage: node scripts/runLinkedTpaMigration.js
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/db');

async function runMigration() {
  try {
    console.log('Starting linked TPA module migration...\n');

    const migrationFile = path.join(__dirname, '../database/migration_linked_tpa_module.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    const cleanedSQL = migrationSQL
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    let executed = 0;
    let skipped = 0;

    for (const statement of statements) {
      try {
        console.log(`Executing: ${statement.substring(0, 80)}...`);
        await query(statement);
        executed += 1;
        console.log('✓ Success\n');
      } catch (error) {
        const message = String(error.message || '');
        const isDuplicateForeignKey =
          error?.errno === 1005 ||
          message.includes('Duplicate key on write or update') ||
          message.includes('errno: 121');

        if (
          message.includes('Duplicate column') ||
          message.includes('already exists') ||
          message.includes('Duplicate key name') ||
          message.includes('Duplicate foreign key') ||
          message.includes('errno: 1061') ||
          isDuplicateForeignKey
        ) {
          console.log(`⊘ Skipped (already exists): ${message.substring(0, 80)}\n`);
          skipped += 1;
        } else {
          throw error;
        }
      }
    }

    const [summaryRows] = await query(
      `SELECT COUNT(*) AS LinkedCount
         FROM Modules m
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        WHERE mt.TypeName = 'On-Site Training Modules'
          AND m.LinkedTpaModuleID IS NOT NULL`
    );

    const [reverseSummaryRows] = await query(
      `SELECT COUNT(*) AS ReverseLinkedCount
         FROM Modules m
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        WHERE mt.TypeName = 'Total Protected Area Modules'
          AND m.LinkedOnsiteModuleID IS NOT NULL`
    );

    const linkedCount = Number(summaryRows?.[0]?.LinkedCount || 0);
    const reverseLinkedCount = Number(reverseSummaryRows?.[0]?.ReverseLinkedCount || 0);

    console.log('\n=== Linked TPA Migration Complete ===');
    console.log(`✓ Executed: ${executed} statements`);
    console.log(`⊘ Skipped: ${skipped} statements (already exist)`);
    console.log(`✓ On-site modules currently linked to TPA: ${linkedCount}`);
    console.log(`✓ TPA modules currently linked to On-site: ${reverseLinkedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Linked TPA Migration Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
