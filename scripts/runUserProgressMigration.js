#!/usr/bin/env node

/**
 * Migration runner for user_progress table
 * Adds progress tracking table for user module reading progress
 *
 * Usage: node scripts/runUserProgressMigration.js
 */

const fs = require("fs");
const path = require("path");

async function runMigration() {
  console.log("Starting user_progress migration...\n");

  try {
    // Get the query function from db config
    const { query } = require("../src/config/db");

    // Read migration file
    const migrationPath = path.join(__dirname, "../database/migration_user_progress.sql");
    let migrationSql = fs.readFileSync(migrationPath, "utf8");

    // Parse SQL file - split by semicolon and filter empty statements
    const statements = migrationSql
      .split(";")
      .map((stmt) => {
        // Remove comments and trim
        const cleaned = stmt
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim();
        return cleaned;
      })
      .filter((stmt) => stmt && stmt.length > 0);

    console.log(`Found ${statements.length} migration statements\n`);

    let executedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Execute each statement
    for (const statement of statements) {
      try {
        console.log("Executing:", statement.substring(0, 80) + (statement.length > 80 ? "..." : ""));
        
        // Execute the statement using the query function
        const result = await query(statement);
        console.log("✓ Success\n");
        executedCount++;
      } catch (error) {
        // Handle known duplicate/already-exists errors gracefully
        if (
          error.errno === 1005 ||
          error.errno === 1061 ||
          error.message.includes("Duplicate key name") ||
          error.message.includes("Duplicate foreign key") ||
          error.message.includes("already exists") ||
          error.message.includes("Duplicate entry")
        ) {
          console.log("⊘ Skipped (already exists)\n");
          skippedCount++;
        } else {
          console.error("✗ Error:", error.message, "\n");
          errors.push({ statement: statement.substring(0, 80), error: error.message });
        }
      }
    }

    console.log("\n=== User Progress Migration Complete ===");
    console.log(`✓ Executed: ${executedCount} statements`);
    console.log(`⊘ Skipped: ${skippedCount} statements (already exist)`);

    if (errors.length > 0) {
      console.log(`\n⚠ ${errors.length} statements had errors (may be non-critical):`);
      errors.forEach((e) => {
        console.log(`  - ${e.statement}...`);
        console.log(`    ${e.error}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
