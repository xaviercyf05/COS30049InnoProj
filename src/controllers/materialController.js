const { query } = require("../config/db");
const materialService = require("../services/materialService");
const qualificationService = require("../services/qualificationService");
const progressService = require("../services/progressService");
const {
  ensureModuleUiSchema,
  resolveModuleCoverImage,
} = require("../services/moduleUiService");

/**
 * Controller for learning modules and materials.
 */

function normalizeModuleStage(typeName) {
  const normalized = String(typeName || "").trim().toLowerCase();

  if (normalized.includes("on-site")) {
    return "onsite";
  }

  if (normalized.includes("protected area") || normalized.includes("tpa")) {
    return "tpa";
  }

  return "general";
}

/**
 * Get dashboard module cards with user-specific progress.
 */
async function getDashboardModules(req, res) {
  try {
    const { userId } = req.user;

    await ensureModuleUiSchema();

    const [userRows] = await query(
      `SELECT QualificationID, Progress
         FROM Users
        WHERE UserID = ?
        LIMIT 1`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.json({
        success: true,
        summary: {
          overallProgress: Number(userRows[0]?.Progress || 0),
        },
        data: [],
      });
    }

    let qualificationId = Number(userRows[0].QualificationID || 0);

    if (!qualificationId) {
      const [certificateRows] = await query(
        `SELECT QualificationID
           FROM Certificates
          WHERE UserID = ?
          ORDER BY CertificateID DESC
          LIMIT 1`,
        [userId]
      );

      if (certificateRows.length > 0 && certificateRows[0].QualificationID) {
        qualificationId = Number(certificateRows[0].QualificationID);
        await query(
          "UPDATE Users SET QualificationID = ? WHERE UserID = ?",
          [qualificationId, userId]
        ).catch(() => {});
      }
    }

    let rows = [];

    if (qualificationId) {
      const [qualificationRows] = await query(
        `SELECT m.ModuleID,
                m.QualificationID,
                m.ModuleTitle,
                m.ModuleTypeID,
          m.ModulePrice,
                mt.TypeName,
                 meta.CoverImageUrl,
                 meta.Summary,
                 m.LinkedTpaModuleID,
                 m.LinkedOnsiteModuleID
           FROM Modules m
           LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
           LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
          WHERE m.QualificationID = ?
          ORDER BY m.ModuleTypeID ASC, m.ModuleID ASC`,
        [qualificationId]
      );

      rows = qualificationRows;
    }

    if (rows.length === 0) {
      const [certificateModuleRows] = await query(
        `SELECT m.ModuleID,
                m.QualificationID,
                m.ModuleTitle,
                m.ModuleTypeID,
          m.ModulePrice,
                mt.TypeName,
                 meta.CoverImageUrl,
                 meta.Summary,
                 m.LinkedTpaModuleID,
                 m.LinkedOnsiteModuleID
           FROM Certificates c
           INNER JOIN Modules m ON m.QualificationID = c.QualificationID
           LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
           LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
          WHERE c.UserID = ?
          ORDER BY c.CertificateID DESC, m.ModuleTypeID ASC, m.ModuleID ASC`,
        [userId]
      );

      rows = certificateModuleRows;

      if (!qualificationId && rows.length > 0 && rows[0].QualificationID) {
        qualificationId = Number(rows[0].QualificationID);
        await query(
          "UPDATE Users SET QualificationID = ? WHERE UserID = ?",
          [qualificationId, userId]
        ).catch(() => {});
      }
    }

    if (rows.length === 0) {
      const [allModuleRows] = await query(
        `SELECT m.ModuleID,
                m.QualificationID,
                m.ModuleTitle,
                m.ModuleTypeID,
          m.ModulePrice,
                mt.TypeName,
                 meta.CoverImageUrl,
                 meta.Summary,
                 m.LinkedTpaModuleID,
                 m.LinkedOnsiteModuleID
           FROM Modules m
           LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
           LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
          ORDER BY m.ModuleTypeID ASC, m.ModuleID ASC`
      );

      rows = allModuleRows;

      if (!qualificationId && rows.length > 0 && rows[0].QualificationID) {
        qualificationId = Number(rows[0].QualificationID);
      }
    }

    if (rows.length === 0) {
      return res.json({
        success: true,
        summary: {
          overallProgress: Number(userRows[0]?.Progress || 0),
        },
        data: [],
      });
    }

    const moduleIds = [...new Set(
      rows
        .map((row) => Number(row.ModuleID))
        .filter((moduleId) => Number.isInteger(moduleId) && moduleId > 0)
    )];

    const [progressRows] = moduleIds.length > 0
      ? await query(
          `SELECT moduleId, progressPercent
             FROM user_progress
            WHERE userId = ?
              AND moduleId IN (${moduleIds.map(() => "?").join(",")})`,
          [userId, ...moduleIds]
        )
      : [[]];

    const rowQualificationIds = [...new Set(rows.map((row) => Number(row.QualificationID)).filter(Boolean))];
    const progressQualificationId = qualificationId || (rowQualificationIds.length === 1 ? rowQualificationIds[0] : 0);

    let qualificationProgress = { moduleProgress: [] };
    if (progressQualificationId) {
      try {
        qualificationProgress = await qualificationService.getQualificationProgress(
          userId,
          progressQualificationId
        );
      } catch (_error) {
        qualificationProgress = { moduleProgress: [] };
      }
    }

    const progressByModuleId = new Map(
      progressRows.map((row) => [Number(row.moduleId), Number(row.progressPercent || 0)])
    );

    const unlockByModuleId = new Map(
      (qualificationProgress.moduleProgress || []).map((item) => [
        Number(item.moduleId),
        {
          unlocked: !!item.isUnlocked,
          assessmentPassed: !!item.assessmentPassed,
        },
      ])
    );

    const data = rows.map((row, index) => {
      const progressPercent = Number(progressByModuleId.get(Number(row.ModuleID)) || 0);
      const unlockState = unlockByModuleId.get(Number(row.ModuleID)) || {
        unlocked: index === 0,
        assessmentPassed: false,
      };

      return {
        moduleId: row.ModuleID,
        title: row.ModuleTitle,
        stage: normalizeModuleStage(row.TypeName),
        progressPercent,
        unlocked: unlockState.unlocked,
        lockReason: unlockState.unlocked ? "" : "Complete the previous module to unlock this module.",
        qualificationId: row.QualificationID,
        moduleTypeId: row.ModuleTypeID,
        moduleType: row.TypeName || "Unassigned",
        modulePrice: row.ModulePrice === null || row.ModulePrice === undefined ? null : Number(row.ModulePrice),
        image: resolveModuleCoverImage(row.ModuleID, row.CoverImageUrl),
          summary: row.Summary || '',
          linkedTpaModuleId: row.LinkedTpaModuleID || null,
          linkedOnsiteModuleId: row.LinkedOnsiteModuleID || null,
        };
    });

    const overallProgress = data.length > 0
      ? Math.round(data.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / data.length)
      : Number(userRows[0]?.Progress || 0);

    progressService.syncUserOverallProgress(userId).catch((error) => {
      console.warn("Unable to sync overall progress snapshot:", error.message);
    });

    return res.json({
      success: true,
      summary: {
        overallProgress,
      },
      data,
    });
  } catch (error) {
    console.error("Get dashboard modules error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard modules.",
    });
  }
}

