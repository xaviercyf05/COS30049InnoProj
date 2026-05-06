const { query } = require("../config/db");
const assessmentService = require("../services/assessmentService");
const notificationService = require("../services/notificationService");

/**
 * Controller for assessments - handles questions, submissions, and scoring.
 */

/*helo*/
/**
 * Get assessment questions for a module
 */
async function getAssessmentQuestions(req, res) {
  try {
    const { moduleId } = req.params;

    const assessment = await assessmentService.getAssessmentQuestions(moduleId, false, 'module');

    return res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error("Get assessment questions error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assessment questions.",
    });
  }
}

/**
 * Check if user is eligible to attempt assessment
 */
async function checkAttemptEligibility(req, res) {
  try {
    const { userId } = req.user;
    const { assessmentId } = req.params;

    // Get assessment info
    const [assessments] = await query(
      "SELECT AssessmentID FROM Assessments WHERE AssessmentID = ? LIMIT 1",
      [assessmentId]
    );

    if (assessments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found.",
      });
    }

    const eligibility = await assessmentService.checkAttemptEligibility(
      userId,
      assessmentId
    );

    return res.json({
      success: true,
      data: eligibility,
    });
  } catch (error) {
    console.error("Check attempt eligibility error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check attempt eligibility.",
    });
  }
}

/**
 * Submit assessment attempt with answers
 */
async function submitAssessmentAttempt(req, res) {
  try {
    const { userId } = req.user;
    const { assessmentId, answers, timeUsedSeconds } = req.body;
    // Debug: log incoming payload shape for troubleshooting 500 errors
    try {
      console.debug('Submit assessment attempt incoming:', {
        userId,
        assessmentIdType: typeof assessmentId,
        assessmentIdValue: assessmentId,
        answersType: Array.isArray(answers) ? 'array' : typeof answers,
        answersCount: Array.isArray(answers) ? answers.length : 0,
        sampleAnswers: Array.isArray(answers) ? answers.slice(0, 5) : answers,
        timeUsedSeconds,
      });
    } catch (logErr) {
      console.error('Failed to log submit payload', logErr);
    }

    if (!assessmentId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Assessment ID and answers array are required.",
      });
    }

    // Submit attempt
    const attempt = await assessmentService.submitAssessmentAttempt(
      userId,
      assessmentId,
      answers,
      Number(timeUsedSeconds || 0)
    );

    // If passed, send notification and update module progress
    if (attempt.passed) {
      // Get module and title for notification
      const [assessments] = await query(
        "SELECT ModuleID FROM Assessments WHERE AssessmentID = ? LIMIT 1",
        [assessmentId]
      );

      if (assessments.length > 0) {
        const [modules] = await query(
          "SELECT ModuleTitle FROM Modules WHERE ModuleID = ? LIMIT 1",
          [assessments[0].ModuleID]
        );

        if (modules.length > 0) {
          await notificationService.notificationHelpers.notifyAssessmentResult(
            userId,
            modules[0].ModuleTitle,
            true,
            attempt.score
          );

          // Check if all modules passed, then issue certificate
          const [certs] = await query(
            `SELECT c.CertificateID, c.QualificationID, c.QualificationName
             FROM Certificates c
             LEFT JOIN Modules m ON m.QualificationID = c.QualificationID
             WHERE c.UserID = ?
             LIMIT 1`,
            [userId]
          );

          if (
            certs.length > 0 &&
            certs[0].QualificationID
          ) {
            // Check if all modules for qualification are passed
            const [allModules] = await query(
              `SELECT m.ModuleID FROM Modules m WHERE m.QualificationID = ?`,
              [certs[0].QualificationID]
            );

            let allPassed = true;
            for (const mod of allModules) {
              const [passed] = await query(
                `SELECT 1 FROM AssessmentAttempts
                 WHERE UserID = ? AND Status = 'Passed'
                 AND AssessmentID IN (SELECT AssessmentID FROM Assessments WHERE ModuleID = ?)
                 LIMIT 1`,
                [userId, mod.ModuleID]
              );

              if (passed.length === 0) {
                allPassed = false;
                break;
              }
            }

            if (allPassed) {
              // Update certificate to Issued
              await query(
                "UPDATE Certificates SET Status = 'Issued' WHERE CertificateID = ?",
                [certs[0].CertificateID]
              );

              // Send certificate notification
              await notificationService.notificationHelpers.notifyCertificateIssued(
                userId,
                certs[0].QualificationName
              );
            }
          }
        }
      }
    } else {
      // Send failure notification
      const [assessments] = await query(
        "SELECT ModuleID FROM Assessments WHERE AssessmentID = ? LIMIT 1",
        [assessmentId]
      );

      if (assessments.length > 0) {
        const [modules] = await query(
          "SELECT ModuleTitle FROM Modules WHERE ModuleID = ? LIMIT 1",
          [assessments[0].ModuleID]
        );

        if (modules.length > 0) {
          await notificationService.notificationHelpers.notifyAssessmentResult(
            userId,
            modules[0].ModuleTitle,
            false,
            attempt.score
          );
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: "Assessment attempt submitted successfully.",
      data: attempt,
    });
  } catch (error) {
    console.error("Submit assessment attempt error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit assessment attempt.",
    });
  }
}

