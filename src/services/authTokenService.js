const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const env = require('../config/env');

function parseExpiresInToMs(expiresIn) {
  if (!expiresIn) return 0;

  const value = String(expiresIn).trim().toLowerCase();
  const match = value.match(/^(\d+)([smhd])$/);

  if (!match) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric * 1000 : 0;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

  return amount * multipliers[unit];
}

function calculateExpiresAt(expiresIn, referenceDate = new Date()) {
  const expiresMs = parseExpiresInToMs(expiresIn);
  if (!expiresMs) {
    throw new Error(`Unsupported expiresIn value: ${expiresIn}`);
  }

  return new Date(referenceDate.getTime() + expiresMs);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function createJti() {
  return crypto.randomUUID();
}

function getAccessTokenExpiresIn(envConfig = env) {
  return envConfig.jwtExpiresIn || '12h';
}

function getRefreshTokenExpiresIn(remember, envConfig = env) {
  if (remember) {
    return envConfig.jwtRememberExpiresIn || '7d';
  }

  return envConfig.jwtSessionRefreshExpiresIn || envConfig.jwtExpiresIn || '12h';
}

function signAccessToken(user, remember, jwtLib = jwt, envConfig = env) {
  return jwtLib.sign(
    {
      sub: user.UserID,
      username: user.Username,
      role: user.RoleTitle,
      remember: !!remember,
      tokenType: 'access',
    },
    envConfig.jwtSecret,
    {
      expiresIn: getAccessTokenExpiresIn(envConfig),
      jwtid: createJti(),
    }
  );
}

function signRefreshToken(user, remember, familyId, jwtLib = jwt, envConfig = env) {
  const expiresIn = getRefreshTokenExpiresIn(remember, envConfig);

  return {
    token: jwtLib.sign(
      {
        sub: user.UserID,
        username: user.Username,
        role: user.RoleTitle,
        remember: !!remember,
        tokenType: 'refresh',
        tokenFamily: familyId,
      },
      envConfig.jwtSecret,
      {
        expiresIn,
        jwtid: createJti(),
      }
    ),
    expiresIn,
  };
}

async function persistRefreshToken({
  userId,
  token,
  tokenFamily,
  remember,
  userAgent = null,
  ipAddress = null,
  queryImpl = query,
  envConfig = env,
}) {
  const payload = jwt.verify(token, envConfig.jwtSecret);
  const expiresAt = calculateExpiresAt(getRefreshTokenExpiresIn(remember, envConfig));

  await queryImpl(
    `INSERT INTO RefreshTokens
      (UserID, TokenJti, TokenFamily, TokenHash, IsRemember, ExpiresAt, UserAgent, IpAddress)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      payload.jti,
      tokenFamily,
      hashToken(token),
      remember ? 1 : 0,
      expiresAt,
      userAgent,
      ipAddress,
    ]
  );

  return { payload, expiresAt };
}

async function findRefreshTokenRecord(token, { queryImpl = query, envConfig = env } = {}) {
  const tokenHash = hashToken(token);
  const [rows] = await queryImpl(
    `SELECT TokenID,
            UserID,
            TokenJti,
            TokenFamily,
            TokenHash,
            IsRemember,
            ExpiresAt,
            RevokedAt,
            ReplacedByTokenID,
            CreatedAt,
            LastUsedAt
       FROM RefreshTokens
      WHERE TokenHash = ?
      LIMIT 1`,
    [tokenHash]
  );

  return rows.length > 0 ? rows[0] : null;
}

async function revokeRefreshTokenById(tokenId, { queryImpl = query } = {}) {
  await queryImpl(
    `UPDATE RefreshTokens
        SET RevokedAt = COALESCE(RevokedAt, NOW())
      WHERE TokenID = ?`,
    [tokenId]
  );
}

async function rotateRefreshToken({
  refreshToken,
  queryImpl = query,
  jwtLib = jwt,
  envConfig = env,
  userAgent = null,
  ipAddress = null,
}) {
  let payload;

  try {
    payload = jwtLib.verify(refreshToken, envConfig.jwtSecret);
  } catch (error) {
    const authError = new Error('Invalid or expired refresh token.');
    authError.statusCode = 401;
    throw authError;
  }

  if (payload.tokenType !== 'refresh') {
    const authError = new Error('Invalid refresh token.');
    authError.statusCode = 401;
    throw authError;
  }

  const [tokenRows] = await queryImpl(
    `SELECT TokenID,
            UserID,
            TokenJti,
            TokenFamily,
            TokenHash,
            IsRemember,
            ExpiresAt,
            RevokedAt,
            ReplacedByTokenID,
            CreatedAt,
            LastUsedAt
       FROM RefreshTokens
      WHERE TokenHash = ?
      LIMIT 1`,
    [hashToken(refreshToken)]
  );

  if (tokenRows.length === 0) {
    const authError = new Error('Refresh token not recognized.');
    authError.statusCode = 401;
    throw authError;
  }

  const tokenRow = tokenRows[0];

  if (tokenRow.RevokedAt) {
    const authError = new Error('Refresh token already used or revoked.');
    authError.statusCode = 401;
    throw authError;
  }

  if (new Date(tokenRow.ExpiresAt).getTime() <= Date.now()) {
    const authError = new Error('Refresh token expired.');
    authError.statusCode = 401;
    throw authError;
  }

  const userRecord = {
    UserID: tokenRow.UserID,
    Username: payload.username,
    RoleTitle: payload.role,
  };

  const remember = !!tokenRow.IsRemember;
  const familyId = tokenRow.TokenFamily || payload.tokenFamily || createJti();
  const accessToken = signAccessToken(userRecord, remember, jwtLib, envConfig);
  const refreshTokenBundle = signRefreshToken(userRecord, remember, familyId, jwtLib, envConfig);

  const expiresAt = calculateExpiresAt(refreshTokenBundle.expiresIn);

  const [insertResult] = await queryImpl(
    `INSERT INTO RefreshTokens
      (UserID, TokenJti, TokenFamily, TokenHash, IsRemember, ExpiresAt, UserAgent, IpAddress)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tokenRow.UserID,
      jwtLib.decode(refreshTokenBundle.token).jti,
      familyId,
      hashToken(refreshTokenBundle.token),
      remember ? 1 : 0,
      expiresAt,
      userAgent,
      ipAddress,
    ]
  );

  await queryImpl(
    `UPDATE RefreshTokens
        SET RevokedAt = COALESCE(RevokedAt, NOW()),
            ReplacedByTokenID = ?
      WHERE TokenID = ?`,
    [insertResult.insertId, tokenRow.TokenID]
  );

  return {
    accessToken,
    refreshToken: refreshTokenBundle.token,
    accessTokenExpiresIn: getAccessTokenExpiresIn(envConfig),
    refreshTokenExpiresIn: refreshTokenBundle.expiresIn,
    remember,
  };
}

