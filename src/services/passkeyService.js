const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const env = require('../config/env');
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');

const PASSKEY_CHALLENGE_TTL = '10m';
const PASSKEY_REGISTRATION_TOKEN_TYPE = 'passkey_registration';
const PASSKEY_AUTHENTICATION_TOKEN_TYPE = 'passkey_authentication';

function getPasskeyOrigin() {
  return process.env.PASSKEY_ORIGIN || 'https://innopappserver.xyz';
}

function getExpectedOrigin(requestOrigin) {
  const normalizedOrigin = String(requestOrigin || '').trim();

  if (normalizedOrigin && normalizedOrigin !== 'null') {
    return normalizedOrigin;
  }

  return getPasskeyOrigin();
}

function getPasskeyRpId() {
  if (process.env.PASSKEY_RP_ID) {
    return process.env.PASSKEY_RP_ID;
  }

  try {
    const originHost = new URL(getPasskeyOrigin()).hostname;
    return originHost.replace(/^api\./i, '');
  } catch {
    return 'innopappserver.xyz';
  }
}

function getPasskeyRpName() {
  return process.env.PASSKEY_RP_NAME || 'Sarawak Guide Training';
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(String(value), 'base64url');
}

function parseTransports(transports) {
  if (!transports) {
    return undefined;
  }

  if (Array.isArray(transports)) {
    return transports.filter(Boolean);
  }

  try {
    const parsed = JSON.parse(transports);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : undefined;
  } catch {
    return String(transports)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function parseBoolean(value) {
  return value === 1 || value === '1' || value === true;
}

function signChallengeToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: PASSKEY_CHALLENGE_TTL });
}

function verifyChallengeToken(token, expectedType) {
  const payload = jwt.verify(token, env.jwtSecret);

  if (payload.type !== expectedType) {
    const error = new Error('Invalid passkey challenge token.');
    error.statusCode = 401;
    throw error;
  }

  return payload;
}

async function findUserByIdentifier(identifier) {
  const normalizedIdentifier = String(identifier || '').trim();

  if (!normalizedIdentifier) {
    return null;
  }

  const parsedUserId = /^\d+$/.test(normalizedIdentifier)
    ? Number.parseInt(normalizedIdentifier, 10)
    : null;

  const [rows] = await query(
    `SELECT u.UserID, u.Username, u.FullName, u.Email, u.Status, u.IsActive, r.RoleTitle
       FROM Users u
       INNER JOIN Roles r ON r.RoleID = u.RoleID
      WHERE u.Username = ?
         OR u.Email = ?
         OR (? IS NOT NULL AND u.UserID = ?)
      LIMIT 1`,
    [normalizedIdentifier, normalizedIdentifier, parsedUserId, parsedUserId]
  );

  return rows.length > 0 ? rows[0] : null;
}

async function listPasskeyCredentialsForUser(userId) {
  const [rows] = await query(
    `SELECT CredentialID,
            UserID,
            PublicKey,
            Counter,
            Transports,
            DeviceName,
            AAGUID,
            BackupEligible,
            IsDiscoverable,
            CreatedAt,
            LastUsedAt
       FROM PasskeyCredentials
      WHERE UserID = ?
      ORDER BY CreatedAt DESC`,
    [userId]
  );

  return rows.map((row) => ({
    ...row,
    Counter: Number(row.Counter || 0),
    Transports: parseTransports(row.Transports),
    BackupEligible: parseBoolean(row.BackupEligible),
    IsDiscoverable: parseBoolean(row.IsDiscoverable),
  }));
}

async function getPasskeyCredentialById(credentialId) {
  const normalizedCredentialId = String(credentialId || '').trim();

  if (!normalizedCredentialId) {
    return null;
  }

  const [rows] = await query(
    `SELECT pc.CredentialID,
            pc.UserID,
            pc.PublicKey,
            pc.Counter,
            pc.Transports,
            pc.DeviceName,
            pc.AAGUID,
            pc.BackupEligible,
            pc.IsDiscoverable,
            u.Username,
            u.FullName,
            u.Email,
            u.Status,
            u.IsActive,
            r.RoleTitle
       FROM PasskeyCredentials pc
       INNER JOIN Users u ON u.UserID = pc.UserID
       INNER JOIN Roles r ON r.RoleID = u.RoleID
      WHERE pc.CredentialID = ?
      LIMIT 1`,
    [normalizedCredentialId]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    ...row,
    Counter: Number(row.Counter || 0),
    Transports: parseTransports(row.Transports),
    BackupEligible: parseBoolean(row.BackupEligible),
    IsDiscoverable: parseBoolean(row.IsDiscoverable),
  };
}

function getCredentialIdFromResponse(response) {
  const candidate = response?.id || response?.rawId || response?.response?.id || null;

  if (!candidate) {
    return '';
  }

  if (typeof candidate === 'string') {
    return candidate.trim();
  }

  if (candidate instanceof ArrayBuffer || ArrayBuffer.isView(candidate)) {
    return encodeBase64Url(Buffer.from(candidate));
  }

  return String(candidate).trim();
}

