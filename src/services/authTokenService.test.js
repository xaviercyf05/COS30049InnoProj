const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createAuthTokenService, hashToken } = require('./authTokenService');

function createFakeQuery() {
  const rows = [];
  let nextId = 1;

  const queryImpl = async (sql, params = []) => {
    const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();

    if (normalizedSql.startsWith('INSERT INTO RefreshTokens')) {
      const [userId, tokenJti, tokenFamily, tokenHash, isRemember, expiresAt, userAgent, ipAddress] = params;
      const row = {
        TokenID: nextId++,
        UserID: userId,
        TokenJti: tokenJti,
        TokenFamily: tokenFamily,
        TokenHash: tokenHash,
        IsRemember: isRemember,
        ExpiresAt: expiresAt,
        RevokedAt: null,
        ReplacedByTokenID: null,
        UserAgent: userAgent,
        IpAddress: ipAddress,
        CreatedAt: new Date(),
        LastUsedAt: new Date(),
      };

      rows.push(row);
      return [{ insertId: row.TokenID }];
    }

    if (normalizedSql.includes('WHERE TokenHash = ?')) {
      const tokenHash = params[0];
      return [rows.filter((row) => row.TokenHash === tokenHash)];
    }

    if (normalizedSql.startsWith('UPDATE RefreshTokens') && normalizedSql.includes('ReplacedByTokenID')) {
      const [replacedByTokenID, tokenID] = params;
      const row = rows.find((item) => item.TokenID === tokenID);
      if (row) {
        row.RevokedAt = row.RevokedAt || new Date();
        row.ReplacedByTokenID = replacedByTokenID;
      }
      return [{ affectedRows: row ? 1 : 0 }];
    }

    if (normalizedSql.startsWith('UPDATE RefreshTokens') && normalizedSql.includes('COALESCE(RevokedAt, NOW())')) {
      const tokenID = params[0];
      const row = rows.find((item) => item.TokenID === tokenID);
      if (row) {
        row.RevokedAt = row.RevokedAt || new Date();
      }
      return [{ affectedRows: row ? 1 : 0 }];
    }

    throw new Error(`Unhandled SQL in test fake: ${normalizedSql}`);
  };

  return { queryImpl, rows };
}

const envConfig = {
  jwtSecret: 'unit-test-secret',
  jwtExpiresIn: '15m',
  jwtRememberExpiresIn: '7d',
  jwtSessionRefreshExpiresIn: '12h',
};

test('issueTokenPair stores a hashed refresh token and returns both tokens', async () => {
  const fakeDb = createFakeQuery();
  const service = createAuthTokenService({
    queryImpl: fakeDb.queryImpl,
    envConfig,
    jwtLib: jwt,
  });

  const pair = await service.issueTokenPair({
    user: { UserID: 1001, Username: 'guide01', RoleTitle: 'User' },
    remember: true,
    userAgent: 'UnitTest/1.0',
    ipAddress: '127.0.0.1',
  });

  assert.equal(typeof pair.accessToken, 'string');
  assert.equal(typeof pair.refreshToken, 'string');

  const accessPayload = jwt.verify(pair.accessToken, envConfig.jwtSecret);
  const refreshPayload = jwt.verify(pair.refreshToken, envConfig.jwtSecret);

  assert.equal(accessPayload.tokenType, 'access');
  assert.equal(accessPayload.remember, true);
  assert.equal(refreshPayload.tokenType, 'refresh');
  assert.equal(refreshPayload.remember, true);
  assert.equal(fakeDb.rows.length, 1);
  assert.equal(fakeDb.rows[0].TokenHash, hashToken(pair.refreshToken));
  assert.equal(fakeDb.rows[0].IsRemember, 1);
});

test('rotateRefreshToken revokes the old token and issues a new pair', async () => {
  const fakeDb = createFakeQuery();
  const service = createAuthTokenService({
    queryImpl: fakeDb.queryImpl,
    envConfig,
    jwtLib: jwt,
  });

  const initialPair = await service.issueTokenPair({
    user: { UserID: 1002, Username: 'guide02', RoleTitle: 'User' },
    remember: false,
  });

  const rotated = await service.rotateRefreshToken({
    refreshToken: initialPair.refreshToken,
    userAgent: 'UnitTest/1.0',
    ipAddress: '127.0.0.1',
  });

  assert.notEqual(rotated.refreshToken, initialPair.refreshToken);
  assert.notEqual(rotated.accessToken, initialPair.accessToken);

  const originalRow = fakeDb.rows.find((row) => row.TokenHash === hashToken(initialPair.refreshToken));
  const rotatedRow = fakeDb.rows.find((row) => row.TokenHash === hashToken(rotated.refreshToken));

  assert.ok(originalRow.RevokedAt instanceof Date);
  assert.equal(typeof originalRow.ReplacedByTokenID, 'number');
  assert.ok(rotatedRow);
  assert.equal(rotatedRow.RevokedAt, null);
});