const { query } = require("../config/db");
const assessmentService = require("../services/assessmentService");
const notificationService = require("../services/notificationService");

/**
 * Controller for assessments - handles questions, submissions, and scoring.
 */

/**
 * Get assessment questions for a module
 */
async function getAssessmentQuestions(req, res) {
  try {
    const { moduleId } = req.params;

    const assessment = await assessmentService.getAssessmentQuestions(moduleId);

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
    const { assessmentId, answers } = req.body;

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
      answers
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

module.exports = {
  getAssessmentQuestions,
  checkAttemptEligibility,
  submitAssessmentAttempt,
  getAssessmentHistory,
};
