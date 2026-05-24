# Multi-Factor Authentication (MFA) Implementation Guide

This guide documents the complete implementation of Multi-Factor Authentication (MFA) for your application.

## Overview

The MFA feature allows users to enable two-factor authentication using Time-based One-Time Password (TOTP) with recovery codes as a backup method.

## Architecture

### Technology Stack
- **TOTP Generation**: `speakeasy` - Industry-standard TOTP implementation
- **QR Code Generation**: `qrcode` - For easy setup with authenticator apps
- **Authenticator Apps Supported**: Google Authenticator, Authy, Microsoft Authenticator, 2FAS, etc.

## Database Schema

### New Tables/Columns Added

#### Users Table Additions
```sql
-- MFA columns added to Users table
ALTER TABLE Users ADD COLUMN MFAEnabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE Users ADD COLUMN MFASecret VARCHAR(255) NULL;
ALTER TABLE Users ADD COLUMN MFAMethod VARCHAR(50) DEFAULT 'TOTP';
ALTER TABLE Users ADD COLUMN BackupCodes JSON NULL;
ALTER TABLE Users ADD COLUMN MFASetupAt TIMESTAMP NULL;
```

#### New Tables
- **MFARecoveryCodes**: Stores individual recovery codes for audit tracking
- **MFAAudit**: Logs all MFA-related activities for security audit

To apply the schema:
```bash
mysql -u <user> -p <database> < database/migration_mfa.sql
```

## Backend Implementation

### 1. MFA Service (`src/services/mfaService.js`)
Handles all TOTP and recovery code operations:
- `generateMFASetup()` - Generate new secret and QR code
- `verifyToken()` - Verify TOTP token
- `generateRecoveryCodes()` - Generate recovery codes
- `enableMFAForUser()` - Enable MFA for a user
- `disableMFAForUser()` - Disable MFA for a user
- `getMFAStatus()` - Get user's MFA status
- `verifyRecoveryCode()` - Verify and use recovery codes
- `logMFAAudit()` - Log MFA events

### 2. MFA Controller (`src/controllers/mfaController.js`)
API endpoints:
- `initiateMFASetup()` - Start MFA setup (returns QR code + recovery codes)
- `confirmMFASetup()` - Confirm with verification token
- `disableMFA()` - Disable MFA (requires password)
- `getMFAStatus()` - Get current status
- `verifyMFAToken()` - Verify during login
- `regenerateRecoveryCodes()` - Generate new recovery codes

### 3. Updated Login Flow (`src/controllers/userController.js`)
- After password verification, checks if MFA is enabled
- If MFA enabled: returns temporary MFA token (10-minute expiry)
- Frontend then sends MFA verification to `/auth/mfa/verify-token`
- After verification, sends temporary token to `/auth/mfa/complete-login` for final tokens

## API Endpoints

### Public Endpoints (No Authentication Required)

#### 1. **Login with MFA**
```
POST /api/v1/auth/login
Body: {
  identifier: "username or userId",
  password: "password",
  remember: true/false
}

Response (MFA Required):
{
  success: true,
  mfaRequired: true,
  data: {
    tempToken: "jwt_token",
    userId: 123,
    user: { userId, username, role },
    message: "MFA verification required..."
  }
}
```

#### 2. **Verify MFA Token**
```
POST /api/v1/auth/mfa/verify-token
Body: {
  userId: 123,
  token: "123456"  // OR
  recoveryCode: "XXXX-XXXX"
}

Response:
{
  success: true,
  message: "MFA verification successful",
  data: { verified: true, usedRecoveryCode: false }
}
```

#### 3. **Complete Login After MFA**
```
POST /api/v1/auth/mfa/complete-login
Body: {
  tempToken: "jwt_token",
  remember: true/false
}

Response:
{
  success: true,
  data: {
    token: "access_token",
    refreshToken: "refresh_token",
    expiresIn: 3600,
    user: { userId, username, role }
  }
}
```

### Protected Endpoints (Requires Authorization Header)

#### 1. **Initiate MFA Setup**
```
POST /api/v1/user/mfa/setup/initiate
Header: Authorization: Bearer <token>

Response:
{
  success: true,
  data: {
    secret: "base32_encoded_secret",
    qrCode: "data:image/png;base64,...",
    recoveryCodes: ["XXXX-XXXX", "YYYY-YYYY", ...],
    message: "Scan the QR code..."
  }
}
```

#### 2. **Confirm MFA Setup**
```
POST /api/v1/user/mfa/setup/confirm
Header: Authorization: Bearer <token>
Body: {
  secret: "base32_secret",
  token: "123456",  // 6-digit code
  recoveryCodes: ["XXXX-XXXX", ...]
}

Response:
{
  success: true,
  message: "MFA has been successfully enabled",
  data: { enabled: true, recoveryCodesCount: 10 }
}
```

#### 3. **Get MFA Status**
```
GET /api/v1/user/mfa/status
Header: Authorization: Bearer <token>

Response:
{
  success: true,
  data: {
    enabled: true,
    method: "TOTP",
    setupAt: "2026-05-05T10:30:00Z",
    recoveryCodesRemaining: 8,
    totalRecoveryCodes: 10
  }
}
```

