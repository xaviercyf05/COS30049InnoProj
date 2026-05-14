const fs = require("fs/promises");
const { pool, query } = require("../config/db");
const {
  ensureModuleUiSchema,
  getDefaultQualificationId,
  normalizeModuleCoverImageUrl,
  resolveModuleCoverImage,
} = require("../services/moduleUiService");

const moduleCoverPathPrefix = "/uploads/module-covers/";
const ONSITE_MODULE_TYPE_NAME = "On-Site Training Modules";
const TPA_MODULE_TYPE_NAME = "Total Protected Area Modules";

function createModuleCoverImageUrl(fileName) {
  return `${moduleCoverPathPrefix}${fileName}`;
}

async function getModuleTypeNameById(execute, moduleTypeId) {
  if (!Number.isFinite(moduleTypeId) || moduleTypeId <= 0) {
    return null;
  }

  const [rows] = await execute(
    "SELECT TypeName FROM ModuleTypes WHERE ModuleTypeID = ? LIMIT 1",
    [moduleTypeId]
  );

  return rows.length > 0 ? rows[0].TypeName : null;
}

async function resolveModuleTypeId(execute, requestedModuleTypeId, fallbackModuleTypeId = null) {
  // Attempt to use requested type if provided and valid
  if (Number.isFinite(requestedModuleTypeId) && requestedModuleTypeId > 0) {
    const [typeRows] = await execute(
      "SELECT ModuleTypeID FROM ModuleTypes WHERE ModuleTypeID = ? LIMIT 1",
      [requestedModuleTypeId]
    );

    if (typeRows.length > 0) {
      return requestedModuleTypeId;
    }
  }

  // Fall back to current module's type on update (to preserve existing type if not explicitly changed)
  if (Number.isFinite(fallbackModuleTypeId) && fallbackModuleTypeId > 0) {
    return fallbackModuleTypeId;
  }

  // Default to first available type (no type prerequisites—any type can be created)
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
      const description = String(section?.description || '').trim();

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
          description,
          ordering: typeof section?.ordering !== 'undefined' ? Number(section.ordering) : null,
          subsections: subs,
        };
      }

      // Legacy single-content section
      const content = String(section?.content || "").trim();

      return {
        title,
        description,
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
        description: r.SectionDescription || '',
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
            m.LinkedTpaModuleID,
            m.LinkedOnsiteModuleID,
            mt.TypeName,
            meta.CoverImageUrl,
            meta.Summary
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
            s.Description AS SectionDescription,
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
    linkedTpaModuleId: moduleRow.LinkedTpaModuleID || null,
    linkedOnsiteModuleId: moduleRow.LinkedOnsiteModuleID || null,
    moduleImageUrl: resolveModuleCoverImage(moduleRow.ModuleID, moduleRow.CoverImageUrl),
    summary: moduleRow.Summary || '',
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
              m.LinkedTpaModuleID,
              m.LinkedOnsiteModuleID,
              mt.TypeName,
              meta.CoverImageUrl,
              meta.Summary,
              COUNT(sc.SubsectionID) AS SectionCount
         FROM Modules m
         LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
         LEFT JOIN Sections s ON s.ModuleID = m.ModuleID
         LEFT JOIN Subsections sc ON sc.SectionID = s.SectionID
         LEFT JOIN LearningMaterials lm ON lm.ModuleID = m.ModuleID
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        GROUP BY m.ModuleID, m.QualificationID, m.ModuleTitle, m.ModuleTypeID, m.LinkedTpaModuleID, m.LinkedOnsiteModuleID, mt.TypeName, meta.CoverImageUrl, meta.Summary
        ORDER BY m.ModuleID DESC`
    );

    const data = rows.map((row) => ({
      moduleId: row.ModuleID,
      id: `module-${row.ModuleID}`,
      qualificationId: row.QualificationID,
      title: row.ModuleTitle,
      moduleTypeId: row.ModuleTypeID,
      moduleType: row.TypeName || 'Theory',
      linkedTpaModuleId: row.LinkedTpaModuleID || null,
      linkedOnsiteModuleId: row.LinkedOnsiteModuleID || null,
      moduleImageUrl: resolveModuleCoverImage(row.ModuleID, row.CoverImageUrl),
      summary: row.Summary || '',
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
 * 
 * Note: moduleTypeId can be provided to create a module of any type directly.
 * No type prerequisites exist—you can create "Total Protected Area Modules" 
 * or "On-Site Training Modules" without creating "General Modules" first.
 */
async function createModule(req, res) {
  const title = String(req.body.title || "").trim();
  const moduleImageUrl = normalizeModuleCoverImageUrl(req.body.moduleImageUrl);
  const requestedQualificationId = Number.parseInt(req.body.qualificationId, 10);
  const requestedModuleTypeId = Number.parseInt(req.body.moduleTypeId, 10);
  const requestedLinkedTpaModuleId = Number.parseInt(req.body.linkedTpaModuleId, 10);
  const sections = normalizeSectionsInput(req.body.sections);

  // Debug logging to verify incoming payload
  try {
    console.debug('createModule received', {
      title,
      moduleImageUrl,
      requestedQualificationId,
      requestedModuleTypeId,
      requestedLinkedTpaModuleId,
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

    console.debug('createModule resolved moduleTypeId:', { requestedModuleTypeId, resolvedModuleTypeId: moduleTypeId });

    // Validate linked TPA relationship if provided
    let linkedTpaModuleId = null;
    if (Number.isFinite(requestedLinkedTpaModuleId) && requestedLinkedTpaModuleId > 0) {
      const sourceModuleTypeName = await getModuleTypeNameById(
        connection.execute.bind(connection),
        moduleTypeId
      );

      if (sourceModuleTypeName !== ONSITE_MODULE_TYPE_NAME) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Only On-Site Training Modules can be linked to a TPA module.",
        });
      }

      const [tpaModuleRows] = await connection.execute(
        `SELECT m.ModuleID, mt.TypeName
           FROM Modules m
           LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
          WHERE m.ModuleID = ?
          LIMIT 1`,
        [requestedLinkedTpaModuleId]
      );

      if (tpaModuleRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Linked TPA module does not exist.",
        });
      }

      if (tpaModuleRows[0].TypeName !== TPA_MODULE_TYPE_NAME) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Linked module must be a Total Protected Area module.",
        });
      }

      linkedTpaModuleId = requestedLinkedTpaModuleId;
    }

    const [moduleInsert] = await connection.execute(
      "INSERT INTO Modules (QualificationID, ModuleTitle, ModuleTypeID, LinkedTpaModuleID) VALUES (?, ?, ?, ?)",
      [qualificationId, title, moduleTypeId, linkedTpaModuleId]
    );

    const moduleId = moduleInsert.insertId;

    await connection.execute(
      "INSERT INTO ModuleUiMeta (ModuleID, CoverImageUrl, Summary) VALUES (?, ?, ?)",
      [moduleId, moduleImageUrl || null, req.body.summary ? String(req.body.summary).trim() : null]
    );

    // Insert sections and subsections
    let sectionOrderCounter = 0;
    for (const section of sections) {
      sectionOrderCounter += 1;
      const sectionOrdering = typeof section.ordering === 'number' && !Number.isNaN(section.ordering)
        ? section.ordering
        : sectionOrderCounter;

      const [secInsert] = await connection.execute(
        "INSERT INTO Sections (ModuleID, Title, Description, Ordering) VALUES (?, ?, ?, ?)",
        [moduleId, section.title, section.description || null, sectionOrdering]
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
  const requestedLinkedTpaModuleId = Number.parseInt(req.body.linkedTpaModuleId, 10);
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
      "SELECT ModuleTypeID, LinkedTpaModuleID FROM Modules WHERE ModuleID = ? LIMIT 1",
      [moduleId]
    );

    const currentModuleTypeId = currentModuleRows.length > 0 ? currentModuleRows[0].ModuleTypeID : null;
    const currentLinkedTpaModuleId = currentModuleRows.length > 0 ? currentModuleRows[0].LinkedTpaModuleID : null;
    const moduleTypeId = await resolveModuleTypeId(
      connection.execute.bind(connection),
      requestedModuleTypeId,
      currentModuleTypeId
    );

    // Validate linked TPA relationship if provided
    let linkedTpaModuleId = currentLinkedTpaModuleId;
    if (Number.isFinite(requestedLinkedTpaModuleId) && requestedLinkedTpaModuleId > 0) {
      if (Number(moduleId) === requestedLinkedTpaModuleId) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "A module cannot be linked to itself.",
        });
      }

      const sourceModuleTypeName = await getModuleTypeNameById(
        connection.execute.bind(connection),
        moduleTypeId
      );

      if (sourceModuleTypeName !== ONSITE_MODULE_TYPE_NAME) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Only On-Site Training Modules can be linked to a TPA module.",
        });
      }

      const [tpaModuleRows] = await connection.execute(
        `SELECT m.ModuleID, mt.TypeName
           FROM Modules m
           LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
          WHERE m.ModuleID = ?
          LIMIT 1`,
        [requestedLinkedTpaModuleId]
      );

      if (tpaModuleRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Linked TPA module does not exist.",
        });
      }

      if (tpaModuleRows[0].TypeName !== TPA_MODULE_TYPE_NAME) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Linked module must be a Total Protected Area module.",
        });
      }

      linkedTpaModuleId = requestedLinkedTpaModuleId;
    } else if (requestedLinkedTpaModuleId === 0) {
      // Explicitly clear the link if 0 is passed
      linkedTpaModuleId = null;
    }

    const finalModuleTypeName = await getModuleTypeNameById(
      connection.execute.bind(connection),
      moduleTypeId
    );

    if (finalModuleTypeName !== ONSITE_MODULE_TYPE_NAME && linkedTpaModuleId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Only On-Site Training Modules can keep a linked TPA module. Clear the link first.",
      });
    }

    await connection.execute(
      "UPDATE Modules SET ModuleTitle = ?, ModuleTypeID = ?, LinkedTpaModuleID = ? WHERE ModuleID = ?",
      [title, moduleTypeId, linkedTpaModuleId, moduleId]
    );

    await connection.execute(
      `INSERT INTO ModuleUiMeta (ModuleID, CoverImageUrl)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE CoverImageUrl = VALUES(CoverImageUrl)`,
      [moduleId, moduleImageUrl || null]
    );

    // Persist summary in UI meta as well
    await connection.execute(
      `INSERT INTO ModuleUiMeta (ModuleID, CoverImageUrl, Summary)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE CoverImageUrl = VALUES(CoverImageUrl), Summary = VALUES(Summary)`,
      [moduleId, moduleImageUrl || null, req.body.summary ? String(req.body.summary).trim() : null]
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
        "INSERT INTO Sections (ModuleID, Title, Description, Ordering) VALUES (?, ?, ?, ?)",
        [moduleId, section.title, section.description || null, sectionOrdering]
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
 * Admin: link or unlink an On-Site module to a TPA module by module ID.
 */
async function linkModuleToTpa(req, res) {
  const moduleId = Number.parseInt(req.params.moduleId, 10);
  const requestedLinkedTpaModuleId = Number.parseInt(req.body.linkedTpaModuleId, 10);
  const shouldClear = requestedLinkedTpaModuleId === 0;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [sourceRows] = await connection.execute(
      `SELECT m.ModuleID, m.ModuleTypeID, mt.TypeName, m.LinkedTpaModuleID
         FROM Modules m
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        WHERE m.ModuleID = ?
        LIMIT 1`,
      [moduleId]
    );

    if (sourceRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Module not found.",
      });
    }

    const source = sourceRows[0];

    if (source.TypeName !== ONSITE_MODULE_TYPE_NAME) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Only On-Site Training Modules can be linked to a TPA module.",
      });
    }

    if (shouldClear) {
      await connection.execute(
        "UPDATE Modules SET LinkedTpaModuleID = NULL WHERE ModuleID = ?",
        [moduleId]
      );

      await connection.commit();
      return res.json({
        success: true,
        message: "TPA link cleared successfully.",
        data: {
          moduleId,
          linkedTpaModuleId: null,
        },
      });
    }

    if (!Number.isFinite(requestedLinkedTpaModuleId) || requestedLinkedTpaModuleId <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "linkedTpaModuleId is required and must be a positive integer, or 0 to clear.",
      });
    }

    if (moduleId === requestedLinkedTpaModuleId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "A module cannot be linked to itself.",
      });
    }

    const [targetRows] = await connection.execute(
      `SELECT m.ModuleID, mt.TypeName
         FROM Modules m
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        WHERE m.ModuleID = ?
        LIMIT 1`,
      [requestedLinkedTpaModuleId]
    );

    if (targetRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Linked TPA module does not exist.",
      });
    }

    if (targetRows[0].TypeName !== TPA_MODULE_TYPE_NAME) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Linked module must be a Total Protected Area module.",
      });
    }

    await connection.execute(
      "UPDATE Modules SET LinkedTpaModuleID = ? WHERE ModuleID = ?",
      [requestedLinkedTpaModuleId, moduleId]
    );

    await connection.commit();
    return res.json({
      success: true,
      message: "Module linked to TPA successfully.",
      data: {
        moduleId,
        linkedTpaModuleId: requestedLinkedTpaModuleId,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("Link module to TPA error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to link module to TPA.",
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
  linkModuleToTpa,
  deleteModule,
  getModuleTypes,
};