function createAuthTokenService(overrides = {}) {
  const queryImpl = overrides.queryImpl || query;
  const jwtLib = overrides.jwtLib || jwt;
  const envConfig = overrides.envConfig || env;

  return {
    issueTokenPair({ user, remember, userAgent = null, ipAddress = null }) {
      const familyId = createJti();
      const accessToken = signAccessToken(user, remember, jwtLib, envConfig);
      const refreshBundle = signRefreshToken(user, remember, familyId, jwtLib, envConfig);

      return persistRefreshToken({
        userId: user.UserID,
        token: refreshBundle.token,
        tokenFamily: familyId,
        remember,
        userAgent,
        ipAddress,
        queryImpl,
        envConfig,
      }).then(() => ({
        accessToken,
        refreshToken: refreshBundle.token,
        accessTokenExpiresIn: getAccessTokenExpiresIn(envConfig),
        refreshTokenExpiresIn: refreshBundle.expiresIn,
        remember: !!remember,
      }));
    },

    rotateRefreshToken(args) {
      return rotateRefreshToken({
        ...args,
        queryImpl,
        jwtLib,
        envConfig,
      });
    },

    revokeRefreshTokenById(tokenId) {
      return revokeRefreshTokenById(tokenId, { queryImpl });
    },

    findRefreshTokenRecord(token) {
      return findRefreshTokenRecord(token, { queryImpl, envConfig });
    },

    hashToken,
    calculateExpiresAt,
    getAccessTokenExpiresIn,
    getRefreshTokenExpiresIn,
  };
}

module.exports = {
  createAuthTokenService,
  hashToken,
  calculateExpiresAt,
  getAccessTokenExpiresIn,
  getRefreshTokenExpiresIn,
};