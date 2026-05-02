const { query } = require("../../../src/config/db");

async function createContent({ userId, title, contentHtml, contentPlainText }) {
  const [result] = await query(
    `INSERT INTO RichContents (CreatedByUserID, Title, ContentHtml, ContentPlainText)
     VALUES (?, ?, ?, ?)`,
    [userId, title, contentHtml, contentPlainText]
  );

  return result.insertId;
}

async function addAttachments(contentId, files) {
  if (!files || files.length === 0) {
    return;
  }

  const sql = `INSERT INTO RichContentAttachments
    (ContentID, OriginalFileName, StoredFileName, MimeType, FileSizeBytes, RelativePath)
    VALUES ?`;

  const rows = files.map((file) => [
    contentId,
    file.originalname,
    file.filename,
    file.mimetype,
    file.size,
    file.filename,
  ]);

  await query(sql, [rows]);
}

async function getContentById(contentId) {
  const [rows] = await query(
    `SELECT ContentID, CreatedByUserID, Title, ContentHtml, ContentPlainText, CreatedAt, UpdatedAt
     FROM RichContents
     WHERE ContentID = ?
     LIMIT 1`,
    [contentId]
  );

  if (rows.length === 0) {
    return null;
  }

  const content = rows[0];

  const [attachments] = await query(
    `SELECT AttachmentID, OriginalFileName, StoredFileName, MimeType, FileSizeBytes, RelativePath, CreatedAt
     FROM RichContentAttachments
     WHERE ContentID = ?
     ORDER BY AttachmentID ASC`,
    [contentId]
  );

  return {
    contentId: content.ContentID,
    createdByUserId: content.CreatedByUserID,
    title: content.Title,
    contentHtml: content.ContentHtml,
    contentPlainText: content.ContentPlainText,
    createdAt: content.CreatedAt,
    updatedAt: content.UpdatedAt,
    attachments: attachments.map((item) => ({
      attachmentId: item.AttachmentID,
      originalFileName: item.OriginalFileName,
      storedFileName: item.StoredFileName,
      mimeType: item.MimeType,
      fileSizeBytes: item.FileSizeBytes,
      relativePath: item.RelativePath,
      createdAt: item.CreatedAt,
    })),
  };
}

async function listContents(limit = 20) {
  const [rows] = await query(
    `SELECT ContentID, CreatedByUserID, Title, ContentPlainText, CreatedAt, UpdatedAt
     FROM RichContents
     ORDER BY ContentID DESC
     LIMIT ?`,
    [limit]
  );

  return rows.map((item) => ({
    contentId: item.ContentID,
    createdByUserId: item.CreatedByUserID,
    title: item.Title,
    contentPreview: (item.ContentPlainText || "").slice(0, 200),
    createdAt: item.CreatedAt,
    updatedAt: item.UpdatedAt,
  }));
}

module.exports = {
  createContent,
  addAttachments,
  getContentById,
  listContents,
};
