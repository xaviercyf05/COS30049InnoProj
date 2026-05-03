#!/usr/bin/env node
const { query } = require('../src/config/db');

async function main() {
  const [rows] = await query(
    `SELECT m.ModuleID,
            m.ModuleTitle,
            a.AssessmentID,
            a.Title AS AssessmentTitle,
            a.BadgeID,
            b.BadgeName,
            a.QuestionCount,
            COUNT(q.QuestionID) AS ActualQuestions
     FROM Modules m
     LEFT JOIN Assessments a ON a.ModuleID = m.ModuleID
     LEFT JOIN Badges b ON b.BadgeID = a.BadgeID
     LEFT JOIN AssessmentQuestions q ON q.AssessmentID = a.AssessmentID
     GROUP BY m.ModuleID, m.ModuleTitle, a.AssessmentID, a.Title, a.BadgeID, b.BadgeName, a.QuestionCount
     ORDER BY m.ModuleID`
  );

  console.log('ModuleID | ModuleTitle | AssessmentID | BadgeID | BadgeName | QuestionCount | ActualQuestions');
  for (const row of rows) {
    console.log(
      [
        row.ModuleID,
        row.ModuleTitle,
        row.AssessmentID || '-',
        row.BadgeID || '-',
        row.BadgeName || '-',
        row.QuestionCount || 0,
        Number(row.ActualQuestions || 0),
      ].join(' | ')
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
