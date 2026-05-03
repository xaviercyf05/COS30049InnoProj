#!/usr/bin/env node
const { query, pool } = require('../src/config/db');

const SAMPLE_USERNAMES = ['guide_john', 'guide_sarah', 'guide_mike'];
const SAMPLE_ASSESSMENT_TITLES = [
  'Module 1: Conservation Fundamentals Assessment',
  'Module 2: Biodiversity Deep Dive Assessment',
  'Module 3: Advanced Park Management Assessment',
];
const SAMPLE_BADGE_NAMES = [
  'Module 1: Conservation Fundamentals Completion',
  'Module 2: Biodiversity Deep Dive Completion',
  'Module 3: Advanced Park Management Completion',
];

async function run() {
  try {
    console.log('Starting sample data cleanup...');

    // Remove attempts first so FK constraints stay happy.
    if (SAMPLE_USERNAMES.length > 0) {
      const placeholders = SAMPLE_USERNAMES.map(() => '?').join(', ');
      await query(
        `DELETE FROM AssessmentAttempts
         WHERE UserID IN (
           SELECT UserID FROM Users WHERE Username IN (${placeholders})
         )`,
        SAMPLE_USERNAMES
      );

      await query(
        `DELETE FROM Schedules
         WHERE UserID IN (
           SELECT UserID FROM Users WHERE Username IN (${placeholders})
         )`,
        SAMPLE_USERNAMES
      );

      console.log(`Removed sample attempts and schedules for: ${SAMPLE_USERNAMES.join(', ')}`);
    }

    if (SAMPLE_ASSESSMENT_TITLES.length > 0) {
      const placeholders = SAMPLE_ASSESSMENT_TITLES.map(() => '?').join(', ');
      await query(
        `DELETE aq, ao
         FROM AssessmentQuestions aq
         LEFT JOIN Assessments a ON a.AssessmentID = aq.AssessmentID
         LEFT JOIN AssessmentOptions ao ON ao.QuestionID = aq.QuestionID
         WHERE a.Title IN (${placeholders})`,
        SAMPLE_ASSESSMENT_TITLES
      );

      await query(
        `DELETE FROM Assessments
         WHERE Title IN (${placeholders})`,
        SAMPLE_ASSESSMENT_TITLES
      );

      console.log(`Removed sample assessments and questions: ${SAMPLE_ASSESSMENT_TITLES.join(', ')}`);
    }

    if (SAMPLE_BADGE_NAMES.length > 0) {
      const placeholders = SAMPLE_BADGE_NAMES.map(() => '?').join(', ');
      await query(
        `DELETE FROM Badges WHERE BadgeName IN (${placeholders})`,
        SAMPLE_BADGE_NAMES
      );
      console.log(`Removed sample badges: ${SAMPLE_BADGE_NAMES.join(', ')}`);
    }

    if (SAMPLE_USERNAMES.length > 0) {
      const placeholders = SAMPLE_USERNAMES.map(() => '?').join(', ');
      await query(
        `DELETE FROM Users WHERE Username IN (${placeholders})`,
        SAMPLE_USERNAMES
      );
      console.log(`Removed sample users: ${SAMPLE_USERNAMES.join(', ')}`);
    }

    console.log('Sample data cleanup complete.');
  } catch (error) {
    console.error('Cleanup failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();