#### 4. **Disable MFA**
```
POST /api/v1/user/mfa/disable
Header: Authorization: Bearer <token>
Body: { password: "user_password" }

Response:
{
  success: true,
  message: "MFA has been disabled for your account"
}
```

#### 5. **Regenerate Recovery Codes**
```
POST /api/v1/user/mfa/recovery-codes/regenerate
Header: Authorization: Bearer <token>
Body: { password: "user_password" }

Response:
{
  success: true,
  message: "Recovery codes have been regenerated",
  data: { recoveryCodes: ["XXXX-XXXX", ...] }
}
```

## Frontend Implementation

### Login Page (`frontend/Login/LoginPage.js`)
Added MFA verification flow:

1. **Initial Login**: User enters username and password
2. **MFA Check**: If MFA enabled, show MFA verification screen
3. **Two Modes**:
   - **TOTP Code**: 6-digit code from authenticator app
   - **Recovery Code**: Backup recovery code (XXXX-XXXX format)
4. **Completion**: After verification, user is logged in

### MFA Settings Component (`frontend/Auth/MFASettings.js`)
Provides user interface to:
- View MFA status
- Enable/disable MFA
- View recovery code status
- Regenerate recovery codes
- Setup QR code scanning

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

This installs `speakeasy` and `qrcode` packages.

### 2. Run Database Migration
```bash
mysql -u <username> -p <database_name> < database/migration_mfa.sql
```

### 3. Restart Backend Server
```bash
npm start
# or for development:
npm run dev
```

## User Workflow

### Enabling MFA

1. User navigates to security settings
2. Clicks "Enable Two-Factor Authentication"
3. System generates QR code and recovery codes
4. User scans QR code with authenticator app
5. User enters 6-digit code to confirm
6. Recovery codes displayed (user should save them)
7. MFA is now enabled

### Logging In with MFA Enabled

1. User enters username and password
2. If correct, system prompts for MFA code
3. User can either:
   - Enter 6-digit code from authenticator app
   - Use recovery code (if lost access to authenticator)
4. After successful MFA verification, user is logged in

### Disabling MFA

1. User navigates to security settings
2. Clicks "Disable Two-Factor Authentication"
3. User confirms by entering password
4. MFA is disabled

### Recovery Codes

- 10 recovery codes generated per MFA setup
- Each code can be used once
- Used for account recovery if authenticator is lost/inaccessible
- Users can regenerate codes anytime (requires password confirmation)

## Security Features

1. **TOTP Window**: Allows 2 time windows (±30 seconds) for clock skew tolerance
2. **Password Requirement**: Disabling MFA and regenerating codes requires password confirmation
3. **Audit Logging**: All MFA events logged in `MFAAudit` table
4. **Recovery Codes**: Single-use codes for account recovery
5. **Temporary Tokens**: Short-lived (10 minutes) tokens for MFA verification
6. **IP/User-Agent Tracking**: Logged for security analysis

## Testing

### Test MFA Setup
```bash
# 1. Login to get token
# 2. Call initiate MFA setup
# 3. Use authenticator app to scan QR code
# 4. Confirm with generated code
```

### Test MFA Login
```bash
# 1. Login with credentials
# 2. Should receive mfaRequired: true
# 3. Verify with TOTP code
# 4. Complete login
```

### Test Recovery Code
```bash
# 1. Save recovery codes
# 2. During login, use recovery code instead of TOTP
# 3. Verify code is marked as used
```

## Troubleshooting

### QR Code Not Scanning
- Ensure authenticator app camera has proper lighting
- Try manually entering the secret key instead
- Check that secret key is displayed correctly

### TOTP Code Always Invalid
- Ensure device clock is synchronized (check NTP sync)
- Verify authenticator app is set to current time
- Check that secret was entered correctly

### Recovery Codes Not Working
- Ensure format is correct (XXXX-XXXX)
- Check that code hasn't been used already
- Verify user still has unused codes

### Lost Access to Authenticator
- User can use recovery codes to regain access
- After logging in with recovery code, user should:
  - Disable current MFA
  - Re-enable MFA with new authenticator app
  - Generate new recovery codes

## Production Deployment Checklist

- [ ] Database migration applied on production
- [ ] Dependencies installed on production server
- [ ] Environment variables configured
- [ ] API endpoints tested with valid tokens
- [ ] MFA audit logging verified
- [ ] Recovery code email notifications (if desired)
- [ ] User documentation updated
- [ ] Support team trained on MFA troubleshooting
- [ ] Monitoring alerts set up for MFA failures

## Future Enhancements

1. **WebAuthn/FIDO2**: Support hardware security keys
2. **SMS/Email Codes**: Alternative to TOTP
3. **Backup MFA**: Multiple MFA methods per user
4. **MFA Enforcement**: Require MFA for admins
5. **MFA Recovery Email**: Send recovery codes via email
6. **Device Fingerprinting**: Remember trusted devices
7. **MFA Bypass Tokens**: For administrative recovery
8. **Analytics Dashboard**: MFA adoption and usage metrics

## Support & Documentation

For more information on TOTP and MFA best practices:
- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238)
- [Speakeasy Documentation](https://github.com/speakeasyjs/speakeasy)
- [NIST Authentication Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
