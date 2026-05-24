const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { query } = require('../config/db');

/**
 * Generates a new TOTP secret and returns QR code data
 * @param {string} username - The user's username
 * @param {string} issuer - The application name
 * @returns {Promise<Object>} Object with secret, QR code, and recovery codes
 */
async function generateMFASetup(username, issuer = 'InnoPApp') {
  // Generate a new secret
  const secret = speakeasy.generateSecret({
    name: `${issuer} (${username})`,
    issuer: issuer,
    length: 32,
  });

  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  // Generate recovery codes
  const recoveryCodes = generateRecoveryCodes(10);

  return {
    secret: secret.base32,
    qrCode,
    recoveryCodes,
    otpauthUrl: secret.otpauth_url,
  };
}

/**
 * Verifies a TOTP token against a secret
 * @param {string} token - The 6-digit TOTP token from user's authenticator app
 * @param {string} secret - The base32-encoded secret
 * @returns {boolean} Whether the token is valid
 */
function verifyToken(token, secret) {
  if (!token || !secret) {
    return false;
  }

  try {
    const isValid = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2, // Allow 2 time windows (30 seconds before/after)
    });

    return isValid;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

/**
 * Generates an array of recovery codes
 * @param {number} count - Number of codes to generate
 * @returns {Array<string>} Array of recovery codes
 */
function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
  }
  return codes;
}

/**
 * Enables MFA for a user
 * @param {number} userId - The user's ID
 * @param {string} secret - The TOTP secret (base32 encoded)
 * @param {Array<string>} recoveryCodes - Array of recovery codes
 * @param {string} method - MFA method (default: 'TOTP')
 * @returns {Promise<boolean>} Success status
 */
async function enableMFAForUser(userId, secret, recoveryCodes, method = 'TOTP') {
  try {
    const backupCodesJson = JSON.stringify(recoveryCodes.map(code => ({ code, used: false })));

    await query(
      `UPDATE Users 
       SET MFAEnabled = 1, MFASecret = ?, MFAMethod = ?, BackupCodes = ?, MFASetupAt = NOW()
       WHERE UserID = ?`,
      [secret, method, backupCodesJson, userId]
    );

    // Store recovery codes in dedicated table
    for (const code of recoveryCodes) {
      await query(
        `INSERT INTO MFARecoveryCodes (UserID, RecoveryCode) VALUES (?, ?)`,
        [userId, code]
      );
    }

    return true;
  } catch (error) {
    console.error('Error enabling MFA for user:', error);
    throw error;
  }
}

/**
 * Disables MFA for a user
 * @param {number} userId - The user's ID
 * @returns {Promise<boolean>} Success status
 */
async function disableMFAForUser(userId) {
  try {
    await query(
      `UPDATE Users 
       SET MFAEnabled = 0, MFASecret = NULL, BackupCodes = NULL
       WHERE UserID = ?`,
      [userId]
    );

    // Clear recovery codes
    await query('DELETE FROM MFARecoveryCodes WHERE UserID = ?', [userId]);

    return true;
  } catch (error) {
    console.error('Error disabling MFA for user:', error);
    throw error;
  }
}

/**
 * Gets MFA status for a user
 * @param {number} userId - The user's ID
 * @returns {Promise<Object>} MFA status object
 */
async function getMFAStatus(userId) {
  try {
    const [rows] = await query(
      `SELECT MFAEnabled, MFAMethod, MFASetupAt FROM Users WHERE UserID = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    const user = rows[0];
    const [recoveryCodes] = await query(
      `SELECT COUNT(*) as totalCodes, SUM(CASE WHEN IsUsed = 0 THEN 1 ELSE 0 END) as unusedCodes 
       FROM MFARecoveryCodes WHERE UserID = ?`,
      [userId]
    );

    return {
      enabled: user.MFAEnabled === 1,
      method: user.MFAMethod,
      setupAt: user.MFASetupAt,
      recoveryCodesRemaining: recoveryCodes[0]?.unusedCodes || 0,
      totalRecoveryCodes: recoveryCodes[0]?.totalCodes || 0,
    };
  } catch (error) {
    console.error('Error getting MFA status:', error);
    throw error;
  }
}

/**
 * Verifies using a recovery code and marks it as used
 * @param {number} userId - The user's ID
 * @param {string} recoveryCode - The recovery code to verify
 * @returns {Promise<boolean>} Whether verification was successful
 */
async function verifyRecoveryCode(userId, recoveryCode) {
  try {
    const [rows] = await query(
      `SELECT RecoveryCodeID FROM MFARecoveryCodes 
       WHERE UserID = ? AND RecoveryCode = ? AND IsUsed = 0
       LIMIT 1`,
      [userId, recoveryCode]
    );

    if (rows.length === 0) {
      return false;
    }

    const codeId = rows[0].RecoveryCodeID;

    // Mark as used
    await query(
      `UPDATE MFARecoveryCodes SET IsUsed = 1, UsedAt = NOW() WHERE RecoveryCodeID = ?`,
      [codeId]
    );

    return true;
  } catch (error) {
    console.error('Error verifying recovery code:', error);
    throw error;
  }
}

/**
 * Logs MFA audit events
 * @param {number} userId - The user's ID
 * @param {string} action - The action taken
 * @param {Object} details - Additional details
 * @param {string} ipAddress - IP address
 * @param {string} userAgent - User agent string
 * @returns {Promise<void>}
 */
async function logMFAAudit(userId, action, details = null, ipAddress = null, userAgent = null) {
  try {
    const detailsJson = details ? JSON.stringify(details) : null;
    await query(
      `INSERT INTO MFAAudit (UserID, Action, Details, IPAddress, UserAgent) VALUES (?, ?, ?, ?, ?)`,
      [userId, action, detailsJson, ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Error logging MFA audit:', error);
  }
}

/**
 * Gets MFA secret for a user (for verification during login)
 * @param {number} userId - The user's ID
 * @returns {Promise<string|null>} The MFA secret or null if not enabled
 */
async function getMFASecret(userId) {
  try {
    const [rows] = await query(
      `SELECT MFASecret FROM Users WHERE UserID = ? AND MFAEnabled = 1`,
      [userId]
    );

    return rows.length > 0 ? rows[0].MFASecret : null;
  } catch (error) {
    console.error('Error getting MFA secret:', error);
    throw error;
  }
}

module.exports = {
  generateMFASetup,
  verifyToken,
  generateRecoveryCodes,
  enableMFAForUser,
  disableMFAForUser,
  getMFAStatus,
  verifyRecoveryCode,
  logMFAAudit,
  getMFASecret,
};
