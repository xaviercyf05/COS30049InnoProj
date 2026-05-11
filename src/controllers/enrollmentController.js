const path = require('path');
const { query } = require('../config/db');
const notificationService = require('../services/notificationService');

async function submitPaymentEvidence(req, res) {
  try {
    const userId = req.user && req.user.userId;
    const moduleId = Number.parseInt(req.body.moduleId, 10);
    const reference = String(req.body.reference || '').trim();
    const file = req.file;

    console.log('[submitPaymentEvidence] userId:', userId, 'moduleId:', moduleId, 'reference:', reference, 'file:', file?.filename);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!Number.isFinite(moduleId) || moduleId <= 0) {
      return res.status(400).json({ success: false, message: 'Valid moduleId is required.' });
    }

    const evidencePath = file ? `/uploads/payment-evidence/${file.filename}` : null;
    const evidenceName = file ? file.originalname || file.filename : null;
    const evidenceMime = file ? file.mimetype : null;

    console.log('[submitPaymentEvidence] Inserting payment record:', { userId, moduleId, reference, evidencePath, evidenceName, evidenceMime });

    const [result] = await query(
      `INSERT INTO Payments (UserID, ModuleID, Reference, EvidenceFilePath, EvidenceFileName, EvidenceMimeType, Status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, moduleId, reference || null, evidencePath, evidenceName, evidenceMime]
    );

    console.log('[submitPaymentEvidence] Insert successful, insertId:', result.insertId);

    // Notify admins about new payment evidence (best-effort)
    try {
      const [admins] = await query(
        "SELECT UserID FROM Users WHERE RoleID = (SELECT RoleID FROM Roles WHERE RoleTitle = 'Admin')"
      );

      const noteTitle = 'New Payment Evidence Submitted';
      const noteMessage = `User ${userId} submitted payment evidence for module ${moduleId}.`;

      for (const a of admins) {
        try {
          await notificationService.createNotification(a.UserID, noteTitle, noteMessage);
        } catch (_) {
          // ignore individual notification failures
        }
      }
    } catch (_err) {
      // non-fatal
      console.warn('Failed to notify admins about payment evidence', _err);
    }

    return res.status(201).json({ success: true, message: 'Payment evidence submitted.', data: { paymentId: result.insertId } });
  } catch (error) {
    console.error('Submit payment evidence error:', error.message, error.code);
    return res.status(500).json({ success: false, message: `Failed to submit payment evidence: ${error.message}` });
  }
}

async function getModulePaymentStatus(req, res) {
  try {
    const userId = req.user && req.user.userId;
    const moduleId = Number.parseInt(req.params.moduleId, 10);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!Number.isFinite(moduleId) || moduleId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid module ID.' });
    }

    const [rows] = await query(
      `SELECT Status FROM Payments WHERE UserID = ? AND ModuleID = ? ORDER BY CreatedAt DESC LIMIT 1`,
      [userId, moduleId]
    );

    if (!rows || rows.length === 0) {
      return res.json({ success: true, data: { status: 'unpaid' } });
    }

    const statusRow = rows[0];
    const status = (statusRow.Status || 'pending') .toString().toLowerCase();

    // Map DB status to frontend-friendly values
    if (status === 'approved') return res.json({ success: true, data: { status: 'paid' } });
    if (status === 'rejected') return res.json({ success: true, data: { status: 'rejected' } });
    return res.json({ success: true, data: { status: 'pending' } });
  } catch (error) {
    console.error('Get payment status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment status.' });
  }
}

module.exports = {
  submitPaymentEvidence,
  getModulePaymentStatus,
};
