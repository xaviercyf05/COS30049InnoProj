const mfaService = require('../services/mfaService');
const { query } = require('../config/db');

function getAuthenticatedUserId(req) {
  return req.user?.userId || req.admin?.userId || req.admin?.id || null;
}

/**
 * Start MFA setup - generates new secret and QR code
 * Returns data needed for user to set up authenticator app
 */
async function initiateMFASetup(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.',
      });
    }

    // Get user info
    const [users] = await query('SELECT Username, MFAEnabled FROM Users WHERE UserID = ?', [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = users[0];

    if (user.MFAEnabled) {
      return res.status(400).json({
        success: false,
        message: 'MFA is already enabled for this account. Disable it first to set up again.',
      });
    }

    // Generate new setup
    const setup = await mfaService.generateMFASetup(user.Username, 'InnoPApp');

    // Log audit event
    await mfaService.logMFAAudit(
      userId,
      'MFA_SETUP_INITIATED',
      { method: 'TOTP' },
      req.ip || req.socket?.remoteAddress,
      req.headers['user-agent']
    );

    return res.json({
      success: true,
      data: {
        secret: setup.secret,
        qrCode: setup.qrCode,
        recoveryCodes: setup.recoveryCodes,
        message: 'Scan the QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.) and enter the 6-digit code to confirm.',
      },
    });
  } catch (error) {
    console.error('MFA setup initiation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error initiating MFA setup.',
    });
  }
}

/**
 * Confirm MFA setup - verifies token and enables MFA
 */
async function confirmMFASetup(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);
    const { secret, token, recoveryCodes } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.',
      });
    }

    if (!secret || !token || !recoveryCodes || !Array.isArray(recoveryCodes)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: secret, token, recoveryCodes.',
      });
    }

    // Verify the token
    const isValid = mfaService.verifyToken(token, secret);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token. Please check the 6-digit code from your authenticator app.',
      });
    }

    // Enable MFA for user
    await mfaService.enableMFAForUser(userId, secret, recoveryCodes, 'TOTP');

    // Log audit event
    await mfaService.logMFAAudit(
      userId,
      'MFA_ENABLED',
      { method: 'TOTP' },
      req.ip || req.socket?.remoteAddress,
      req.headers['user-agent']
    );

    return res.json({
      success: true,
      message: 'MFA has been successfully enabled for your account.',
      data: {
        enabled: true,
        recoveryCodesCount: recoveryCodes.length,
      },
    });
  } catch (error) {
    console.error('MFA setup confirmation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error confirming MFA setup.',
    });
  }
}

/**
 * Disable MFA for a user
 */
async function disableMFA(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);
    const { password } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to disable MFA.',
      });
    }

    // Get user and verify password
    const [users] = await query('SELECT PasswordHash FROM Users WHERE UserID = ?', [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, users[0].PasswordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password.',
      });
    }

    // Disable MFA
    await mfaService.disableMFAForUser(userId);

    // Log audit event
    await mfaService.logMFAAudit(
      userId,
      'MFA_DISABLED',
      {},
      req.ip || req.socket?.remoteAddress,
      req.headers['user-agent']
    );

    return res.json({
      success: true,
      message: 'MFA has been disabled for your account.',
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error disabling MFA.',
    });
  }
}

/**
 * Get MFA status for the current user
 */
async function getMFAStatus(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.',
      });
    }

    const status = await mfaService.getMFAStatus(userId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('MFA status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving MFA status.',
    });
  }
}

/**
 * Verify MFA token during login - internal endpoint used after password verification
 */
async function verifyMFAToken(req, res) {
  try {
    const { userId, token, recoveryCode } = req.body;

    if (!userId || (!token && !recoveryCode)) {
      return res.status(400).json({
        success: false,
        message: 'User ID and either token or recovery code is required.',
      });
    }

    // Get user's MFA secret
    const secret = await mfaService.getMFASecret(userId);

    if (!secret) {
      return res.status(400).json({
        success: false,
        message: 'MFA is not enabled for this user.',
      });
    }

    let isValid = false;
    let usedRecoveryCode = false;

    // Try token verification first
    if (token) {
      isValid = mfaService.verifyToken(token, secret);
    }
    // Fall back to recovery code
    else if (recoveryCode) {
      isValid = await mfaService.verifyRecoveryCode(userId, recoveryCode);
      usedRecoveryCode = true;
    }

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: usedRecoveryCode
          ? 'Invalid or already used recovery code.'
          : 'Invalid token. Check the 6-digit code from your authenticator app.',
      });
    }

    // Log successful MFA verification
    await mfaService.logMFAAudit(
      userId,
      usedRecoveryCode ? 'MFA_VERIFIED_RECOVERY_CODE' : 'MFA_VERIFIED_TOKEN',
      {},
      req.ip || req.socket?.remoteAddress,
      req.headers['user-agent']
    );

    return res.json({
      success: true,
      message: 'MFA verification successful.',
      data: {
        verified: true,
        usedRecoveryCode,
      },
    });
  } catch (error) {
    console.error('MFA token verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying MFA token.',
    });
  }
}

/**
 * Generate new recovery codes
 */
async function regenerateRecoveryCodes(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);
    const { password } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to regenerate recovery codes.',
      });
    }

    // Verify password
    const [users] = await query('SELECT PasswordHash, MFAEnabled FROM Users WHERE UserID = ?', [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!users[0].MFAEnabled) {
      return res.status(400).json({
        success: false,
        message: 'MFA is not enabled for this account.',
      });
    }

    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, users[0].PasswordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password.',
      });
    }

    // Delete old recovery codes
    await query('DELETE FROM MFARecoveryCodes WHERE UserID = ?', [userId]);

    // Generate new codes
    const newCodes = mfaService.generateRecoveryCodes(10);

    // Store new codes
    for (const code of newCodes) {
      await query(
        'INSERT INTO MFARecoveryCodes (UserID, RecoveryCode) VALUES (?, ?)',
        [userId, code]
      );
    }

    // Update backup codes in Users table
    const backupCodesJson = JSON.stringify(newCodes.map(code => ({ code, used: false })));
    await query('UPDATE Users SET BackupCodes = ? WHERE UserID = ?', [backupCodesJson, userId]);

    // Log audit event
    await mfaService.logMFAAudit(
      userId,
      'MFA_RECOVERY_CODES_REGENERATED',
      { count: newCodes.length },
      req.ip || req.socket?.remoteAddress,
      req.headers['user-agent']
    );

    return res.json({
      success: true,
      message: 'Recovery codes have been regenerated.',
      data: {
        recoveryCodes: newCodes,
      },
    });
  } catch (error) {
    console.error('Recovery codes regeneration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error regenerating recovery codes.',
    });
  }
}

module.exports = {
  initiateMFASetup,
  confirmMFASetup,
  disableMFA,
  getMFAStatus,
  verifyMFAToken,
  regenerateRecoveryCodes,
};
