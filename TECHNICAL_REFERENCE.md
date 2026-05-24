# Refresh Token Authentication - Technical Reference

## System Overview

The refresh-token authentication system implements OAuth 2.0-style token rotation with database-backed persistence. This provides:

- **Token Security**: Refresh tokens hashed before storage (SHA256)
- **Token Rotation**: Old tokens revoked, new tokens issued on refresh
- **Token Families**: Detect compromised tokens via chain tracking
- **Selective Persistence**: "Remember me" (7 days) vs. session-only (12 hours)
- **Session Recovery**: Auto-restore on app restart if tokens valid
- **Background Refresh**: Periodic token rotation to minimize exposure window

---

## Token Lifecycle

### 1. Initial Login → Token Pair Issue

```
User Login
    ↓
[userController.loginUser]
    ├─ Validate credentials (username + password hash check)
    ├─ Extract remember flag from request body
    └─ Call authTokenService.issueTokenPair({
        user: { id, username, role, ... },
        remember: true/false,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      })
    ↓
[authTokenService.issueTokenPair]
    ├─ Generate TokenFamily ID (random jti)
    ├─ Sign Access Token (JWT, claims: { type: 'access', ... }, expires 12h)
    ├─ Sign Refresh Token (JWT, claims: { type: 'refresh', family: TokenFamily, ... }, expires 7d or 12h)
    ├─ Hash refresh token: SHA256(refreshToken)
    ├─ Insert to RefreshTokens:
    │   TokenID: auto-increment
    │   UserID: user.id
    │   TokenJti: extracted from JWT
    │   TokenFamily: family ID
    │   TokenHash: SHA256 hash
    │   IsRemember: remember flag
    │   ExpiresAt: calculated from JWT exp claim
    │   RevokedAt: NULL
    │   ReplacedByTokenID: NULL
    └─ Return { accessToken, refreshToken, expiresIn, refreshTokenExpiresIn }
    ↓
Response to Frontend
    └─ Frontend stores both tokens via authSession.persistAuthSession()
```

### 2. Token Usage → API Requests

```
[Frontend Auth Request]
    ├─ Retrieve accessToken from AsyncStorage
    ├─ Add to Authorization header: "Bearer <accessToken>"
    └─ Send POST /api/v1/resource

[Backend Middleware - auth.js]
    ├─ Extract token from Authorization header
    ├─ Verify JWT signature (if invalid → 401)
    ├─ Extract claims (userId, type, family)
    └─ Attach to req.user, proceed to controller

[Controller/Service Logic]
    └─ Process request with authenticated user context
```

### 3. Token Expiration → Refresh Flow

**Scenario A: Access token expired, refresh token valid**

```
[Frontend - API Request]
    ├─ Request with expired accessToken
    ├─ Backend returns 401 (token expired)
    └─ Client-side error handler triggers refresh

[authSession.refreshAuthSession(refreshToken)]
    ├─ Call POST /api/v1/auth/refresh with body { refreshToken }
    └─ Receive new { accessToken, refreshToken }

[userController.refreshToken]
    ├─ Validate incoming refreshToken present
    ├─ Call authTokenService.rotateRefreshToken(refreshToken)
    └─ Return new token pair or 401 if invalid

[authTokenService.rotateRefreshToken]
    ├─ Verify JWT signature of incoming token
    ├─ Extract TokenFamily from JWT claims
    ├─ Query DB: SELECT * FROM RefreshTokens WHERE TokenHash = SHA256(token)
    ├─ Checks:
    │   ├─ Token exists (if not → 401)
    │   ├─ Not revoked: RevokedAt IS NULL (if revoked → 401)
    │   ├─ Not expired: ExpiresAt > NOW() (if expired → 401)
    │   └─ Tokens from same family (if mismatch → 401, security incident)
    ├─ Update old token: SET RevokedAt = NOW(), ReplacedByTokenID = <new_id>
    ├─ Issue new pair (same logic as issueTokenPair)
    └─ Return new { accessToken, refreshToken }

[Frontend Session Update]
    ├─ Call authSession.persistAuthSession(newAccessToken, newRefreshToken)
    ├─ Tokens updated in AsyncStorage
    └─ Retry original request with new accessToken
```