async function createPasskeyRegistrationOptions(userId) {
  const user = await findUserByIdentifier(userId);

  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const existingCredentials = await listPasskeyCredentialsForUser(user.UserID);

  const options = await generateRegistrationOptions({
    rpName: getPasskeyRpName(),
    rpID: getPasskeyRpId(),
    userID: Buffer.from(String(user.UserID), 'utf8'),
    userName: user.Username,
    userDisplayName: user.FullName || user.Username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    supportedAlgorithmIDs: [-7, -257],
    excludeCredentials: existingCredentials.map((credential) => ({
      id: decodeBase64Url(credential.CredentialID),
      type: 'public-key',
      transports: credential.Transports,
    })),
  });

  const tempToken = signChallengeToken({
    type: PASSKEY_REGISTRATION_TOKEN_TYPE,
    challenge: options.challenge,
    userId: user.UserID,
    username: user.Username,
  });

  return {
    options,
    tempToken,
    user: {
      userId: user.UserID,
      username: user.Username,
      fullName: user.FullName,
      role: user.RoleTitle,
    },
  };
}

async function verifyPasskeyRegistration({ tempToken, credential, deviceName, expectedOrigin }) {
  const challengePayload = verifyChallengeToken(tempToken, PASSKEY_REGISTRATION_TOKEN_TYPE);
  const userId = Number(challengePayload.userId);

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: challengePayload.challenge,
    expectedOrigin: getExpectedOrigin(expectedOrigin),
    expectedRPID: getPasskeyRpId(),
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    const error = new Error('Passkey registration verification failed.');
    error.statusCode = 400;
    throw error;
  }

  const {
    credentialPublicKey,
    counter,
    credentialDeviceType,
    credentialBackedUp,
    credential: registeredCredential,
    aaguid,
  } = verification.registrationInfo;

  const credentialId = String(
    registeredCredential?.id || registeredCredential?.rawId || responseCredentialIdFromBrowser(credential) || ''
  ).trim();
  const credentialPublicKeyBase64 = encodeBase64Url(Buffer.from(credentialPublicKey));
  const transports = Array.isArray(credential.response?.transports)
    ? credential.response.transports.filter(Boolean)
    : [];
  const responseDeviceName = String(deviceName || credentialDeviceType || 'Passkey').trim().slice(0, 120);

  await query(
    `INSERT INTO PasskeyCredentials
      (CredentialID, UserID, PublicKey, Counter, Transports, DeviceName, AAGUID, BackupEligible, IsDiscoverable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      credentialId,
      userId,
      credentialPublicKeyBase64,
      Number(counter || 0),
      JSON.stringify(transports),
      responseDeviceName,
      aaguid || null,
      credentialBackedUp ? 1 : 0,
      1,
    ]
  );

  return {
    credentialId,
    userId,
    deviceName: responseDeviceName,
  };
}

function responseCredentialIdFromBrowser(responseCredential) {
  return String(responseCredential?.id || responseCredential?.rawId || '').trim();
}

async function createPasskeyAuthenticationOptions(identifier = '') {
  const user = await findUserByIdentifier(identifier);
  const credentials = user ? await listPasskeyCredentialsForUser(user.UserID) : [];

  const options = await generateAuthenticationOptions({
    rpID: getPasskeyRpId(),
    userVerification: 'preferred',
    allowCredentials: credentials.map((credential) => ({
      id: decodeBase64Url(credential.CredentialID),
      type: 'public-key',
      transports: credential.Transports,
    })),
  });

  const tempToken = signChallengeToken({
    type: PASSKEY_AUTHENTICATION_TOKEN_TYPE,
    challenge: options.challenge,
    userId: user?.UserID || null,
  });

  return {
    options,
    tempToken,
    user: user
      ? {
          userId: user.UserID,
          username: user.Username,
          fullName: user.FullName,
          role: user.RoleTitle,
        }
      : null,
  };
}

async function verifyPasskeyAuthentication({ tempToken, credential, expectedOrigin }) {
  const challengePayload = verifyChallengeToken(tempToken, PASSKEY_AUTHENTICATION_TOKEN_TYPE);
  const credentialId = getCredentialIdFromResponse(credential);

  const storedCredential = await getPasskeyCredentialById(credentialId);

  if (!storedCredential) {
    const error = new Error('Passkey credential not found.');
    error.statusCode = 401;
    throw error;
  }

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: challengePayload.challenge,
    expectedOrigin: getExpectedOrigin(expectedOrigin),
    expectedRPID: getPasskeyRpId(),
    requireUserVerification: false,
    authenticator: {
      credentialID: decodeBase64Url(storedCredential.CredentialID),
      credentialPublicKey: decodeBase64Url(storedCredential.PublicKey),
      counter: storedCredential.Counter,
      transports: storedCredential.Transports,
    },
  });

  if (!verification.verified || !verification.authenticationInfo) {
    const error = new Error('Passkey authentication verification failed.');
    error.statusCode = 401;
    throw error;
  }

  await query(
    `UPDATE PasskeyCredentials
        SET Counter = ?, LastUsedAt = NOW()
      WHERE CredentialID = ?`,
    [verification.authenticationInfo.newCounter, storedCredential.CredentialID]
  );

  return {
    user: {
      userId: storedCredential.UserID,
      username: storedCredential.Username,
      fullName: storedCredential.FullName,
      role: storedCredential.RoleTitle,
    },
    credentialId: storedCredential.CredentialID,
  };
}

async function listPasskeysForUser(userId) {
  return listPasskeyCredentialsForUser(userId);
}

async function deletePasskeyCredential(userId, credentialId) {
  const normalizedCredentialId = String(credentialId || '').trim();

  if (!normalizedCredentialId) {
    return 0;
  }

  const [result] = await query(
    `DELETE FROM PasskeyCredentials WHERE UserID = ? AND CredentialID = ?`,
    [userId, normalizedCredentialId]
  );

  return result?.affectedRows || 0;
}

module.exports = {
  createPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  createPasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  listPasskeysForUser,
  deletePasskeyCredential,
  getPasskeyOrigin,
  getPasskeyRpId,
  getPasskeyRpName,
};