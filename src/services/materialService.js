const { query } = require("../config/db");

/**
 * Service for managing learning materials and user progress tracking.
 */

/**
 * Get all materials for a module, including user's completion status
 */
async function getModuleMaterials(userId, moduleId) {
  try {
    // Return flattened list of subsections for the module with progress
    const [rows] = await query(
      `SELECT sc.SubsectionID, sc.Title AS SubTitle, sc.ContentType, sc.ContentText, s.SectionID, s.Title AS SectionTitle
       FROM Sections s
       LEFT JOIN Subsections sc ON sc.SectionID = s.SectionID
       WHERE s.ModuleID = ?
       ORDER BY s.Ordering ASC, sc.Ordering ASC`,
      [moduleId]
    );

    if (rows.length === 0) return [];

    const materialsWithProgress = [];
    for (const r of rows) {
      const [progress] = await query(
        "SELECT IsCompleted FROM MaterialProgress WHERE SubsectionID = ? AND UserID = ? LIMIT 1",
        [r.SubsectionID, userId]
      );

      materialsWithProgress.push({
        materialId: r.SubsectionID,
        sectionId: r.SectionID,
        sectionTitle: r.SectionTitle,
        title: r.SubTitle,
        contentType: r.ContentType,
        content: r.ContentText,
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
    const [rows] = await query(
      `SELECT sc.SubsectionID, sc.Title AS SubTitle, sc.ContentType, sc.ContentText, s.SectionID, s.ModuleID
       FROM Subsections sc
       JOIN Sections s ON s.SectionID = sc.SectionID
       WHERE sc.SubsectionID = ? LIMIT 1`,
      [materialId]
    );

    if (rows.length === 0) throw new Error('Material not found');

    const material = rows[0];

    const [progress] = await query(
      "SELECT IsCompleted FROM MaterialProgress WHERE SubsectionID = ? AND UserID = ? LIMIT 1",
      [materialId, userId]
    );

    let isCompleted = false;
    if (progress.length === 0) {
      await query("INSERT INTO MaterialProgress (SubsectionID, UserID, IsCompleted) VALUES (?, ?, 0)", [materialId, userId]);
    } else {
      isCompleted = progress[0].IsCompleted === 1;
    }

    return {
      materialId: material.SubsectionID,
      moduleId: material.ModuleID,
      sectionId: material.SectionID,
      title: material.SubTitle,
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
    // Use SubsectionID in MaterialProgress
    const [existing] = await query(
      "SELECT MaterialProgressID FROM MaterialProgress WHERE SubsectionID = ? AND UserID = ? LIMIT 1",
      [materialId, userId]
    );

    if (existing.length === 0) {
      await query(
        "INSERT INTO MaterialProgress (SubsectionID, UserID, IsCompleted) VALUES (?, ?, 1)",
        [materialId, userId]
      );
    } else {
      await query(
        "UPDATE MaterialProgress SET IsCompleted = 1 WHERE SubsectionID = ? AND UserID = ?",
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
      `SELECT s.SectionID, s.Title
       FROM Sections s
       WHERE s.ModuleID = ?
       ORDER BY s.Ordering ASC`,
      [moduleId]
    );

    return chapters.map((c) => ({ sectionId: c.SectionID, title: c.Title }));
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