**Scenario B: Both tokens expired**

```
[Frontend - LoadingScreen.js on App Startup]
    ├─ Retrieve stored tokens via authSession.getStoredAuthSession()
    ├─ Try to use accessToken
    ├─ If token expired AND stayLoggedIn === false
    │   └─ Clear all tokens, redirect to Login
    ├─ If token expired AND stayLoggedIn === true
    │   ├─ Try refreshAuthSession(refreshToken)
    │   └─ If refresh fails (7 days passed)
    │       └─ Clear all tokens, redirect to Login
    └─ If token valid, redirect to Home
```

### 4. Background Token Rotation (Remember Me Users)

```
[App.js - HomeScreen mounts usePeriodicTokenRefresh hook]
    ├─ Run every 4 hours (if stayLoggedIn === true)
    └─ Call refreshAuthSession() proactively
        ├─ Backend issues new pair (old token revoked)
        ├─ Frontend persists new tokens
        ├─ User never loses session, always has fresh token
        └─ Continue loop

Effect:
    Before token expires (7 days), at least one refresh occurs every 4 hours
    Maximum gap between refreshes: 4 hours
    User stays authenticated without requiring login
```

### 5. Logout → Token Revocation

```
[User Logout Action]
    ├─ Frontend calls authSession.clearAuthSession()
    │   └─ Delete all tokens from AsyncStorage
    ├─ Frontend calls logout endpoint (optional but recommended)
    │   └─ POST /api/v1/auth/logout with refreshToken in body
    └─ Redirect to Login

[Backend - Optional Logout Endpoint]
    ├─ Receive refreshToken
    ├─ Hash token: SHA256(token)
    ├─ UPDATE RefreshTokens SET RevokedAt = NOW() WHERE TokenHash = hash
    └─ Response: 200 OK (logout acknowledged)
    
Note: Even if logout endpoint not called, tokens can't be reused:
    - AccessToken inherently expires after 12h
    - RefreshToken only usable if DB record not revoked
    - Session-only tokens expire after 12h
```

---

## Database Schema

### RefreshTokens Table

```sql
CREATE TABLE RefreshTokens (
  TokenID INT PRIMARY KEY AUTO_INCREMENT,
  UserID INT NOT NULL,
  TokenJti VARCHAR(255) NOT NULL UNIQUE,
  TokenFamily VARCHAR(255) NOT NULL,
  TokenHash CHAR(64) NOT NULL UNIQUE,
  IsRemember BOOLEAN DEFAULT FALSE,
  ExpiresAt DATETIME NOT NULL,
  RevokedAt DATETIME,
  ReplacedByTokenID INT,
  UserAgent VARCHAR(500),
  IpAddress VARCHAR(45),
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  LastUsedAt DATETIME,
  
  FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
  FOREIGN KEY (ReplacedByTokenID) REFERENCES RefreshTokens(TokenID),
  INDEX idx_user_family (UserID, TokenFamily),
  INDEX idx_expires_at (ExpiresAt),
  INDEX idx_revoked_at (RevokedAt)
);
```

### Key Fields Explained

| Field | Type | Purpose |
|-------|------|---------|
| `TokenID` | INT, PK | Unique identifier for this token record |
| `UserID` | INT, FK | Foreign key to Users table (cascading delete) |
| `TokenJti` | VARCHAR(255) | JWT's unique claim ID (issued-at timestamp + random) |
| `TokenFamily` | VARCHAR(255) | Shared ID for all tokens in a rotation chain |
| `TokenHash` | CHAR(64) | SHA256 hash of refresh token (never store plaintext) |
| `IsRemember` | BOOLEAN | FALSE = session-only (12h), TRUE = persistent (7d) |
| `ExpiresAt` | DATETIME | Token expiry timestamp (from JWT exp claim) |
| `RevokedAt` | DATETIME | When token was revoked (NULL = active) |
| `ReplacedByTokenID` | INT, FK | Points to replacement token after rotation |
| `UserAgent` | VARCHAR(500) | Device identifier (for audit trail) |
| `IpAddress` | VARCHAR(45) | Request origin (IPv4 or IPv6, for audit) |
| `CreatedAt` | DATETIME | Token issue timestamp |
| `LastUsedAt` | DATETIME | Most recent refresh attempt (optional) |

