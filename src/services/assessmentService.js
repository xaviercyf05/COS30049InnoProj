const { query } = require("../config/db");

/**
 * Service for managing assessments, attempts, and answer tracking.
 */

const ATTEMPT_LIMIT = 3;
const COOLDOWN_HOURS = 1;

function normalizeQuestionType(questionType) {
  const normalized = String(questionType || '').toLowerCase();

  if (['fill', 'fill_blank', 'fill-in-blank', 'fillinblank', 'short_answer'].includes(normalized)) {
    return 'fill';
  }

  return 'mcq';
}

async function getAssessmentRow(identifier, lookupBy = 'module') {
  const column = lookupBy === 'assessment' ? 'AssessmentID' : 'ModuleID';
  const [assessments] = await query(
    `SELECT AssessmentID, ModuleID, Title, PassingScore, AttemptLimit
     FROM Assessments
     WHERE ${column} = ?
     LIMIT 1`,
    [identifier]
  );

  if (assessments.length === 0) {
    throw new Error('Assessment not found');
  }

  return assessments[0];
}

/**
 * Get all assessment questions for a module
 */
async function getAssessmentQuestions(identifier, includeCorrectAnswer = false, lookupBy = 'module') {
  try {
    const assessment = await getAssessmentRow(identifier, lookupBy);

    // Get all questions and options
    const [questions] = await query(
      `SELECT q.QuestionID, q.AssessmentID, q.QuestionText, q.QuestionType
       FROM AssessmentQuestions q
       WHERE q.AssessmentID = ?
       ORDER BY q.QuestionID ASC`,
      [assessment.AssessmentID]
    );

    const questionsWithOptions = [];
    for (const q of questions) {
      const [options] = await query(
        `SELECT OptionID, OptionText, IsCorrect
         FROM AssessmentOptions
         WHERE QuestionID = ?
         ORDER BY OptionID ASC`,
        [q.QuestionID]
      );

      const correctOptionIndex = options.findIndex((opt) => Number(opt.IsCorrect) === 1);
      const correctOption = options[correctOptionIndex] || null;
      const questionType = normalizeQuestionType(q.QuestionType);

      questionsWithOptions.push({
        questionId: q.QuestionID,
        questionText: q.QuestionText,
        questionType,
        options: options.map((opt) => ({
          optionId: opt.OptionID,
          text: opt.OptionText,
        })),
        ...(includeCorrectAnswer
          ? {
              correctAnswer:
                questionType === 'mcq'
                  ? correctOptionIndex
                  : correctOption?.OptionText || '',
            }
          : {}),
      });
    }

    return {
      assessmentId: assessment.AssessmentID,
      moduleId: assessment.ModuleID,
      title: assessment.Title,
      passingScore: assessment.PassingScore,
      attemptLimit: assessment.AttemptLimit,
      totalQuestions: questionsWithOptions.length,
      questions: questionsWithOptions,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Check user's attempt count and cooldown for an assessment
 */
async function checkAttemptEligibility(userId, assessmentId) {
  try {
    // Get user's attempts for this assessment
    const [attempts] = await query(
      `SELECT AttemptID, SubmittedAt, Status
       FROM AssessmentAttempts
       WHERE UserID = ? AND AssessmentID = ?
       ORDER BY SubmittedAt DESC`,
      [userId, assessmentId]
    );

    const passedAttempt = attempts.find((a) => a.Status === "Passed");
    if (passedAttempt) {
      return {
        canAttempt: false,
        reason: "Assessment already passed",
        remainingAttempts: 0,
      };
    }

    const failedAttempts = attempts.filter((a) => a.Status === "Failed");
    const remainingAttempts = Math.max(0, ATTEMPT_LIMIT - failedAttempts.length);

    if (remainingAttempts === 0) {
      return {
        canAttempt: false,
        reason: "No remaining attempts",
        remainingAttempts: 0,
      };
    }

    // Check cooldown from last attempt
    if (attempts.length > 0) {
      const lastAttempt = new Date(attempts[0].SubmittedAt);
      const now = new Date();
      const hoursSinceLastAttempt = (now - lastAttempt) / (1000 * 60 * 60);

      if (hoursSinceLastAttempt < COOLDOWN_HOURS) {
        return {
          canAttempt: false,
          reason: `Must wait ${Math.ceil(
            COOLDOWN_HOURS - hoursSinceLastAttempt
          )} more hour(s) before next attempt`,
          remainingAttempts,
          cooldownEndsAt: new Date(
            lastAttempt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000
          ),
        };
      }
    }

    return {
      canAttempt: true,
      remainingAttempts,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Submit assessment answers and calculate score
 */
async function submitAssessmentAttempt(userId, assessmentId, answers) {
  try {
    // Check eligibility
    const eligibility = await checkAttemptEligibility(userId, assessmentId);
    if (!eligibility.canAttempt) {
      throw new Error(eligibility.reason);
    }

    // Get assessment info
    const [assessments] = await query(
      "SELECT AssessmentID, PassingScore, ModuleID FROM Assessments WHERE AssessmentID = ? LIMIT 1",
      [assessmentId]
    );

    if (assessments.length === 0) {
      throw new Error("Assessment not found");
    }

    const assessment = assessments[0];

    // Score the answers
    let correctCount = 0;
    let totalQuestions = 0;

    for (const answer of answers) {
      totalQuestions++;
      const [options] = await query(
        "SELECT IsCorrect FROM AssessmentOptions WHERE OptionID = ? LIMIT 1",
        [answer.optionId]
      );

      if (options.length > 0 && options[0].IsCorrect) {
        correctCount++;
      }
    }

    const score = Math.round((correctCount / totalQuestions) * 100);
    const status = score >= assessment.PassingScore ? "Passed" : "Failed";

    // Record attempt
    const [result] = await query(
      `INSERT INTO AssessmentAttempts (UserID, AssessmentID, Score, Status)
       VALUES (?, ?, ?, ?)`,
      [userId, assessmentId, score, status]
    );

    return {
      attemptId: result.insertId,
      assessmentId,
      score,
      totalQuestions,
      correctCount,
      passingScore: assessment.PassingScore,
      status,
      passed: status === "Passed",
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get user's assessment attempt history
 */
async function getUserAssessmentAttempts(userId, moduleId) {
  try {
    const [attempts] = await query(
      `SELECT aa.AttemptID, aa.Score, aa.Status, aa.SubmittedAt, a.AssessmentID, a.PassingScore
       FROM AssessmentAttempts aa
       INNER JOIN Assessments a ON a.AssessmentID = aa.AssessmentID
       WHERE aa.UserID = ? AND a.ModuleID = ?
       ORDER BY aa.SubmittedAt DESC`,
      [userId, moduleId]
    );

    return attempts.map((att) => ({
      attemptId: att.AttemptID,
      assessmentId: att.AssessmentID,
      score: att.Score,
      status: att.Status,
      submittedAt: att.SubmittedAt,
      isPassed: att.Status === "Passed",
      passingScore: att.PassingScore,
    }));
  } catch (error) {
    throw error;
  }
}

function normalizeCorrectAnswerIndex(options, correctAnswer) {
  if (typeof correctAnswer === 'number' && Number.isInteger(correctAnswer)) {
    return Math.max(0, Math.min(correctAnswer, Math.max(0, options.length - 1)));
  }

  if (typeof correctAnswer === 'string') {
    const numericAnswer = Number.parseInt(correctAnswer, 10);
    if (!Number.isNaN(numericAnswer)) {
      return Math.max(0, Math.min(numericAnswer, Math.max(0, options.length - 1)));
    }

    const matchedIndex = options.findIndex(
      (option) => String(option).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase()
    );

    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  return 0;
}

async function listAssessments(moduleId = null) {
  const sql = moduleId
    ? `SELECT a.AssessmentID, a.ModuleID, a.Title, a.PassingScore, a.AttemptLimit,
              COUNT(q.QuestionID) AS QuestionCount
       FROM Assessments a
       LEFT JOIN AssessmentQuestions q ON q.AssessmentID = a.AssessmentID
       WHERE a.ModuleID = ?
       GROUP BY a.AssessmentID, a.ModuleID, a.Title, a.PassingScore, a.AttemptLimit
       ORDER BY a.AssessmentID DESC`
    : `SELECT a.AssessmentID, a.ModuleID, a.Title, a.PassingScore, a.AttemptLimit,
              COUNT(q.QuestionID) AS QuestionCount
       FROM Assessments a
       LEFT JOIN AssessmentQuestions q ON q.AssessmentID = a.AssessmentID
       GROUP BY a.AssessmentID, a.ModuleID, a.Title, a.PassingScore, a.AttemptLimit
       ORDER BY a.AssessmentID DESC`;

  const params = moduleId ? [moduleId] : [];
  const [rows] = await query(sql, params);

  return rows.map((assessment) => ({
    id: assessment.AssessmentID,
    moduleId: assessment.ModuleID,
    title: assessment.Title,
    passingScore: assessment.PassingScore,
    attemptLimit: assessment.AttemptLimit,
    durationMinutes: 120,
    questionCount: Number(assessment.QuestionCount || 0),
  }));
}

async function createAssessment(moduleId, title, passingScore, durationMinutes, attemptLimit = 3) {
  const [result] = await query(
    `INSERT INTO Assessments (ModuleID, Title, PassingScore, AttemptLimit)
     VALUES (?, ?, ?, ?)`,
    [moduleId, title, passingScore, attemptLimit]
  );

  return {
    assessmentId: result.insertId,
    moduleId,
    title,
    passingScore,
    durationMinutes: durationMinutes || 120,
    attemptLimit,
  };
}

async function updateAssessmentSettings(assessmentId, passingScore, durationMinutes, attemptLimit) {
  const [result] = await query(
    `UPDATE Assessments
     SET PassingScore = ?, AttemptLimit = ?
     WHERE AssessmentID = ?`,
    [passingScore, attemptLimit, assessmentId]
  );

  if (result.affectedRows === 0) {
    throw new Error('Assessment not found');
  }

  return { assessmentId, passingScore, durationMinutes: durationMinutes || 120, attemptLimit };
}

async function deleteAssessment(assessmentId) {
  const [result] = await query('DELETE FROM Assessments WHERE AssessmentID = ?', [assessmentId]);

  if (result.affectedRows === 0) {
    throw new Error('Assessment not found');
  }

  return { assessmentId };
}

async function addAssessmentQuestion(assessmentId, questionText, questionType, options, correctAnswer) {
  const normalizedType = normalizeQuestionType(questionType);
  const [questionResult] = await query(
    `INSERT INTO AssessmentQuestions (AssessmentID, QuestionText, QuestionType)
     VALUES (?, ?, ?)`,
    [assessmentId, questionText, normalizedType]
  );

  const questionId = questionResult.insertId;
  const optionList = Array.isArray(options) ? options : [];
  const correctIndex = normalizedType === 'mcq'
    ? normalizeCorrectAnswerIndex(optionList, correctAnswer)
    : 0;

  if (optionList.length > 0) {
    for (let index = 0; index < optionList.length; index += 1) {
      await query(
        `INSERT INTO AssessmentOptions (QuestionID, OptionText, IsCorrect)
         VALUES (?, ?, ?)`,
        [questionId, optionList[index], normalizedType === 'mcq' ? (index === correctIndex ? 1 : 0) : 0]
      );
    }
  } else if (normalizedType === 'fill') {
    await query(
      `INSERT INTO AssessmentOptions (QuestionID, OptionText, IsCorrect)
       VALUES (?, ?, 1)`,
      [questionId, String(correctAnswer || '')]
    );
  }

  return { questionId };
}

async function updateAssessmentQuestion(questionId, questionText, questionType, options, correctAnswer) {
  const normalizedType = normalizeQuestionType(questionType);
  const [result] = await query(
    `UPDATE AssessmentQuestions
     SET QuestionText = ?, QuestionType = ?
     WHERE QuestionID = ?`,
    [questionText, normalizedType, questionId]
  );

  if (result.affectedRows === 0) {
    throw new Error('Question not found');
  }

  await query('DELETE FROM AssessmentOptions WHERE QuestionID = ?', [questionId]);

  const optionList = Array.isArray(options) ? options : [];
  const correctIndex = normalizedType === 'mcq'
    ? normalizeCorrectAnswerIndex(optionList, correctAnswer)
    : 0;

  if (optionList.length > 0) {
    for (let index = 0; index < optionList.length; index += 1) {
      await query(
        `INSERT INTO AssessmentOptions (QuestionID, OptionText, IsCorrect)
         VALUES (?, ?, ?)`,
        [questionId, optionList[index], normalizedType === 'mcq' ? (index === correctIndex ? 1 : 0) : 0]
      );
    }
  } else if (normalizedType === 'fill') {
    await query(
      `INSERT INTO AssessmentOptions (QuestionID, OptionText, IsCorrect)
       VALUES (?, ?, 1)`,
      [questionId, String(correctAnswer || '')]
    );
  }

  return { questionId };
}

async function deleteAssessmentQuestion(questionId) {
  const [result] = await query('DELETE FROM AssessmentQuestions WHERE QuestionID = ?', [questionId]);

  if (result.affectedRows === 0) {
    throw new Error('Question not found');
  }

  return { questionId };
}

async function getAssessmentAttempts(assessmentId) {
  const [attempts] = await query(
    `SELECT aa.AttemptID, aa.UserID, aa.AssessmentID, aa.Score, aa.Status, aa.SubmittedAt,
            u.Username AS UserName, u.Email AS UserEmail, a.PassingScore
     FROM AssessmentAttempts aa
     INNER JOIN Users u ON u.UserID = aa.UserID
     INNER JOIN Assessments a ON a.AssessmentID = aa.AssessmentID
     WHERE aa.AssessmentID = ?
     ORDER BY aa.SubmittedAt DESC`,
    [assessmentId]
  );

  return attempts.map((attempt) => ({
    id: attempt.AttemptID,
    userId: attempt.UserID,
    userName: attempt.UserName,
    userEmail: attempt.UserEmail,
    score: attempt.Score,
    status: attempt.Status,
    submittedAt: attempt.SubmittedAt,
    timeUsedSeconds: 0,
    passed: String(attempt.Status).toLowerCase() === 'passed',
    passingScore: attempt.PassingScore,
  }));
}

async function resetUserAttempt(assessmentId, attemptId) {
  const [result] = await query(
    `UPDATE AssessmentAttempts
     SET Status = 'Pending', Score = NULL
     WHERE AssessmentID = ? AND AttemptID = ?`,
    [assessmentId, attemptId]
  );

  if (result.affectedRows === 0) {
    throw new Error('Attempt not found');
  }

  return { attemptId, assessmentId };
}

module.exports = {
  getAssessmentQuestions,
  checkAttemptEligibility,
  submitAssessmentAttempt,
  getUserAssessmentAttempts,
  listAssessments,
  createAssessment,
  updateAssessmentSettings,
  deleteAssessment,
  addAssessmentQuestion,
  updateAssessmentQuestion,
  deleteAssessmentQuestion,
  getAssessmentAttempts,
  resetUserAttempt,
};
