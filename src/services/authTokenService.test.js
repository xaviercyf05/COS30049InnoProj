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
      if (normalizedSql.includes('WHERE UserID = ?')) {
        const [userId] = params;
        let affectedRows = 0;

        for (const row of rows) {
          if (row.UserID === userId && row.RevokedAt === null) {
            row.RevokedAt = new Date();
            affectedRows += 1;
          }
        }

        return [{ affectedRows }];
      }

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

test('helper methods expose the configured token timings and record lookups', async () => {
  const fakeDb = createFakeQuery();
  const service = createAuthTokenService({
    queryImpl: fakeDb.queryImpl,
    envConfig,
    jwtLib: jwt,
  });

  assert.equal(service.hashToken('abc'), hashToken('abc'));
  assert.equal(service.calculateExpiresAt('15m', new Date('2026-01-01T00:00:00.000Z')).toISOString(), '2026-01-01T00:15:00.000Z');
  assert.equal(service.getAccessTokenExpiresIn(envConfig), '15m');
  assert.equal(service.getRefreshTokenExpiresIn(true, envConfig), '7d');
  assert.equal(service.getRefreshTokenExpiresIn(false, envConfig), '12h');

  const pair = await service.issueTokenPair({
    user: { UserID: 1003, Username: 'guide03', RoleTitle: 'User' },
    remember: false,
  });

  const record = await service.findRefreshTokenRecord(pair.refreshToken);

  assert.equal(record.UserID, 1003);
  assert.equal(record.TokenHash, hashToken(pair.refreshToken));

  await service.revokeRefreshTokensForUser(1003);
  assert.equal(fakeDb.rows.every((row) => row.UserID !== 1003 || row.RevokedAt instanceof Date), true);
});

test('rotateRefreshToken rejects invalid or stale refresh tokens', async () => {
  const fakeDb = createFakeQuery();
  const service = createAuthTokenService({
    queryImpl: fakeDb.queryImpl,
    envConfig,
    jwtLib: jwt,
  });

  await assert.rejects(
    () => service.rotateRefreshToken({ refreshToken: 'definitely-not-a-token' }),
    (error) => error.statusCode === 401 && error.message === 'Invalid or expired refresh token.'
  );

  const tokenPair = await service.issueTokenPair({
    user: { UserID: 1004, Username: 'guide04', RoleTitle: 'User' },
    remember: false,
  });

  await assert.rejects(
    () => service.rotateRefreshToken({ refreshToken: tokenPair.accessToken }),
    (error) => error.statusCode === 401 && error.message === 'Invalid refresh token.'
  );

  fakeDb.rows[0].RevokedAt = new Date();
  await assert.rejects(
    () => service.rotateRefreshToken({ refreshToken: tokenPair.refreshToken }),
    (error) => error.statusCode === 401 && error.message === 'Refresh token already used or revoked.'
  );

  const expiredPair = await service.issueTokenPair({
    user: { UserID: 1005, Username: 'guide05', RoleTitle: 'User' },
    remember: false,
  });
  fakeDb.rows[1].ExpiresAt = new Date(Date.now() - 1000);

  await assert.rejects(
    () => service.rotateRefreshToken({ refreshToken: expiredPair.refreshToken }),
    (error) => error.statusCode === 401 && error.message === 'Refresh token expired.'
  );

  const orphanRefreshToken = jwt.sign(
    {
      sub: 9999,
      username: 'ghost',
      role: 'User',
      remember: false,
      tokenType: 'refresh',
      tokenFamily: 'orphan-family',
    },
    envConfig.jwtSecret,
    {
      expiresIn: '15m',
      jwtid: 'orphan-jti',
    }
  );

  await assert.rejects(
    () => service.rotateRefreshToken({ refreshToken: orphanRefreshToken }),
    (error) => error.statusCode === 401 && error.message === 'Refresh token not recognized.'
  );
});