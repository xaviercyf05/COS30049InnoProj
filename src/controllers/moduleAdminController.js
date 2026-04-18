const fs = require("fs/promises");
const { pool, query } = require("../config/db");
const {
  ensureModuleUiSchema,
  getDefaultQualificationId,
  normalizeModuleCoverImageUrl,
  resolveModuleCoverImage,
} = require("../services/moduleUiService");

const moduleCoverPathPrefix = "/uploads/module-covers/";

function createModuleCoverImageUrl(fileName) {
  return `${moduleCoverPathPrefix}${fileName}`;
}

function normalizeSectionsInput(sectionsInput) {
  let parsedSections = sectionsInput;

  if (typeof parsedSections === "string") {
    try {
      parsedSections = JSON.parse(parsedSections);
    } catch (_error) {
      parsedSections = [];
    }
  }

  if (!Array.isArray(parsedSections)) {
    return [];
  }

  return parsedSections
    .map((section, index) => {
      const title = String(section?.title || "").trim();
      const content = String(section?.content || "").trim();

      if (!title && !content) {
        return null;
      }

      return {
        title: title || `Section ${index + 1}`,
        content: content || "<p>No content provided.</p>",
      };
    })
    .filter(Boolean);
}

function mapSectionRow(sectionRow) {
  return {
    id: `section-${sectionRow.MaterialID}`,
    materialId: sectionRow.MaterialID,
    title: sectionRow.Title || sectionRow.Chapter || "Section",
    content: sectionRow.ContentText || "",
  };
}

async function readModuleById(moduleId) {
  await ensureModuleUiSchema();

  const [moduleRows] = await query(
    `SELECT m.ModuleID,
            m.QualificationID,
            m.ModuleTitle,
            meta.CoverImageUrl
       FROM Modules m
       LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
      WHERE m.ModuleID = ?
      LIMIT 1`,
    [moduleId]
  );

  if (moduleRows.length === 0) {
    return null;
  }

  const moduleRow = moduleRows[0];

  const [sectionRows] = await query(
    `SELECT MaterialID, Chapter, Title, ContentText
       FROM LearningMaterials
      WHERE ModuleID = ?
      ORDER BY MaterialID ASC`,
    [moduleId]
  );

  return {
    moduleId: moduleRow.ModuleID,
    id: `module-${moduleRow.ModuleID}`,
    qualificationId: moduleRow.QualificationID,
    title: moduleRow.ModuleTitle,
    moduleImageUrl: resolveModuleCoverImage(moduleRow.ModuleID, moduleRow.CoverImageUrl),
    sections: sectionRows.map((sectionRow) => mapSectionRow(sectionRow)),
    sectionCount: sectionRows.length,
  };
}

/**
 * Admin: list all modules.
 */
async function listModules(req, res) {
  try {
    await ensureModuleUiSchema();

    const [rows] = await query(
      `SELECT m.ModuleID,
              m.QualificationID,
              m.ModuleTitle,
              meta.CoverImageUrl,
              COUNT(lm.MaterialID) AS SectionCount
         FROM Modules m
         LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
         LEFT JOIN LearningMaterials lm ON lm.ModuleID = m.ModuleID
        GROUP BY m.ModuleID, m.QualificationID, m.ModuleTitle, meta.CoverImageUrl
        ORDER BY m.ModuleID DESC`
    );

    const data = rows.map((row) => ({
      moduleId: row.ModuleID,
      id: `module-${row.ModuleID}`,
      qualificationId: row.QualificationID,
      title: row.ModuleTitle,
      moduleImageUrl: resolveModuleCoverImage(row.ModuleID, row.CoverImageUrl),
      sectionCount: Number(row.SectionCount || 0),
    }));

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("List modules error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch modules.",
    });
  }
}

/**
 * Admin: get one module with all sections.
 */
async function getModuleById(req, res) {
  try {
    const { moduleId } = req.params;
    const moduleData = await readModuleById(moduleId);

    if (!moduleData) {
      return res.status(404).json({
        success: false,
        message: "Module not found.",
      });
    }

    return res.json({
      success: true,
      data: moduleData,
    });
  } catch (error) {
    console.error("Get module by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch module details.",
    });
  }
}

/**
 * Admin: upload module cover image and return persistent server URL.
 */
