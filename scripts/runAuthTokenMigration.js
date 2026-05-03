#!/usr/bin/env node

/**
 * Database Migration Runner - Refresh Token Support
 * Usage: node scripts/runAuthTokenMigration.js
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/db');

async function runMigration() {
  try {
    console.log('Starting database migration for refresh-token support...\n');

    const migrationFile = path.join(__dirname, '../database/auth_refresh_tokens_schema.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    const statements = migrationSQL
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    let executed = 0;

    for (const statement of statements) {
      try {
        console.log(`Executing: ${statement.substring(0, 80)}...`);
        await query(statement);
        executed += 1;
        console.log('✓ Success\n');
      } catch (error) {
        if (
          error.message.includes('Duplicate') ||
          error.message.includes('already exists') ||
          error.message.includes('CONSTRAINT')
        ) {
          console.log(`⊘ Skipped: ${error.message.substring(0, 60)}\n`);
          continue;
        }

        throw error;
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`✓ Executed: ${executed} statements`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();