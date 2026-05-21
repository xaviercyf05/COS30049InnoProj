const crypto = require('crypto');
const { query } = require('../config/db');

// Token expiration time in milliseconds (7 days)
const TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a unique verification token
 * @returns {string} - Random hex token
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a numeric login code for passwordless email login.
 * @returns {string} - Six digit login code.
 */
function generateLoginCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Create an email verification token in the database
 * @param {number} userId - User ID to create token for
 * @param {string} tokenType - Type of token ('account_activation', 'password_reset')
 * @returns {Promise<string>} - The generated token
 */
async function createVerificationToken(userId, tokenType = 'account_activation') {
  try {
    // Invalidate any existing tokens of the same type for this user
    await query(
      `DELETE FROM EmailVerificationTokens
       WHERE UserID = ? AND TokenType = ?`,
      [userId, tokenType]
    );

    // Generate new token
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

    // Store token in database
    await query(
      `INSERT INTO EmailVerificationTokens (UserID, Token, TokenType, ExpiresAt)
       VALUES (?, ?, ?, ?)`,
      [userId, token, tokenType, expiresAt]
    );

    console.log(`Verification token created for UserID: ${userId}, Type: ${tokenType}`);
    return token;
  } catch (error) {
    console.error('Error creating verification token:', error);
    throw error;
  }
}

/**
 * Create a short-lived login code in the database.
 * @param {number} userId - User ID to create the code for
 * @param {string} tokenType - Type of token ('login_code')
 * @returns {Promise<object>} - The generated token and expiry metadata
 */
async function createLoginCodeToken(userId, tokenType = 'login_code') {
  try {
    await query(
      `DELETE FROM EmailVerificationTokens
       WHERE UserID = ? AND TokenType = ?`,
      [userId, tokenType]
    );

    const token = generateLoginCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      `INSERT INTO EmailVerificationTokens (UserID, Token, TokenType, ExpiresAt)
       VALUES (?, ?, ?, ?)`,
      [userId, token, tokenType, expiresAt]
    );

    console.log(`Login code created for UserID: ${userId}, Type: ${tokenType}`);
    return { token, expiresAt };
  } catch (error) {
    console.error('Error creating login code token:', error);
    throw error;
  }
}

/**
 * Verify an email verification token
 * @param {string} token - Token to verify
 * @param {string} tokenType - Type of token to verify
 * @returns {Promise<object|null>} - Token record if valid, null otherwise
 */
async function verifyToken(token, tokenType = 'account_activation') {
  try {
    const [rows] = await query(
      `SELECT TokenID, UserID, Token, TokenType, ExpiresAt
       FROM EmailVerificationTokens
       WHERE Token = ? AND TokenType = ?
       LIMIT 1`,
      [token, tokenType]
    );

    if (rows.length === 0) {
      console.log(`Token verification failed: Token not found or incorrect type (${tokenType})`);
      return null;
    }

    const tokenRecord = rows[0];

    // Check if token has expired
    const expiresAt = new Date(tokenRecord.ExpiresAt);
    if (expiresAt < new Date()) {
      console.log(`Token verification failed: Token expired for UserID: ${tokenRecord.UserID}`);
      // Delete expired token
      await deleteVerificationToken(tokenRecord.TokenID);
      return null;
    }

    console.log(`Token verified successfully for UserID: ${tokenRecord.UserID}`);
    return tokenRecord;
  } catch (error) {
    console.error('Error verifying token:', error);
    throw error;
  }
}

/**
 * Delete a verification token after use
 * @param {number} tokenId - Token ID to delete
 * @returns {Promise<void>}
 */
async function deleteVerificationToken(tokenId) {
  try {
    await query(
      `DELETE FROM EmailVerificationTokens WHERE TokenID = ?`,
      [tokenId]
    );
    console.log(`Verification token deleted: ${tokenId}`);
  } catch (error) {
    console.error('Error deleting verification token:', error);
    throw error;
  }
}

/**
 * Delete a verification token by its raw token value.
 * @param {string} token - Token value to delete
 * @param {string|null} tokenType - Optional token type filter
 * @returns {Promise<void>}
 */
async function deleteVerificationTokenByToken(token, tokenType = null) {
  try {
    if (tokenType) {
      await query(
        `DELETE FROM EmailVerificationTokens WHERE Token = ? AND TokenType = ?`,
        [token, tokenType]
      );
      return;
    }

    await query(
      `DELETE FROM EmailVerificationTokens WHERE Token = ?`,
      [token]
    );
  } catch (error) {
    console.error('Error deleting verification token by value:', error);
    throw error;
  }
}

/**
 * Clean up expired tokens (can be called periodically)
 * @returns {Promise<number>} - Number of tokens deleted
 */
async function cleanupExpiredTokens() {
  try {
    const [result] = await query(
      `DELETE FROM EmailVerificationTokens WHERE ExpiresAt < NOW()`
    );

    const deletedCount = result.affectedRows || 0;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired verification tokens`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    throw error;
  }
}

/**
 * Activate user account after successful email verification
 * @param {number} userId - User ID to activate
 * @returns {Promise<object>} - Updated user object
 */
async function activateUserAccount(userId) {
  try {
    // Update user account to active
    await query(
      `UPDATE Users 
       SET IsActive = 1, Status = 'Active'
       WHERE UserID = ?`,
      [userId]
    );

    // Delete all verification tokens for this user (account activation only)
    await query(
      `DELETE FROM EmailVerificationTokens 
       WHERE UserID = ? AND TokenType = 'account_activation'`,
      [userId]
    );

    console.log(`User account activated: UserID ${userId}`);

    // Fetch updated user record
    const [rows] = await query(
      `SELECT UserID, Username, FullName, Email, IsActive, Status, RoleID
       FROM Users
       WHERE UserID = ?
       LIMIT 1`,
      [userId]
    );

    return rows[0] || null;
  } catch (error) {
    console.error('Error activating user account:', error);
    throw error;
  }
}

/**
 * Get user info from verification token without verifying expiration
 * (Used for displaying info before verification)
 * @param {string} token - Token to look up
 * @param {string} tokenType - Type of token
 * @returns {Promise<object|null>} - User record if token exists (regardless of expiration)
 */
async function getUserFromToken(token, tokenType = 'account_activation') {
  try {
    const [rows] = await query(
      `SELECT u.UserID, u.Username, u.FullName, u.Email, u.IsActive, u.Status,
              evt.ExpiresAt, evt.TokenID
       FROM EmailVerificationTokens evt
       JOIN Users u ON evt.UserID = u.UserID
       WHERE evt.Token = ? AND evt.TokenType = ?
       LIMIT 1`,
      [token, tokenType]
    );

    if (rows.length === 0) {
      return null;
    }

    const user = rows[0];

    // Check expiration status
    const expiresAt = new Date(user.ExpiresAt);
    user.isExpired = expiresAt < new Date();
    user.expiresAt = expiresAt;

    return user;
  } catch (error) {
    console.error('Error getting user from token:', error);
    throw error;
  }
}

module.exports = {
  createVerificationToken,
  createLoginCodeToken,
  verifyToken,
  deleteVerificationToken,
  deleteVerificationTokenByToken,
  cleanupExpiredTokens,
  activateUserAccount,
  getUserFromToken,
  generateVerificationToken,
  generateLoginCode,
};
