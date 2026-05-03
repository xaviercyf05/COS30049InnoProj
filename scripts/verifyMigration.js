#!/usr/bin/env node
const { query } = require('../src/config/db');

async function main() {
  const [assessments] = await query('SHOW COLUMNS FROM Assessments');
  const [attempts] = await query('SHOW COLUMNS FROM AssessmentAttempts');
  const [mapping] = await query("SHOW TABLES LIKE 'BadgeAssessmentMapping'");

  console.log('Assessments columns:', assessments.map((c) => c.Field).join(','));
  console.log('AssessmentAttempts columns:', attempts.map((c) => c.Field).join(','));
  console.log('BadgeAssessmentMapping exists:', mapping.length > 0);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