async function uploadModuleCoverImage(req, res) {
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return res.status(400).json({
      success: false,
      message: "Cover image file is required.",
    });
  }

  if (!uploadedFile.mimetype || !uploadedFile.mimetype.startsWith("image/")) {
    await fs.unlink(uploadedFile.path).catch(() => {});

    return res.status(400).json({
      success: false,
      message: "Only image files are allowed.",
    });
  }

  try {
    const moduleImageUrl = createModuleCoverImageUrl(uploadedFile.filename);

    return res.status(201).json({
      success: true,
      message: "Module cover uploaded successfully.",
      data: {
        moduleImageUrl,
      },
    });
  } catch (error) {
    await fs.unlink(uploadedFile.path).catch(() => {});

    console.error("Upload module cover image error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload module cover image.",
    });
  }
}

/**
 * Admin: create module and section content.
 */
async function createModule(req, res) {
  const title = String(req.body.title || "").trim();
  const moduleImageUrl = normalizeModuleCoverImageUrl(req.body.moduleImageUrl);
  const requestedQualificationId = Number.parseInt(req.body.qualificationId, 10);
  const sections = normalizeSectionsInput(req.body.sections);

  if (!title) {
    return res.status(400).json({
      success: false,
      message: "Module title is required.",
    });
  }

  if (sections.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one section is required.",
    });
  }

  let connection;

  try {
    await ensureModuleUiSchema();

    const qualificationId = Number.isFinite(requestedQualificationId) && requestedQualificationId > 0
      ? requestedQualificationId
      : await getDefaultQualificationId();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [qualificationRows] = await connection.execute(
      "SELECT QualificationID FROM Qualifications WHERE QualificationID = ? LIMIT 1",
      [qualificationId]
    );

    if (qualificationRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Qualification does not exist.",
      });
    }

    const [moduleInsert] = await connection.execute(
      "INSERT INTO Modules (QualificationID, ModuleTitle) VALUES (?, ?)",
      [qualificationId, title]
    );

    const moduleId = moduleInsert.insertId;

    await connection.execute(
      "INSERT INTO ModuleUiMeta (ModuleID, CoverImageUrl) VALUES (?, ?)",
      [moduleId, moduleImageUrl || null]
    );

    for (const section of sections) {
      await connection.execute(
        `INSERT INTO LearningMaterials (
          ModuleID,
          Chapter,
          Title,
          ContentType,
          ContentText
        ) VALUES (?, ?, ?, 'html', ?)`,
        [moduleId, section.title, section.title, section.content]
      );
    }

    await connection.commit();

    const createdModule = await readModuleById(moduleId);

    return res.status(201).json({
      success: true,
      message: "Module created successfully.",
      data: createdModule,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("Create module error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create module.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Admin: update module title, image, and all sections.
 */
async function updateModule(req, res) {
  const { moduleId } = req.params;
  const title = String(req.body.title || "").trim();
  const moduleImageUrl = normalizeModuleCoverImageUrl(req.body.moduleImageUrl);
  const sections = normalizeSectionsInput(req.body.sections);

  if (!title) {
    return res.status(400).json({
      success: false,
      message: "Module title is required.",
    });
  }

  if (sections.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one section is required.",
    });
  }

  let connection;

  try {
    await ensureModuleUiSchema();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [moduleRows] = await connection.execute(
      "SELECT ModuleID FROM Modules WHERE ModuleID = ? LIMIT 1",
      [moduleId]
    );

    if (moduleRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Module not found.",
      });
    }

    await connection.execute(
      "UPDATE Modules SET ModuleTitle = ? WHERE ModuleID = ?",
      [title, moduleId]
    );

    await connection.execute(
      `INSERT INTO ModuleUiMeta (ModuleID, CoverImageUrl)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE CoverImageUrl = VALUES(CoverImageUrl)`,
      [moduleId, moduleImageUrl || null]
    );

    await connection.execute("DELETE FROM LearningMaterials WHERE ModuleID = ?", [moduleId]);

    for (const section of sections) {
      await connection.execute(
        `INSERT INTO LearningMaterials (
          ModuleID,
          Chapter,
          Title,
          ContentType,
          ContentText
        ) VALUES (?, ?, ?, 'html', ?)`,
        [moduleId, section.title, section.title, section.content]
      );
    }

    await connection.commit();

    const updatedModule = await readModuleById(moduleId);

    return res.json({
      success: true,
      message: "Module updated successfully.",
      data: updatedModule,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("Update module error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update module.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Admin: delete module.
 */
async function deleteModule(req, res) {
  const { moduleId } = req.params;

  try {
    const [result] = await query("DELETE FROM Modules WHERE ModuleID = ?", [moduleId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Module not found.",
      });
    }

    return res.json({
      success: true,
      message: "Module deleted successfully.",
    });
  } catch (error) {
    console.error("Delete module error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete module.",
    });
  }
}

module.exports = {
  listModules,
  getModuleById,
  uploadModuleCoverImage,
  createModule,
  updateModule,
  deleteModule,
};
