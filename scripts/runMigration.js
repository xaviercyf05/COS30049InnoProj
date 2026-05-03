#!/usr/bin/env node
/**
 * Database Migration Runner - Multi-Assessment System
 * Usage: node scripts/runMigration.js
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/db');

async function runMigration() {
  try {
    console.log('Starting database migration for multi-assessment system...\n');

    const migrationFile = path.join(__dirname, '../database/migration_multi_assessment.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    const cleanedSQL = migrationSQL
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    // Split SQL statements by semicolon and filter empty ones
    const statements = cleanedSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    let executed = 0;
    let skipped = 0;

    for (const statement of statements) {
      try {
        console.log(`Executing: ${statement.substring(0, 60)}...`);
        await query(statement);
        executed++;
        console.log('✓ Success\n');
      } catch (error) {
        // Check if it's a "duplicate column" or "already exists" error (can be ignored)
        if (error.message.includes('Duplicate column') ||
            error.message.includes('already exists') ||
            error.message.includes('CONSTRAINT') ||
            error.message.includes('already created')) {
          console.log(`⊘ Skipped (already exists): ${error.message.substring(0, 50)}\n`);
          skipped++;
        } else {
          throw error;
        }
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`✓ Executed: ${executed} statements`);
    console.log(`⊘ Skipped: ${skipped} statements (already exist)`);
    console.log('\nMulti-assessment system database migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
runMigration();
