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

    const [moduleRows] = await query(
      `SELECT m.ModulePrice, mt.TypeName
         FROM Modules m
         LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
        WHERE m.ModuleID = ?
        LIMIT 1`,
      [moduleId]
    );

    if (!moduleRows || moduleRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Module not found.' });
    }

    const moduleTypeName = String(moduleRows[0].TypeName || '').trim().toLowerCase();
    const modulePrice = moduleRows[0].ModulePrice === null || moduleRows[0].ModulePrice === undefined
      ? null
      : Number(moduleRows[0].ModulePrice);

    if (moduleTypeName !== 'on-site training modules' && modulePrice === null) {
      return res.status(400).json({ success: false, message: 'Module price is not configured.' });
    }

    console.log('[submitPaymentEvidence] Inserting payment record:', { userId, moduleId, reference, evidencePath, evidenceName, evidenceMime });

    const [result] = await query(
      `INSERT INTO Payments (UserID, ModuleID, ModulePrice, Reference, EvidenceFilePath, EvidenceFileName, EvidenceMimeType, Status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, moduleId, modulePrice, reference || null, evidencePath, evidenceName, evidenceMime]
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

    return res.status(201).json({
      success: true,
      message: 'Payment evidence submitted.',
      data: {
        paymentId: result.insertId,
        modulePrice: modulePrice === null ? null : Number(modulePrice),
      },
    });
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
      `SELECT
         p.Status,
         COALESCE(p.ModulePrice, m.ModulePrice) AS ModulePrice,
         p.Reference,
         p.EvidenceFileName,
         p.EvidenceFilePath,
         p.ReviewRemark,
         p.CreatedAt,
         p.ReviewedAt
       FROM Modules m
       LEFT JOIN Payments p ON p.ModuleID = m.ModuleID AND p.UserID = ?
       WHERE m.ModuleID = ?
       ORDER BY p.CreatedAt DESC
       LIMIT 1`,
      [userId, moduleId]
    );

    if (!rows || rows.length === 0) {
      return res.json({
        success: true,
        data: {
          status: 'unpaid',
          modulePrice: null,
          price: null,
          fee: null,
          module_fee: null,
          modulePriceRaw: null,
        },
      });
    }

    const statusRow = rows[0];
    const status = (statusRow.Status || 'unpaid').toString().toLowerCase();
    const submission = {
      modulePrice: statusRow.ModulePrice === null || statusRow.ModulePrice === undefined ? null : Number(statusRow.ModulePrice),
      price: statusRow.ModulePrice === null || statusRow.ModulePrice === undefined ? null : Number(statusRow.ModulePrice),
      fee: statusRow.ModulePrice === null || statusRow.ModulePrice === undefined ? null : Number(statusRow.ModulePrice),
      module_fee: statusRow.ModulePrice === null || statusRow.ModulePrice === undefined ? null : Number(statusRow.ModulePrice),
      reference: statusRow.Reference || null,
      evidenceFileName: statusRow.EvidenceFileName || null,
      evidenceFilePath: statusRow.EvidenceFilePath || null,
      reviewRemark: statusRow.ReviewRemark || null,
      submittedAt: statusRow.CreatedAt || null,
      reviewedAt: statusRow.ReviewedAt || null,
    };

    // Map DB status to frontend-friendly values
    if (status === 'approved') return res.json({ success: true, data: { status: 'paid', modulePrice: submission.modulePrice, price: submission.price, fee: submission.fee, module_fee: submission.module_fee, submission } });
    if (status === 'rejected') return res.json({ success: true, data: { status: 'rejected', modulePrice: submission.modulePrice, price: submission.price, fee: submission.fee, module_fee: submission.module_fee, submission } });
    if (status === 'pending') return res.json({ success: true, data: { status: 'pending', modulePrice: submission.modulePrice, price: submission.price, fee: submission.fee, module_fee: submission.module_fee, submission } });
    return res.json({ success: true, data: { status: 'unpaid', modulePrice: submission.modulePrice, price: submission.price, fee: submission.fee, module_fee: submission.module_fee, submission } });
  } catch (error) {
    console.error('Get payment status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment status.' });
  }
}

module.exports = {
  submitPaymentEvidence,
  getModulePaymentStatus,
};
