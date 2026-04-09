const { query } = require("../config/db");

/**
 * Service for managing assessments, attempts, and answer tracking.
 */

const ATTEMPT_LIMIT = 3;
const COOLDOWN_HOURS = 1;

/**
 * Get all assessment questions for a module
 */
async function getAssessmentQuestions(moduleId) {
  try {
    // Get assessment ID for module
    const [assessments] = await query(
      "SELECT AssessmentID, Title, PassingScore FROM Assessments WHERE ModuleID = ? LIMIT 1",
      [moduleId]
    );

    if (assessments.length === 0) {
      throw new Error("Assessment not found for this module");
    }

    const assessment = assessments[0];

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

      questionsWithOptions.push({
        questionId: q.QuestionID,
        questionText: q.QuestionText,
        questionType: q.QuestionType,
        options: options.map((opt) => ({
          optionId: opt.OptionID,
          text: opt.OptionText,
          // Don't expose isCorrect to client
        })),
      });
    }

    return {
      assessmentId: assessment.AssessmentID,
      moduleId,
      title: assessment.Title,
      passingScore: assessment.PassingScore,
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

module.exports = {
  getAssessmentQuestions,
  checkAttemptEligibility,
  submitAssessmentAttempt,
  getUserAssessmentAttempts,
};
