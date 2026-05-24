const { query } = require("../config/db");

/**
 * Service for managing user learning progress, qualifications, and enrollments.
 */

/**
 * Enroll a user in a qualification. Creates Certificates entry and provides access to Module 1.
 */
async function enrollUserInQualification(userId, qualificationId) {
  try {
    // Check if qualification exists
    const [qualRows] = await query(
      "SELECT QualificationID FROM Qualifications WHERE QualificationID = ? LIMIT 1",
      [qualificationId]
    );

    if (qualRows.length === 0) {
      throw new Error("Qualification not found");
    }

    // Check if user already enrolled
    const [existingEnroll] = await query(
      "SELECT CertificateID FROM Certificates WHERE UserID = ? AND QualificationID = ? LIMIT 1",
      [userId, qualificationId]
    );

    if (existingEnroll.length > 0) {
      throw new Error("User already enrolled in this qualification");
    }

    // Get qualification name
    const [qualData] = await query(
      "SELECT QualificationName FROM Qualifications WHERE QualificationID = ? LIMIT 1",
      [qualificationId]
    );

    const qualName = qualData[0].QualificationName;

    // Create certificate entry with 'Pending' status
    const [result] = await query(
      "INSERT INTO Certificates (UserID, QualificationID, QualificationName, Status) VALUES (?, ?, ?, 'Pending')",
      [userId, qualificationId, qualName]
    );

    return {
      certificateId: result.insertId,
      qualificationId,
      status: "Pending",
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get user's qualification progress (modules completed, overall status)
 */
async function getQualificationProgress(userId, qualificationId) {
  try {
    // Get all modules for qualification in order
    const [modules] = await query(
      "SELECT ModuleID, ModuleTitle FROM Modules WHERE QualificationID = ? ORDER BY ModuleID ASC",
      [qualificationId]
    );

    if (modules.length === 0) {
      throw new Error("No modules found for this qualification");
    }

    // For each module, check completion and assessment pass status
    const moduleProgress = [];
    for (const module of modules) {
      // Check if all materials in module are completed
      const [materials] = await query(
        "SELECT MaterialID FROM LearningMaterials WHERE ModuleID = ? LIMIT 1",
        [module.ModuleID]
      );

      if (materials.length === 0) {
        // No materials, mark as automatically completed
        moduleProgress.push({
          moduleId: module.ModuleID,
          moduleTitle: module.ModuleTitle,
          materialsCompleted: 0,
          materialTotal: 0,
          assessmentPassed: false,
          canAttemptAssessment: true,
          isUnlocked: moduleProgress.length === 0, // First module always unlocked
        });
      } else {
        const [completedMaterials] = await query(
          `SELECT COUNT(DISTINCT mp.MaterialID) as completed
           FROM MaterialProgress mp
           WHERE mp.UserID = ? AND mp.IsCompleted = 1
           AND mp.MaterialID IN (SELECT MaterialID FROM LearningMaterials WHERE ModuleID = ?)`,
          [userId, module.ModuleID]
        );

        const completed = completedMaterials[0]?.completed || 0;
        const total = materials.length;

        // Check if user has passed assessment for this module
        const [assessmentPass] = await query(
          `SELECT 1 FROM AssessmentAttempts
           WHERE UserID = ? AND Status = 'Passed' 
           AND AssessmentID IN (SELECT AssessmentID FROM Assessments WHERE ModuleID = ?)
           LIMIT 1`,
          [userId, module.ModuleID]
        );

        const isPassed = assessmentPass.length > 0;
        const isUnlocked =
          moduleProgress.length === 0 ||
          moduleProgress[moduleProgress.length - 1].assessmentPassed;

        moduleProgress.push({
          moduleId: module.ModuleID,
          moduleTitle: module.ModuleTitle,
          materialsCompleted: completed,
          materialTotal: total,
          assessmentPassed: isPassed,
          canAttemptAssessment: isUnlocked,
          isUnlocked,
        });
      }
    }

    // Determine overall qualification status
    const allPassed = moduleProgress.every((m) => m.assessmentPassed);

    return {
      qualificationId,
      moduleProgress,
      overallStatus: allPassed ? "Completed" : "In Progress",
      completionPercentage: Math.round(
        (moduleProgress.filter((m) => m.assessmentPassed).length /
          moduleProgress.length) *
          100
      ),
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get user's enrolled qualifications
 */
async function getUserQualifications(userId) {
  try {
    const [certs] = await query(
      `SELECT c.CertificateID, c.QualificationID, c.QualificationName, c.Status
       FROM Certificates c
       WHERE c.UserID = ?
       ORDER BY c.QualificationID ASC`,
      [userId]
    );

    return certs.map((cert) => ({
      certificateId: cert.CertificateID,
      qualificationId: cert.QualificationID,
      qualificationName: cert.QualificationName,
      status: cert.Status,
    }));
  } catch (error) {
    throw error;
  }
}

module.exports = {
  enrollUserInQualification,
  getQualificationProgress,
  getUserQualifications,
};
