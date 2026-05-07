const { query } = require("../config/db");
const materialService = require("../services/materialService");
const progressService = require("../services/progressService");
const {
  ensureModuleUiSchema,
  resolveModuleCoverImage,
} = require("../services/moduleUiService");

/**
 * Controller for learning modules and materials.
 */

/**
 * Get dashboard module cards with user-specific progress.
 */
async function getDashboardModules(req, res) {
  try {
    const { userId } = req.user;

    await ensureModuleUiSchema();

    const [rows] = await query(
      `SELECT m.ModuleID,
              m.QualificationID,
              m.ModuleTitle,
              m.ModuleTypeID,
              mt.TypeName,
              meta.CoverImageUrl,
              COALESCE(up.progressPercent, 0) AS progressPercent
         FROM Modules m
         LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
         LEFT JOIN user_progress up ON up.moduleId = m.ModuleID AND up.userId = ?
        GROUP BY m.ModuleID, m.QualificationID, m.ModuleTitle, m.ModuleTypeID, mt.TypeName, meta.CoverImageUrl, up.progressPercent
        ORDER BY m.ModuleTypeID ASC, m.ModuleID ASC`,
      [userId]
    );

    return res.json({
      success: true,
      data: rows.map((row) => {
        const progressPercent = Number(row.progressPercent || 0);

        return {
          moduleId: row.ModuleID,
          qualificationId: row.QualificationID,
          title: row.ModuleTitle,
          moduleTypeId: row.ModuleTypeID,
          moduleType: row.TypeName || "Unassigned",
          image: resolveModuleCoverImage(row.ModuleID, row.CoverImageUrl),
          progressPercent,
        };
      }),
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
              mt.TypeName
         FROM Modules m
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