/**
 * Get all modules for a qualification, organized by module type
 */
async function getQualificationModules(req, res) {
  try {
    const { qualificationId } = req.params;

    const [modules] = await query(
      `SELECT m.ModuleID,
              m.ModuleTitle,
              m.ModuleTypeID,
              m.ModulePrice,
              mt.TypeName
         FROM Modules m
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        WHERE m.QualificationID = ?
        ORDER BY m.ModuleTypeID ASC, m.ModuleID ASC`,
      [qualificationId]
    );

    // Organize modules by their type section
    const modulesByType = {};
    for (const m of modules) {
      const typeName = m.TypeName || "Unassigned";
      const typeId = m.ModuleTypeID;

      if (!modulesByType[typeName]) {
        modulesByType[typeName] = {
          typeId,
          typeName,
          modules: [],
        };
      }

      modulesByType[typeName].modules.push({
        moduleId: m.ModuleID,
        title: m.ModuleTitle,
        modulePrice: m.ModulePrice === null || m.ModulePrice === undefined ? null : Number(m.ModulePrice),
      });
    }

    return res.json({
      success: true,
      data: Object.values(modulesByType),
    });
  } catch (error) {
    console.error("Get modules error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch modules.",
    });
  }
}

/**
 * Get module details and materials
 */
