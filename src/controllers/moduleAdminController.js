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

async function resolveModuleTypeId(execute, requestedModuleTypeId, fallbackModuleTypeId = null) {
  if (Number.isFinite(requestedModuleTypeId) && requestedModuleTypeId > 0) {
    const [typeRows] = await execute(
      "SELECT ModuleTypeID FROM ModuleTypes WHERE ModuleTypeID = ? LIMIT 1",
      [requestedModuleTypeId]
    );

    if (typeRows.length > 0) {
      return requestedModuleTypeId;
    }
  }

  if (Number.isFinite(fallbackModuleTypeId) && fallbackModuleTypeId > 0) {
    return fallbackModuleTypeId;
  }

  const [defaultTypeRows] = await execute(
    "SELECT ModuleTypeID FROM ModuleTypes ORDER BY ModuleTypeID ASC LIMIT 1"
  );

  return defaultTypeRows.length > 0 ? defaultTypeRows[0].ModuleTypeID : null;
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
  // Support two input formats:
  // 1) Legacy: [{ title, content }]
  // 2) New: [{ title, ordering, subsections: [{ title, content, ordering }] }]
  return parsedSections
    .map((section, index) => {
      const title = String(section?.title || `Section ${index + 1}`).trim();

      // If subsections provided, normalize them
      if (Array.isArray(section?.subsections)) {
        const subs = section.subsections
          .map((s, i) => {
            const stitle = String(s?.title || `${title} - ${i + 1}`).trim();
            const scontent = String(s?.content || "").trim();
            if (!stitle && !scontent) return null;
            return {
              title: stitle,
              content: scontent || "<p>No content provided.</p>",
              ordering: typeof s?.ordering !== 'undefined' ? Number(s.ordering) : null,
            };
          })
          .filter(Boolean);

        return {
          title,
          ordering: typeof section?.ordering !== 'undefined' ? Number(section.ordering) : null,
          subsections: subs,
        };
      }

      // Legacy single-content section
      const content = String(section?.content || "").trim();

      return {
        title,
        ordering: typeof section?.ordering !== 'undefined' ? Number(section.ordering) : null,
        subsections: [
          {
            title,
            content: content || "<p>No content provided.</p>",
            ordering: null,
          },
        ],
      };
    })
    .filter(Boolean);
}

function mapSectionRowsToStructure(rows) {
  // rows: flattened rows from JOIN of Sections and Subsections
  const sectionsMap = new Map();

  for (const r of rows) {
    const sid = r.SectionID;

    if (!sectionsMap.has(sid)) {
      sectionsMap.set(sid, {
        id: `section-${sid}`,
        sectionId: sid,
        title: r.SectionTitle,
        ordering: r.SectionOrdering,
        subsections: [],
      });
    }

    if (r.SubsectionID) {
      sectionsMap.get(sid).subsections.push({
        id: `subsection-${r.SubsectionID}`,
        subsectionId: r.SubsectionID,
        title: r.SubTitle,
        contentType: r.ContentType,
        content: r.ContentText,
        ordering: r.SubOrdering,
      });
    }
  }

  // Return ordered array
  return Array.from(sectionsMap.values()).sort((a, b) => (a.ordering || 0) - (b.ordering || 0));
}

