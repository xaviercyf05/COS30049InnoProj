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

async function getIssuanceByUserAssessmentBadge({ userId, assessmentId, badgeId }) {
  if (!Number.isInteger(Number(userId)) || !Number.isInteger(Number(assessmentId)) || !Number.isInteger(Number(badgeId))) {
    return null;
  }

  const [rows] = await query(
    `SELECT IssuanceID, UserID, BadgeID, AssessmentID, Status, IssuedBy, IssuedAt, Note, CreatedAt, UpdatedAt
       FROM BadgeIssuances
      WHERE UserID = ? AND AssessmentID = ? AND BadgeID = ?
      LIMIT 1`,
    [Number(userId), Number(assessmentId), Number(badgeId)]
  );

  return rows && rows[0] ? {
    issuanceId: rows[0].IssuanceID,
    userId: rows[0].UserID,
    badgeId: rows[0].BadgeID,
    assessmentId: rows[0].AssessmentID,
    status: rows[0].Status,
    issuedBy: rows[0].IssuedBy,
    issuedAt: rows[0].IssuedAt,
    note: rows[0].Note,
    createdAt: rows[0].CreatedAt,
    updatedAt: rows[0].UpdatedAt,
  } : null;
}

module.exports = {
  upsertIssuance,
  listIssuancesForUserAssessmentPairs,
  getIssuanceByUserAssessmentBadge,
};