async function getModuleDetails(req, res) {
  try {
    const { userId } = req.user;
    const { moduleId } = req.params;

    // Get module info with type details
    const [modules] = await query(
      `SELECT m.ModuleID,
              m.QualificationID,
              m.ModuleTitle,
              m.ModuleTypeID,
              m.ModulePrice,
            mt.TypeName,
            meta.Summary
         FROM Modules m
          LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        WHERE m.ModuleID = ?
        LIMIT 1`,
      [moduleId]
    );

    if (modules.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Module not found.",
      });
    }

    const module = modules[0];

    // Get materials
    const materials = await materialService.getModuleMaterials(userId, moduleId);

    // Get chapters/sections
    const chapters = await materialService.getModuleChapters(moduleId);

    return res.json({
      success: true,
      data: {
        moduleId: module.ModuleID,
        qualificationId: module.QualificationID,
        title: module.ModuleTitle,
        moduleTypeId: module.ModuleTypeID,
        moduleType: module.TypeName || "Unassigned",
        modulePrice: module.ModulePrice === null || module.ModulePrice === undefined ? null : Number(module.ModulePrice),
        summary: module.Summary || "",
        sections: chapters,
        chapters,
        materials,
      },
    });
  } catch (error) {
    console.error("Get module details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch module details.",
    });
  }
}

/**
 * Get material content for reading
 */
async function getMaterialContent(req, res) {
  try {
    const { userId } = req.user;
    const { materialId } = req.params;

    const material = await materialService.getMaterialContent(userId, materialId);

    return res.json({
      success: true,
      data: material,
    });
  } catch (error) {
    console.error("Get material content error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch material content.",
    });
  }
}

/**
 * Mark material as completed
 */
async function completeMaterial(req, res) {
  try {
    const { userId } = req.user;
    const { materialId } = req.body;

    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: "Material ID is required.",
      });
    }

    const result = await materialService.markMaterialComplete(userId, materialId);

    return res.json({
      success: true,
      message: "Material marked as completed.",
      data: result,
    });
  } catch (error) {
    console.error("Complete material error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark material as completed.",
    });
  }
}

/**
 * Get user's progress for a module
 * Returns current progress percentage and visited sections
 * If no progress exists, returns 0% with empty array
 */
async function getModuleProgress(req, res) {
  try {
    const { userId } = req.user;
    const { moduleId } = req.params;

    // Fetch progress from database
    const progress = await progressService.getUserModuleProgress(userId, moduleId);

    // Return empty progress if not found
    if (!progress) {
      return res.json({
        success: true,
        data: {
          moduleId: parseInt(moduleId),
          visitedSectionIds: [],
          progressPercent: 0,
          lastSectionId: null,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        moduleId: progress.moduleId,
        visitedSectionIds: progress.visitedSectionIds,
        progressPercent: progress.progressPercent,
        lastSectionId: progress.lastSectionId,
        updatedAt: progress.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get module progress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch module progress.",
    });
  }
}

/**
 * Save user's progress for a module
 * Accepts visitedSectionIds array and progressPercent
 */
async function saveModuleProgress(req, res) {
  try {
    const { userId } = req.user;
    const { moduleId } = req.params;
    const { visitedSectionIds, progressPercent, lastSectionId } = req.body;

    // Validate input
    if (!visitedSectionIds || !Array.isArray(visitedSectionIds)) {
      return res.status(400).json({
        success: false,
        message: "visitedSectionIds must be an array.",
      });
    }

    if (typeof progressPercent !== "number" || progressPercent < 0 || progressPercent > 100) {
      return res.status(400).json({
        success: false,
        message: "progressPercent must be a number between 0 and 100.",
      });
    }

    // Save progress
    const savedProgress = await progressService.saveUserModuleProgress(
      userId,
      parseInt(moduleId),
      visitedSectionIds,
      progressPercent,
      lastSectionId
    );

    return res.json({
      success: true,
      message: "Progress saved successfully.",
      data: {
        moduleId: savedProgress.moduleId,
        visitedSectionIds: savedProgress.visitedSectionIds,
        progressPercent: savedProgress.progressPercent,
        lastSectionId: savedProgress.lastSectionId,
        updatedAt: savedProgress.updatedAt,
      },
    });
  } catch (error) {
    console.error("Save module progress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save module progress.",
    });
  }
}

module.exports = {
  getDashboardModules,
  getQualificationModules,
  getModuleDetails,
  getMaterialContent,
  completeMaterial,
  getModuleProgress,
  saveModuleProgress,
};