/**
 * Get user's assessment attempt history for a module
 */
async function getAssessmentHistory(req, res) {
  try {
    const { userId } = req.user;
    const { moduleId } = req.params;

    const attempts = await assessmentService.getUserAssessmentAttempts(
      userId,
      moduleId
    );

    return res.json({
      success: true,
      data: attempts,
    });
  } catch (error) {
    console.error("Get assessment history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assessment history.",
    });
  }
}

async function listAssessments(req, res) {
  try {
    const moduleId = req.query.moduleId ? Number(req.query.moduleId) : null;
    const assessments = await assessmentService.listAssessments(moduleId);

    return res.json({
      success: true,
      data: { assessments },
    });
  } catch (error) {
    console.error('List assessments error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assessments.',
    });
  }
}

async function createAssessment(req, res) {
  try {
    const { userId } = req.user;
    const { moduleId, title, passingScore, durationMinutes, attemptLimit, badgeId } = req.body;
    const assessment = await assessmentService.createAssessment(
      Number(moduleId),
      title,
      Number.isFinite(Number(passingScore)) ? Number(passingScore) : 60,
      Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 120,
      Number.isFinite(Number(attemptLimit)) ? Number(attemptLimit) : 3,
      Number.isFinite(Number(badgeId)) ? Number(badgeId) : null,
      Number(userId)
    );

    return res.status(201).json({ success: true, data: assessment });
  } catch (error) {
    console.error('Create assessment error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create assessment.',
    });
  }
}

async function updateAssessmentSettings(req, res) {
  try {
    const { assessmentId } = req.params;
    const { passingScore, durationMinutes, attemptLimit, title } = req.body;

    const parsedPassingScore = Number(passingScore);
    const parsedDurationMinutes = Number(durationMinutes);
    const parsedAttemptLimit = Number(attemptLimit);

    const result = await assessmentService.updateAssessmentSettings(
      Number(assessmentId),
      Number.isFinite(parsedPassingScore) ? parsedPassingScore : undefined,
      Number.isFinite(parsedDurationMinutes) ? parsedDurationMinutes : undefined,
      Number.isFinite(parsedAttemptLimit) ? parsedAttemptLimit : undefined,
      typeof title === 'string' ? title : undefined
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update assessment settings error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update assessment settings.',
    });
  }
}

async function deleteAssessment(req, res) {
  try {
    const { assessmentId } = req.params;
    await assessmentService.deleteAssessment(Number(assessmentId));

    return res.status(204).send();
  } catch (error) {
    console.error('Delete assessment error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete assessment.',
    });
  }
}

async function getAssessmentQuestionsAdmin(req, res) {
  try {
    const { assessmentId } = req.params;
    const assessment = await assessmentService.getAssessmentQuestions(assessmentId, true, 'assessment');

    return res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error('Get admin assessment questions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assessment questions.',
    });
  }
}

async function addAssessmentQuestionAdmin(req, res) {
  try {
    const { assessmentId } = req.params;
    const { questionText, questionType, options, correctAnswer } = req.body;
    const result = await assessmentService.addAssessmentQuestion(
      Number(assessmentId),
      questionText,
      questionType,
      options,
      correctAnswer
    );

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Add assessment question error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to add assessment question.',
    });
  }
}

async function updateAssessmentQuestionAdmin(req, res) {
  try {
    const { questionId } = req.params;
    const { questionText, questionType, options, correctAnswer } = req.body;
    const result = await assessmentService.updateAssessmentQuestion(
      Number(questionId),
      questionText,
      questionType,
      options,
      correctAnswer
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update assessment question error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update assessment question.',
    });
  }
}

async function deleteAssessmentQuestionAdmin(req, res) {
  try {
    const { questionId } = req.params;
    const result = await assessmentService.deleteAssessmentQuestion(Number(questionId));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Delete assessment question error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete assessment question.',
    });
  }
}

async function getAssessmentAttemptsAdmin(req, res) {
  try {
    const { assessmentId } = req.params;
    const attempts = await assessmentService.getAssessmentAttempts(Number(assessmentId));

    return res.json({
      success: true,
      data: { attempts },
    });
  } catch (error) {
    console.error('Get assessment attempts error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assessment attempts.',
    });
  }
}