async function readModuleById(moduleId) {
  await ensureModuleUiSchema();

  const [moduleRows] = await query(
    `SELECT m.ModuleID,
            m.QualificationID,
            m.ModuleTitle,
            m.ModuleTypeID,
            mt.TypeName,
            meta.CoverImageUrl
       FROM Modules m
       LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
       LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
      WHERE m.ModuleID = ?
      LIMIT 1`,
    [moduleId]
  );

  if (moduleRows.length === 0) {
    return null;
  }

  const moduleRow = moduleRows[0];

  const [rows] = await query(
    `SELECT s.SectionID,
            s.Title AS SectionTitle,
            s.Ordering AS SectionOrdering,
            sc.SubsectionID,
            sc.Title AS SubTitle,
            sc.ContentType,
            sc.ContentText,
            sc.Ordering AS SubOrdering
       FROM Sections s
       LEFT JOIN Subsections sc ON sc.SectionID = s.SectionID
      WHERE s.ModuleID = ?
      ORDER BY s.Ordering ASC, sc.Ordering ASC`,
    [moduleId]
  );

  const sections = mapSectionRowsToStructure(rows);

  return {
    moduleId: moduleRow.ModuleID,
    id: `module-${moduleRow.ModuleID}`,
    qualificationId: moduleRow.QualificationID,
    title: moduleRow.ModuleTitle,
    moduleTypeId: moduleRow.ModuleTypeID,
    moduleType: moduleRow.TypeName || 'General Modules',
    moduleImageUrl: resolveModuleCoverImage(moduleRow.ModuleID, moduleRow.CoverImageUrl),
    sections,
    sectionCount: sections.length,
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
              m.ModuleTypeID,
              mt.TypeName,
              meta.CoverImageUrl,
              COUNT(sc.SubsectionID) AS SectionCount
         FROM Modules m
         LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
         LEFT JOIN Sections s ON s.ModuleID = m.ModuleID
         LEFT JOIN Subsections sc ON sc.SectionID = s.SectionID
         LEFT JOIN LearningMaterials lm ON lm.ModuleID = m.ModuleID
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        GROUP BY m.ModuleID, m.QualificationID, m.ModuleTitle, m.ModuleTypeID, mt.TypeName, meta.CoverImageUrl
        ORDER BY m.ModuleID DESC`
    );

    const data = rows.map((row) => ({
      moduleId: row.ModuleID,
      id: `module-${row.ModuleID}`,
      qualificationId: row.QualificationID,
      title: row.ModuleTitle,
      moduleTypeId: row.ModuleTypeID,
      moduleType: row.TypeName || 'Theory',
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
  const requestedModuleTypeId = Number.parseInt(req.body.moduleTypeId, 10);
  const sections = normalizeSectionsInput(req.body.sections);

  // Debug logging to verify incoming sections payload
  try {
    console.debug('createModule received', {
      title,
      moduleImageUrl,
      sectionsCount: Array.isArray(sections) ? sections.length : 0,
      firstSectionPreview: sections && sections[0] ? String(sections[0].content).slice(0, 120) : null,
    });
  } catch (_e) {
    // ignore logging errors
  }

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

    const moduleTypeId = await resolveModuleTypeId(connection.execute.bind(connection), requestedModuleTypeId);

    const [moduleInsert] = await connection.execute(
      "INSERT INTO Modules (QualificationID, ModuleTitle, ModuleTypeID) VALUES (?, ?, ?)",
      [qualificationId, title, moduleTypeId]
    );

    const moduleId = moduleInsert.insertId;

    await connection.execute(
      "INSERT INTO ModuleUiMeta (ModuleID, CoverImageUrl) VALUES (?, ?)",
      [moduleId, moduleImageUrl || null]
    );

    // Insert sections and subsections
    let sectionOrderCounter = 0;
    for (const section of sections) {
      sectionOrderCounter += 1;
      const sectionOrdering = typeof section.ordering === 'number' && !Number.isNaN(section.ordering)
        ? section.ordering
        : sectionOrderCounter;

      const [secInsert] = await connection.execute(
        "INSERT INTO Sections (ModuleID, Title, Ordering) VALUES (?, ?, ?)",
        [moduleId, section.title, sectionOrdering]
      );

      const sectionId = secInsert.insertId;

      let subOrderCounter = 0;
      for (const sub of (section.subsections || [])) {
        subOrderCounter += 1;
        const subOrdering = typeof sub.ordering === 'number' && !Number.isNaN(sub.ordering)
          ? sub.ordering
          : subOrderCounter;

        await connection.execute(
          `INSERT INTO Subsections (
            SectionID,
            Title,
            ContentType,
            ContentText,
            Ordering
          ) VALUES (?, ?, 'html', ?, ?)`,
          [sectionId, sub.title, sub.content || '<p>No content provided.</p>', subOrdering]
        );
      }
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
  const requestedModuleTypeId = Number.parseInt(req.body.moduleTypeId, 10);
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

    const [currentModuleRows] = await connection.execute(
      "SELECT ModuleTypeID FROM Modules WHERE ModuleID = ? LIMIT 1",
      [moduleId]
    );

    const currentModuleTypeId = currentModuleRows.length > 0 ? currentModuleRows[0].ModuleTypeID : null;
    const moduleTypeId = await resolveModuleTypeId(
      connection.execute.bind(connection),
      requestedModuleTypeId,
      currentModuleTypeId
    );

    await connection.execute(
      "UPDATE Modules SET ModuleTitle = ?, ModuleTypeID = ? WHERE ModuleID = ?",
      [title, moduleTypeId, moduleId]
    );

    await connection.execute(
      `INSERT INTO ModuleUiMeta (ModuleID, CoverImageUrl)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE CoverImageUrl = VALUES(CoverImageUrl)`,
      [moduleId, moduleImageUrl || null]
    );

    // Remove existing sections/subsections for module and recreate
    await connection.execute("DELETE FROM Sections WHERE ModuleID = ?", [moduleId]);

    let sectionOrderCounter2 = 0;
    for (const section of sections) {
      sectionOrderCounter2 += 1;
      const sectionOrdering = typeof section.ordering === 'number' && !Number.isNaN(section.ordering)
        ? section.ordering
        : sectionOrderCounter2;

      const [secInsert] = await connection.execute(
        "INSERT INTO Sections (ModuleID, Title, Ordering) VALUES (?, ?, ?)",
        [moduleId, section.title, sectionOrdering]
      );

      const sectionId = secInsert.insertId;

      let subOrderCounter2 = 0;
      for (const sub of (section.subsections || [])) {
        subOrderCounter2 += 1;
        const subOrdering = typeof sub.ordering === 'number' && !Number.isNaN(sub.ordering)
          ? sub.ordering
          : subOrderCounter2;

        await connection.execute(
          `INSERT INTO Subsections (
            SectionID,
            Title,
            ContentType,
            ContentText,
            Ordering
          ) VALUES (?, ?, 'html', ?, ?)`,
          [sectionId, sub.title, sub.content || '<p>No content provided.</p>', subOrdering]
        );
      }
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

/**
 * Admin: get all available module types.
 */
async function getModuleTypes(req, res) {
  try {
    const [rows] = await query(
      `SELECT ModuleTypeID, TypeName, Description
         FROM ModuleTypes
        ORDER BY ModuleTypeID ASC`
    );

    const data = rows.map((row) => ({
      moduleTypeId: row.ModuleTypeID,
      typeName: row.TypeName,
      description: row.Description || "",
    }));

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get module types error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch module types.",
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
  getModuleTypes,
};
