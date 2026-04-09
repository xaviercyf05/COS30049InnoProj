const { query } = require("../config/db");

/**
 * Service for managing learning materials and user progress tracking.
 */

/**
 * Get all materials for a module, including user's completion status
 */
async function getModuleMaterials(userId, moduleId) {
  try {
    const [materials] = await query(
      `SELECT MaterialID, Chapter, Title, ContentType
       FROM LearningMaterials
       WHERE ModuleID = ?
       ORDER BY MaterialID ASC`,
      [moduleId]
    );

    if (materials.length === 0) {
      return [];
    }

    // Get completion status for each material
    const materialsWithProgress = [];
    for (const mat of materials) {
      const [progress] = await query(
        "SELECT IsCompleted FROM MaterialProgress WHERE MaterialID = ? AND UserID = ? LIMIT 1",
        [mat.MaterialID, userId]
      );

      materialsWithProgress.push({
        materialId: mat.MaterialID,
        chapter: mat.Chapter,
        title: mat.Title,
        contentType: mat.ContentType,
        isCompleted: progress.length > 0 ? progress[0].IsCompleted === 1 : false,
      });
    }

    return materialsWithProgress;
  } catch (error) {
    throw error;
  }
}

/**
 * Get full material content for reading
 */
async function getMaterialContent(userId, materialId) {
  try {
    const [materials] = await query(
      "SELECT MaterialID, ModuleID, Chapter, Title, ContentType, ContentText FROM LearningMaterials WHERE MaterialID = ? LIMIT 1",
      [materialId]
    );

    if (materials.length === 0) {
      throw new Error("Material not found");
    }

    const material = materials[0];

    // Get or create progress record
    const [progress] = await query(
      "SELECT IsCompleted FROM MaterialProgress WHERE MaterialID = ? AND UserID = ? LIMIT 1",
      [materialId, userId]
    );

    let isCompleted = false;
    if (progress.length === 0) {
      // Create progress record
      await query(
        "INSERT INTO MaterialProgress (MaterialID, UserID, IsCompleted) VALUES (?, ?, 0)",
        [materialId, userId]
      );
    } else {
      isCompleted = progress[0].IsCompleted === 1;
    }

    return {
      materialId: material.MaterialID,
      moduleId: material.ModuleID,
      chapter: material.Chapter,
      title: material.Title,
      contentType: material.ContentType,
      content: material.ContentText,
      isCompleted,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Mark material as completed
 */
async function markMaterialComplete(userId, materialId) {
  try {
    // First, ensure progress record exists
    const [existing] = await query(
      "SELECT MaterialProgressID FROM MaterialProgress WHERE MaterialID = ? AND UserID = ? LIMIT 1",
      [materialId, userId]
    );

    if (existing.length === 0) {
      await query(
        "INSERT INTO MaterialProgress (MaterialID, UserID, IsCompleted) VALUES (?, ?, 1)",
        [materialId, userId]
      );
    } else {
      await query(
        "UPDATE MaterialProgress SET IsCompleted = 1 WHERE MaterialID = ? AND UserID = ?",
        [materialId, userId]
      );
    }

    return { materialId, isCompleted: true };
  } catch (error) {
    throw error;
  }
}

/**
 * Get all sections/chapters for a module to show progress
 */
async function getModuleChapters(moduleId) {
  try {
    const [chapters] = await query(
      `SELECT DISTINCT Chapter
       FROM LearningMaterials
       WHERE ModuleId = ?
       ORDER BY Chapter ASC`,
      [moduleId]
    );

    return chapters.map((ch) => ch.Chapter);
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getModuleMaterials,
  getMaterialContent,
  markMaterialComplete,
  getModuleChapters,
};
