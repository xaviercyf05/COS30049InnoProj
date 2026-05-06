-- Backfill AssessmentQuestions.CorrectAnswer using the correct option in AssessmentOptions
-- Run this against your database (e.g. mysql -u root -p digital_park_guide < scripts/backfill_correct_answers.sql)

UPDATE AssessmentQuestions q
JOIN (
  SELECT QuestionID, OptionText
  FROM AssessmentOptions
  WHERE IsCorrect = 1
) o ON o.QuestionID = q.QuestionID
SET q.CorrectAnswer = o.OptionText
WHERE q.CorrectAnswer IS NULL OR TRIM(q.CorrectAnswer) = '';

-- Note: If multiple correct options exist for a question (shouldn't happen for MCQ),
-- the query picks one arbitrary matching option row from the join.