### Example: Token Rotation Chain

```
User logs in with "Remember me"
    ↓
TokenID=1, UserID=5, TokenFamily=ABC123, TokenHash=hash1
ExpiresAt=2024-12-25 12:00:00, RevokedAt=NULL, ReplacedByTokenID=NULL
    ↓
[4 hours later, background refresh triggers]
    ↓
Token1 revoked:
  UPDATE RefreshTokens SET RevokedAt=2024-12-21 16:00:00, 
                           ReplacedByTokenID=2 WHERE TokenID=1
    ↓
New token issued:
  TokenID=2, UserID=5, TokenFamily=ABC123, TokenHash=hash2
  ExpiresAt=2024-12-25 20:00:00, RevokedAt=NULL, ReplacedByTokenID=NULL
    ↓
[Same TokenFamily ABC123, but different TokenHash and ExpiresAt]
```

---

## API Endpoints

### POST /api/v1/auth/login

**Request:**
```json
{
  "username": "alice@example.com",
  "password": "SecurePassword123",
  "remember": true
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 43200,
  "refreshTokenExpiresIn": 604800,
  "user": {
    "id": 5,
    "username": "alice@example.com",
    "role": "user"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "message": "Invalid username or password"
}
```

### POST /api/v1/auth/refresh

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 43200,
  "refreshTokenExpiresIn": 604800
}
```

**Response (401 Unauthorized):**
```json
{
  "message": "Invalid, expired, or revoked refresh token"
}
```

---

## Frontend Implementation

### authSession.js - Session Helper

**Four main functions:**

1. **persistAuthSession(data)** - Store tokens to AsyncStorage
   ```javascript
   await authSession.persistAuthSession({
     accessToken: "eyJhbGc...",
     refreshToken: "eyJhbGc...",
     role: "user",
     username: "alice@example.com",
     userId: 5,
     stayLoggedIn: true
   });
   ```

2. **getStoredAuthSession()** - Retrieve all tokens
   ```javascript
   const session = await authSession.getStoredAuthSession();
   console.log(session);
   // { 
   //   accessToken: "...", refreshToken: "...", 
   //   role: "user", username: "alice@example.com", userId: 5, 
   //   stayLoggedIn: true 
   // }
   ```

3. **clearAuthSession()** - Delete all tokens (logout)
   ```javascript
   await authSession.clearAuthSession();
   ```

4. **refreshAuthSession(refreshToken)** - Rotate tokens
   ```javascript
   const newSession = await authSession.refreshAuthSession(oldRefreshToken);
   // Returns same structure as getStoredAuthSession()
   ```

### Integration Points

**LoginPage.js:**
- User checks "Keep me signed in" checkbox
- Login handler calls `persistAuthSession()` with `stayLoggedIn: true/false`

**LoadingScreen.js:**
- On app startup, retrieves session via `getStoredAuthSession()`
- If token expired but `stayLoggedIn: true`, calls `refreshAuthSession()`
- If `stayLoggedIn: false`, clears session and shows login

**App.js:**
- `usePeriodicTokenRefresh()` hook runs every 4 hours
- Calls `refreshAuthSession()` to proactively rotate tokens
- Only runs if `stayLoggedIn === true`

---

## Security Considerations

### ✅ Implemented Protections

1. **Token Hashing**: Refresh tokens stored as SHA256 hashes (never plaintext)
2. **Token Rotation**: Old tokens revoked on refresh, new tokens issued
3. **Token Families**: Family ID tracks lineage; mismatched family = security incident
4. **Token Expiration**: Access tokens expire after 12h, refresh tokens after 7d (max)
5. **Database Revocation**: Revoked tokens cannot be reused even if JWT signature valid
6. **HTTPS Enforcement**: Use HTTPS only in production (tokens never over HTTP)

### ⚠️ Known Limitations

1. **Token Family Pruning**: Old revoked tokens remain in DB indefinitely (implement cleanup job for >30 days old)
2. **No Device Fingerprinting**: Refresh tokens don't validate UserAgent/IP on each use (optional enhancement)
3. **No Max Rotations**: Token families can rotate unlimited times (consider max 10 rotations per family)
4. **XSS Vulnerability**: AsyncStorage vulnerable to XSS attacks (client-side only, not HTTPOnly cookies)

### 🛡️ Production Hardening Checklist

- [ ] Change `JWT_SECRET` to strong random value (256-bit)
- [ ] Set `JWT_EXPIRES_IN=12h` (do not increase)
- [ ] Set `JWT_REMEMBER_EXPIRES_IN=7d` (recommended max)
- [ ] Enable HTTPS for all token endpoints
- [ ] Implement cleanup job: delete tokens where `ExpiresAt < NOW() - INTERVAL 30 DAY`
- [ ] Monitor revocation spike alerts (>100 tokens/hour = possible compromise)
- [ ] Audit token rotation chains for unusual patterns (>20 rotations per user/day)
- [ ] Log all refresh attempts with UserAgent and IpAddress
- [ ] Implement rate limiting on `/auth/refresh` endpoint

---

## Testing

### Unit Tests (npm test)

**File:** [src/services/authTokenService.test.js](src/services/authTokenService.test.js)

**Test 1: issueTokenPair**
- Verifies token pair creation
- Validates refresh token hashed before DB storage
- Confirms both tokens returned

**Test 2: rotateRefreshToken**
- Verifies old token marked revoked (`RevokedAt` set)
- Validates old token linked to new via `ReplacedByTokenID`
- Confirms new token pair issued
- Ensures same `TokenFamily` maintained

**Run tests:**
```bash
npm test
```

**Expected output:**
```
✔ issueTokenPair stores a hashed refresh token and returns both tokens
✔ rotateRefreshToken revokes the old token and issues a new pair
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

