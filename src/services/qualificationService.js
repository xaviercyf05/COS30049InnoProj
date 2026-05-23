const { query } = require("../config/db");

/**
 * Service for managing user learning progress, qualifications, and enrollments.
 */

let manualCompletionSchemaPromise;

async function ensureManualCompletionSchema() {
  if (!manualCompletionSchemaPromise) {
    manualCompletionSchemaPromise = query(
      `CREATE TABLE IF NOT EXISTS ModuleCompletions (
        ModuleCompletionID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        UserID INT UNSIGNED NOT NULL,
        ModuleID INT UNSIGNED NOT NULL,
        AssessmentID INT UNSIGNED NULL,
        CompletionStatus ENUM('completed','incomplete') NOT NULL DEFAULT 'completed',
        CompletedBy INT UNSIGNED NULL,
        CompletedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UpdatedByAdminID INT UNSIGNED NULL,
        UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_module_completions_user_module (UserID, ModuleID),
        CONSTRAINT fk_module_completions_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE,
        CONSTRAINT fk_module_completions_module FOREIGN KEY (ModuleID) REFERENCES Modules (ModuleID) ON DELETE CASCADE,
        CONSTRAINT fk_module_completions_assessment FOREIGN KEY (AssessmentID) REFERENCES Assessments (AssessmentID) ON DELETE SET NULL,
        CONSTRAINT fk_module_completions_completed_by FOREIGN KEY (CompletedBy) REFERENCES Users (UserID) ON DELETE SET NULL,
        CONSTRAINT fk_module_completions_updated_by_admin FOREIGN KEY (UpdatedByAdminID) REFERENCES Users (UserID) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ).catch((error) => {
      manualCompletionSchemaPromise = null;
      throw error;
    });

    const [columns] = await query(
      `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'ModuleCompletions'`
    );

    const existingColumns = new Set(columns.map((column) => column.COLUMN_NAME));
    const alterStatements = [];

    if (!existingColumns.has('CompletionStatus')) {
      alterStatements.push("ADD COLUMN CompletionStatus ENUM('completed','incomplete') NOT NULL DEFAULT 'completed' AFTER AssessmentID");
    }

    if (!existingColumns.has('UpdatedByAdminID')) {
      alterStatements.push('ADD COLUMN UpdatedByAdminID INT UNSIGNED NULL AFTER CompletedAt');
    }

    if (alterStatements.length > 0) {
      await query(`ALTER TABLE ModuleCompletions ${alterStatements.join(', ')}`);
    }
  }

  return manualCompletionSchemaPromise;
}

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

    await query(
      "UPDATE Users SET QualificationID = ? WHERE UserID = ?",
      [qualificationId, userId]
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
      // Check if module has subsections (materials)
      const [materials] = await query(
        `SELECT SubsectionID FROM Subsections WHERE SectionID IN (
           SELECT SectionID FROM Sections WHERE ModuleID = ?
         ) LIMIT 1`,
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
          `SELECT COUNT(DISTINCT mp.SubsectionID) as completed
           FROM MaterialProgress mp
           WHERE mp.UserID = ? AND mp.IsCompleted = 1
           AND mp.SubsectionID IN (
             SELECT SubsectionID FROM Subsections WHERE SectionID IN (
               SELECT SectionID FROM Sections WHERE ModuleID = ?
             )
           )`,
          [userId, module.ModuleID]
        );

        const completed = completedMaterials[0]?.completed || 0;

        const [totalCountRows] = await query(
          `SELECT COUNT(1) as total FROM Subsections WHERE SectionID IN (
             SELECT SectionID FROM Sections WHERE ModuleID = ?
           )`,
          [module.ModuleID]
        );

        const total = totalCountRows[0]?.total || 0;

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

/**
 * Check whether a specific module is unlocked for a user.
 * Uses the existing getQualificationProgress logic and finds module's isUnlocked flag.
 */
async function isModuleUnlocked(userId, moduleId) {
  try {
    const [rows] = await query(
      `SELECT QualificationID FROM Modules WHERE ModuleID = ? LIMIT 1`,
      [moduleId]
    );

    if (rows.length === 0) {
      throw new Error('Module not found');
    }

    const qualificationId = rows[0].QualificationID;
    const progress = await getQualificationProgress(userId, qualificationId);

    const found = (progress.moduleProgress || []).find((m) => Number(m.moduleId) === Number(moduleId));
    return !!(found && found.isUnlocked);
  } catch (error) {
    throw error;
  }
}

async function isAssessmentPassed(userId, assessmentId) {
  const [rows] = await query(
    `SELECT 1
       FROM AssessmentAttempts
      WHERE UserID = ?
        AND AssessmentID = ?
        AND Status = 'Passed'
      LIMIT 1`,
    [userId, assessmentId]
  );

  return rows.length > 0;
}

async function hasPassedAssessmentForModule(userId, moduleId) {
  const [rows] = await query(
    `SELECT 1
       FROM AssessmentAttempts aa
       INNER JOIN Assessments a ON a.AssessmentID = aa.AssessmentID
      WHERE aa.UserID = ?
        AND a.ModuleID = ?
        AND aa.Status = 'Passed'
      LIMIT 1`,
    [userId, moduleId]
  );

  return rows.length > 0;
}

async function isModuleCompleted(userId, moduleId) {
  await ensureManualCompletionSchema();

  const [rows] = await query(
    `SELECT 1
       FROM ModuleCompletions
      WHERE UserID = ?
        AND ModuleID = ?
      LIMIT 1`,
    [userId, moduleId]
  );

  return rows.length > 0;
}

async function getUserModuleCompletionStatuses(userId, moduleIds = []) {
  await ensureManualCompletionSchema();

  const validModuleIds = [...new Set(
    (Array.isArray(moduleIds) ? moduleIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  )];

  if (validModuleIds.length === 0) {
    return new Map();
  }

  const placeholders = validModuleIds.map(() => '?').join(', ');
  const [rows] = await query(
    `SELECT UserID,
            ModuleID,
            AssessmentID,
            CompletionStatus,
            CompletedBy,
            CompletedAt,
            UpdatedByAdminID,
            UpdatedAt
       FROM ModuleCompletions
      WHERE UserID = ?
        AND ModuleID IN (${placeholders})`,
    [userId, ...validModuleIds]
  );

  return new Map(
    rows.map((row) => [
      Number(row.ModuleID),
      {
        userId: Number(row.UserID),
        moduleId: Number(row.ModuleID),
        assessmentId: row.AssessmentID ? Number(row.AssessmentID) : null,
        completionStatus: String(row.CompletionStatus || 'incomplete').toLowerCase(),
        completedAt: row.CompletedAt || null,
        updatedByAdminId: row.UpdatedByAdminID ? Number(row.UpdatedByAdminID) : null,
        updatedAt: row.UpdatedAt || null,
        completedBy: row.CompletedBy ? Number(row.CompletedBy) : null,
      },
    ])
  );
}

async function getModuleCompletions(moduleId = null) {
  await ensureManualCompletionSchema();

  const params = [];
  let whereClause = '';

  if (Number.isInteger(Number(moduleId)) && Number(moduleId) > 0) {
    whereClause = 'WHERE mc.ModuleID = ?';
    params.push(Number(moduleId));
  }

  const [rows] = await query(
    `SELECT mc.UserID,
            mc.ModuleID,
            mc.AssessmentID,
            mc.CompletedBy,
            mc.CompletedAt,
            mc.UpdatedAt,
            u.FullName,
            u.Username
       FROM ModuleCompletions mc
       INNER JOIN Users u ON u.UserID = mc.UserID
       ${whereClause}
      ORDER BY mc.UpdatedAt DESC, mc.CompletedAt DESC, mc.UserID ASC`,
    params
  );

  return rows.map((row) => ({
    userId: Number(row.UserID),
    moduleId: Number(row.ModuleID),
    assessmentId: row.AssessmentID ? Number(row.AssessmentID) : null,
    completionStatus: String(row.CompletionStatus || 'completed').toLowerCase(),
    updatedAt: row.UpdatedAt,
    completedAt: row.CompletedAt,
    note: null,
    parkGuideName: row.FullName || row.Username || `User ${row.UserID}`,
    userName: row.Username || null,
  }));
}

async function markModuleCompletedByAdmin(userId, moduleId, completedBy, assessmentId = null) {
  await ensureManualCompletionSchema();

  await query(
    `INSERT INTO ModuleCompletions (UserID, ModuleID, AssessmentID, CompletedBy, CompletedAt)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       CompletionStatus = 'completed',
       AssessmentID = VALUES(AssessmentID),
       CompletedBy = VALUES(CompletedBy),
       UpdatedByAdminID = VALUES(CompletedBy),
       CompletedAt = CURRENT_TIMESTAMP,
       UpdatedAt = CURRENT_TIMESTAMP`,
    [userId, moduleId, assessmentId, completedBy]
  );

  return {
    userId,
    moduleId,
    assessmentId,
    completedBy,
    completionStatus: 'completed',
    completedAt: new Date().toISOString(),
  };
}

async function canIssueBadgeForAssessment(userId, assessmentId) {
  const [assessmentRows] = await query(
    `SELECT a.AssessmentID,
            a.ModuleID,
            m.ModuleTitle,
            m.LinkedTpaModuleID,
            mt.TypeName
       FROM Assessments a
       INNER JOIN Modules m ON m.ModuleID = a.ModuleID
       LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
      WHERE a.AssessmentID = ?
      LIMIT 1`,
    [assessmentId]
  );

  if (assessmentRows.length === 0) {
    return {
      allowed: false,
      reason: 'Assessment not found',
    };
  }

  const assessment = assessmentRows[0];
  const normalizedTypeName = String(assessment.TypeName || '').trim().toLowerCase();
  const isTpaModule = normalizedTypeName === 'total protected area modules';
  const isOnsiteModule = normalizedTypeName === 'on-site training modules';

  const passedAssessment = await isAssessmentPassed(userId, assessmentId);
  if (!passedAssessment) {
    return {
      allowed: false,
      reason: 'User has not passed the assessment',
      assessment,
    };
  }

  if (isOnsiteModule) {
    const completedModule = await isModuleCompleted(userId, assessment.ModuleID);
    if (!completedModule) {
      return {
        allowed: false,
        reason: 'On-site module must be marked as completed by admin',
        assessment,
      };
    }

    const linkedTpaModuleId = Number(assessment.LinkedTpaModuleID || 0);
    if (linkedTpaModuleId > 0) {
      const passedLinkedTpaModule = await hasPassedAssessmentForModule(userId, linkedTpaModuleId);
      if (!passedLinkedTpaModule) {
        return {
          allowed: false,
          reason: 'User must pass the linked TPA module assessment before badge issue',
          assessment,
        };
      }
    }
  }

  if (isTpaModule) {
    const [linkedOnsiteRows] = await query(
      `SELECT m.ModuleID, m.ModuleTitle
         FROM Modules m
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        WHERE m.LinkedTpaModuleID = ?
          AND LOWER(TRIM(COALESCE(mt.TypeName, ''))) = 'on-site training modules'`,
      [assessment.ModuleID]
    );

    if (linkedOnsiteRows.length === 0) {
      return {
        allowed: false,
        reason: 'No linked on-site modules are configured for this TPA module',
        assessment,
      };
    }

    const completionChecks = await Promise.all(
      linkedOnsiteRows.map(async (moduleRow) => {
        const completed = await isModuleCompleted(userId, moduleRow.ModuleID);
        return {
          moduleId: moduleRow.ModuleID,
          moduleTitle: moduleRow.ModuleTitle,
          completed,
        };
      })
    );

    const incompleteOnsiteModules = completionChecks.filter((item) => !item.completed);
    if (incompleteOnsiteModules.length > 0) {
      return {
        allowed: false,
        reason: `On-site module completion required before badge issue: ${incompleteOnsiteModules
          .map((item) => item.moduleTitle || `Module ${item.moduleId}`)
          .join(', ')}`,
        assessment,
      };
    }
  }

  return {
    allowed: true,
    reason: null,
    assessment,
  };
}

module.exports = {
  enrollUserInQualification,
  getQualificationProgress,
  getUserQualifications,
  isModuleUnlocked,
  isAssessmentPassed,
  isModuleCompleted,
  getUserModuleCompletionStatuses,
  getModuleCompletions,
  markModuleCompletedByAdmin,
  canIssueBadgeForAssessment,
};