async function resetAssessmentAttemptAdmin(req, res) {
  try {
    const { assessmentId, attemptId } = req.params;
    const result = await assessmentService.resetUserAttempt(Number(assessmentId), Number(attemptId));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Reset assessment attempt error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to reset assessment attempt.',
    });
  }
}

/**
 * Get assessment details for a specific assessment ID
 */
async function getAssessmentDetails(req, res) {
  try {
    const { assessmentId } = req.params;

    const [rows] = await query(
      `SELECT AssessmentID, ModuleID, BadgeID, Title, PassingScore, AttemptLimit, DurationMinutes
       FROM Assessments
       WHERE AssessmentID = ?
       LIMIT 1`,
      [assessmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found.",
      });
    }

    const assessment = rows[0];

    return res.json({
      success: true,
      data: {
        AssessmentID: assessment.AssessmentID,
        ModuleID: assessment.ModuleID,
        BadgeID: assessment.BadgeID,
        Title: assessment.Title,
        PassingScore: assessment.PassingScore,
        AttemptLimit: assessment.AttemptLimit,
        DurationMinutes: Number(assessment.DurationMinutes || 120),
      },
    });
  } catch (error) {
    console.error("Get assessment details error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assessment details.",
    });
  }
}

async function linkAssessmentBadge(req, res) {
  try {
    const { assessmentId, badgeId } = req.params;
    const result = await assessmentService.linkBadgeToAssessment(
      Number(assessmentId),
      Number(badgeId)
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Link assessment badge error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to link badge to assessment.',
    });
  }
}

async function unlinkAssessmentBadge(req, res) {
  try {
    const { assessmentId } = req.params;
    const result = await assessmentService.unlinkBadgeFromAssessment(Number(assessmentId));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Unlink assessment badge error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to unlink badge from assessment.',
    });
  }
}

async function getAssessmentBadge(req, res) {
  try {
    const { assessmentId } = req.params;
    const result = await assessmentService.getAssessmentBadge(Number(assessmentId));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get assessment badge error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assessment badge.',
    });
  }
}

/**
 * Admin: issue a badge to a user (create UserBadges row).
 * POST /admin/users/:userId/badges
 * Body: { badgeId, assessmentId?, moduleId? }
 */
async function issueBadgeToUser(req, res) {
  try {
    const issuedBy = req.user.userId;
    const targetUserId = Number(req.params.userId);
    const badgeId = Number(req.body.badgeId);
    const assessmentId = req.body.assessmentId ? Number(req.body.assessmentId) : null;
    const moduleId = req.body.moduleId ? Number(req.body.moduleId) : null;

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid target user ID.' });
    }

    if (!Number.isInteger(badgeId) || badgeId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid badge ID.' });
    }

    // Ensure user exists
    const [userRows] = await query('SELECT UserID FROM Users WHERE UserID = ? LIMIT 1', [targetUserId]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Target user not found.' });
    }

    // Ensure badge exists and is active
    const [badgeRows] = await query('SELECT BadgeID FROM Badges WHERE BadgeID = ? AND IsActive = 1 LIMIT 1', [badgeId]);
    if (badgeRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Badge not found or inactive.' });
    }

    // Insert award (unique constraint on UserID,BadgeID prevents duplicates)
    await query(
      `INSERT INTO UserBadges (UserID, BadgeID, IssuedBy, AssessmentID, ModuleID)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE IssuedBy = VALUES(IssuedBy), AssessmentID = VALUES(AssessmentID), ModuleID = VALUES(ModuleID), IssuedAt = CURRENT_TIMESTAMP`,
      [targetUserId, badgeId, issuedBy, assessmentId, moduleId]
    );

    return res.json({ success: true, message: 'Badge issued to user.' });
  } catch (error) {
    console.error('Issue badge to user error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to issue badge.' });
  }
}

module.exports = {
  getAssessmentQuestions,
  checkAttemptEligibility,
  submitAssessmentAttempt,
  getAssessmentHistory,
  getAssessmentDetails,
  listAssessments,
  createAssessment,
  updateAssessmentSettings,
  deleteAssessment,
  getAssessmentQuestionsAdmin,
  addAssessmentQuestionAdmin,
  updateAssessmentQuestionAdmin,
  deleteAssessmentQuestionAdmin,
  getAssessmentAttemptsAdmin,
  resetAssessmentAttemptAdmin,
  linkAssessmentBadge,
  unlinkAssessmentBadge,
  getAssessmentBadge,
  issueBadgeToUser,
};
