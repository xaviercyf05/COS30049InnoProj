const passkeyService = require('../services/passkeyService');
const { createAuthTokenService } = require('../services/authTokenService');
const progressService = require('../services/progressService');

const authTokenService = createAuthTokenService();

function getAuthenticatedUserId(req) {
  return req.user?.userId || req.admin?.userId || req.admin?.id || null;
}

async function issuePasskeyTokenPair(req, user, remember) {
  const tokenPair = await authTokenService.issueTokenPair({
    user,
    remember: !!remember,
    userAgent: req.headers['user-agent'] || null,
    ipAddress: req.ip || req.socket?.remoteAddress || null,
  });

  try {
    await progressService.syncUserOverallProgress(user.UserID);
  } catch (error) {
    console.warn('Unable to sync overall progress on passkey login:', error.message);
  }

  return tokenPair;
}

function buildPasskeySuccessPayload(user, tokenPair) {
  return {
    success: true,
    data: {
      token: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      tokenType: 'Bearer',
      expiresIn: tokenPair.accessTokenExpiresIn,
      refreshTokenExpiresIn: tokenPair.refreshTokenExpiresIn,
      user: {
        userId: user.UserID,
        username: user.Username,
        role: user.RoleTitle,
      },
    },
  };
}

async function initiatePasskeyRegistration(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }

    const { deviceName } = req.body || {};
    const data = await passkeyService.createPasskeyRegistrationOptions(userId);

    return res.json({
      success: true,
      data: {
        options: data.options,
        tempToken: data.tempToken,
        user: data.user,
        deviceName: String(deviceName || '').trim() || undefined,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('Passkey registration initiation error:', error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? 'Error initiating passkey registration.' : error.message,
    });
  }
}

async function confirmPasskeyRegistration(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);
    const { tempToken, credential, deviceName } = req.body || {};

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }

    if (!tempToken || !credential) {
      return res.status(400).json({
        success: false,
        message: 'Temporary token and passkey credential are required.',
      });
    }

    const result = await passkeyService.verifyPasskeyRegistration({
      tempToken,
      credential,
      deviceName,
    });

    if (Number(result.userId) !== Number(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Passkey registration does not match the authenticated user.',
      });
    }

    return res.json({
      success: true,
      message: 'Passkey registered successfully.',
      data: {
        credentialId: result.credentialId,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('Passkey registration confirmation error:', error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? 'Error confirming passkey registration.' : error.message,
    });
  }
}

async function listPasskeys(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }

    const passkeys = await passkeyService.listPasskeysForUser(userId);

    return res.json({
      success: true,
      data: {
        passkeys,
        total: passkeys.length,
      },
    });
  } catch (error) {
    console.error('List passkeys error:', error);
    return res.status(500).json({ success: false, message: 'Error loading passkeys.' });
  }
}

async function deletePasskey(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);
    const credentialId = String(req.params?.credentialId || '').trim();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }

    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'Credential ID is required.' });
    }

    const affectedRows = await passkeyService.deletePasskeyCredential(userId, credentialId);

    if (!affectedRows) {
      return res.status(404).json({ success: false, message: 'Passkey not found.' });
    }

    return res.json({
      success: true,
      message: 'Passkey removed successfully.',
    });
  } catch (error) {
    console.error('Delete passkey error:', error);
    return res.status(500).json({ success: false, message: 'Error removing passkey.' });
  }
}

async function initiatePasskeyAuthentication(req, res) {
  try {
    const identifier = String(req.body?.identifier || req.body?.username || req.body?.email || req.body?.userId || '').trim();
    const data = await passkeyService.createPasskeyAuthenticationOptions(identifier);

    return res.json({
      success: true,
      data: {
        options: data.options,
        tempToken: data.tempToken,
        user: data.user,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('Passkey authentication initiation error:', error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? 'Error initiating passkey sign-in.' : error.message,
    });
  }
}

async function verifyPasskeyAuthentication(req, res) {
  try {
    const { tempToken, credential } = req.body || {};

    if (!tempToken || !credential) {
      return res.status(400).json({
        success: false,
        message: 'Temporary token and passkey credential are required.',
      });
    }

    const result = await passkeyService.verifyPasskeyAuthentication({ tempToken, credential });
    const tokenPair = await issuePasskeyTokenPair(req, result.user, req.body?.remember);

    return res.json(buildPasskeySuccessPayload(result.user, tokenPair));
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('Passkey authentication verification error:', error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? 'Error verifying passkey sign-in.' : error.message,
    });
  }
}

module.exports = {
  initiatePasskeyRegistration,
  confirmPasskeyRegistration,
  listPasskeys,
  deletePasskey,
  initiatePasskeyAuthentication,
  verifyPasskeyAuthentication,
};