### Manual Testing Scenarios

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for 8 comprehensive test scenarios including:
1. Login without remember-me
2. Login with remember-me
3. App restart (session-only)
4. App restart (remember-me within expiry)
5. Token refresh after access token expiry
6. Database persistence verification
7. Token rotation chain tracking
8. Logout revocation

---

## Performance Metrics

### Token Service Performance

**issueTokenPair():**
- JWT signing: ~1-2ms
- Token hashing: ~1-2ms
- DB insert: ~5-10ms
- **Total: ~8-15ms**

**rotateRefreshToken():**
- JWT verification: ~1-2ms
- DB query (TokenHash lookup): ~1-3ms (with index)
- DB update (revoke old): ~2-5ms
- DB insert (new token): ~5-10ms
- **Total: ~10-20ms**

### Database Query Performance

With proper indexes:
- `(UserID, TokenFamily)` lookup: <1ms
- `(ExpiresAt)` cleanup query: <100ms for 1M rows
- `(RevokedAt)` revocation queries: <10ms

---

## Troubleshooting

### "RefreshToken endpoint returns 404"
**Cause:** Backend not restarted  
**Solution:** Run `npm start`, verify authRoutes.js loaded

### "Tokens not persisting between app restarts"
**Cause:** AsyncStorage cleared or authSession import missing  
**Solution:** Check `authSession.persistAuthSession()` called in LoginPage, verify AsyncStorage not cleared by device settings

### "Access token expired, refresh fails"
**Cause:** Refresh token expired (7d passed) or revoked  
**Solution:** User must login again; check RefreshTokens table for `ExpiresAt` and `RevokedAt` values

### "Background refresh loop not triggering"
**Cause:** Hook not mounted or `stayLoggedIn` not set  
**Solution:** Verify `usePeriodicTokenRefresh()` in HomeScreen, check AsyncStorage has `stayLoggedIn: true`

---

## Additional Resources

- **Token Rotation Pattern:** [OAuth 2.0 Refresh Token Rotation](https://tools.ietf.org/html/draft-ietf-oauth-security-best-practices#section-3.13)
- **JWT Standard:** [RFC 7519](https://tools.ietf.org/html/rfc7519)
- **Token Family Detection:** [Token Binding for HTTP](https://tools.ietf.org/html/rfc8471)

