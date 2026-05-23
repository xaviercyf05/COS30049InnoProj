const { query } = require("../config/db");

/**
 * Service to manage BadgeIssuances records.
 */

async function upsertIssuance({ userId, assessmentId, badgeId, status = 'pending', byUserId = null, note = null }) {
  // Normalize values
  const normalizedStatus = String(status || 'pending');
  const issuedAt = normalizedStatus === 'issued' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

  await query(
    `INSERT INTO BadgeIssuances (UserID, AssessmentID, BadgeID, Status, IssuedBy, IssuedAt, Note)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       Status = VALUES(Status),
       IssuedBy = VALUES(IssuedBy),
       IssuedAt = VALUES(IssuedAt),
       Note = VALUES(Note),
       UpdatedAt = CURRENT_TIMESTAMP`,
    [userId, assessmentId, badgeId, normalizedStatus, byUserId, issuedAt, note]
  );

  const [rows] = await query(
    `SELECT IssuanceID, UserID, BadgeID, AssessmentID, Status, IssuedBy, IssuedAt, Note, CreatedAt, UpdatedAt
       FROM BadgeIssuances
      WHERE UserID = ? AND AssessmentID = ? AND BadgeID = ?
      LIMIT 1`,
    [userId, assessmentId, badgeId]
  );

  return rows && rows[0] ? rows[0] : null;
}

async function listIssuancesForUserAssessmentPairs(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return {};

  const clauses = [];
  const params = [];

  for (const p of pairs) {
    if (!p || !Number.isInteger(Number(p.userId)) || !Number.isInteger(Number(p.assessmentId))) continue;
    clauses.push('(UserID = ? AND AssessmentID = ?)');
    params.push(Number(p.userId), Number(p.assessmentId));
  }

  if (clauses.length === 0) return {};

  const where = clauses.join(' OR ');
  const [rows] = await query(
    `SELECT IssuanceID, UserID, BadgeID, AssessmentID, Status, IssuedBy, IssuedAt, Note, CreatedAt, UpdatedAt
       FROM BadgeIssuances
      WHERE ${where}`,
    params
  );

  const map = {};
  for (const r of rows) {
    map[`${r.UserID}:${r.AssessmentID}`] = {
      issuanceId: r.IssuanceID,
      badgeId: r.BadgeID,
      status: r.Status,
      issuedBy: r.IssuedBy,
      issuedAt: r.IssuedAt,
      note: r.Note,
      createdAt: r.CreatedAt,
      updatedAt: r.UpdatedAt,
    };
  }

  return map;
}

module.exports = {
  upsertIssuance,
  listIssuancesForUserAssessmentPairs,
};
