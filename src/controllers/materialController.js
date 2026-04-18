const { query } = require("../config/db");
const materialService = require("../services/materialService");
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
              meta.CoverImageUrl,
              COUNT(DISTINCT lm.MaterialID) AS TotalMaterials,
              SUM(CASE WHEN mp.IsCompleted = 1 THEN 1 ELSE 0 END) AS CompletedMaterials
         FROM Modules m
         LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
         LEFT JOIN LearningMaterials lm ON lm.ModuleID = m.ModuleID
         LEFT JOIN MaterialProgress mp
           ON mp.MaterialID = lm.MaterialID
          AND mp.UserID = ?
        GROUP BY m.ModuleID, m.QualificationID, m.ModuleTitle, meta.CoverImageUrl
        ORDER BY m.ModuleID ASC`,
      [userId]
    );

    return res.json({
      success: true,
      data: rows.map((row) => {
        const totalMaterials = Number(row.TotalMaterials || 0);
        const completedMaterials = Number(row.CompletedMaterials || 0);
        const progressPercent =
          totalMaterials > 0
            ? Math.min(100, Math.round((completedMaterials / totalMaterials) * 100))
            : 0;

        return {
          moduleId: row.ModuleID,
          qualificationId: row.QualificationID,
          title: row.ModuleTitle,
          image: resolveModuleCoverImage(row.ModuleID, row.CoverImageUrl),
          progressPercent,
          totalMaterials,
          completedMaterials,
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
 * Get all modules for a qualification
 */
async function getQualificationModules(req, res) {
  try {
    const { qualificationId } = req.params;

    const [modules] = await query(
      "SELECT ModuleID, ModuleTitle FROM Modules WHERE QualificationID = ? ORDER BY ModuleID ASC",
      [qualificationId]
    );

    return res.json({
      success: true,
      data: modules.map((m) => ({
        moduleId: m.ModuleID,
        title: m.ModuleTitle,
      })),
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

    // Get module info
    const [modules] = await query(
      "SELECT ModuleID, QualificationID, ModuleTitle FROM Modules WHERE ModuleID = ? LIMIT 1",
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

module.exports = {
  getDashboardModules,
  getQualificationModules,
  getModuleDetails,
  getMaterialContent,
  completeMaterial,
};
