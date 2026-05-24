# Email Verification System for Registration Approval

## Overview

This document describes the implemented email verification system that automatically sends verification emails to users after their registration has been approved by an admin. Users must click the verification link in the email to activate their account before they can log in.

## Feature Flow

1. **User submits registration** → Registration request is stored as "Pending"
2. **Admin approves registration** → User account is created in "Inactive" status, verification email is sent
3. **User receives email** → Email contains a clickable verification link that expires in 7 days
4. **User clicks link** → Account is activated and user can log in
5. **User attempts login** → If account is active, login succeeds

## Database Changes

### New Table: EmailVerificationTokens

A new table has been added to store email verification tokens:

```sql
CREATE TABLE EmailVerificationTokens (
  TokenID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserID INT UNSIGNED NOT NULL,
  Token VARCHAR(255) NOT NULL UNIQUE,
  TokenType VARCHAR(50) NOT NULL,
  ExpiresAt TIMESTAMP NOT NULL,
  CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_verification_tokens_user FOREIGN KEY (UserID) REFERENCES Users (UserID) ON DELETE CASCADE,
  CONSTRAINT chk_email_verification_token_type CHECK (TokenType IN ('account_activation', 'password_reset'))
);
```

**Run the database migration:**
```bash
mysql -h 127.0.0.1 -u innogroup -p cos30049fr < database/schema.sql
```

Or execute the schema update manually if the table doesn't exist yet.

## Installation & Setup

### 1. Install Dependencies

nodemailer has already been added to package.json. Run:

```bash
npm install
```

### 2. Configure Email Environment Variables

The following environment variables are already configured in your `.env` file:

```env
EMAIL_HOST=sfcadmin.noreply@gmail.com
EMAIL_APP_PASSWORD=nuwk xtwz vtim bvhq
```

**Important:** These are Gmail SMTP credentials. Make sure your Gmail account has:
- 2-Factor Authentication enabled
- An "App Password" generated (used in EMAIL_APP_PASSWORD, not your regular password)

If your hosting provider blocks Gmail SMTP on the default port, you can override the transport with these optional variables:

```env
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=465
EMAIL_SMTP_SECURE=true
EMAIL_CONNECTION_TIMEOUT_MS=30000
EMAIL_GREETING_TIMEOUT_MS=30000
EMAIL_SOCKET_TIMEOUT_MS=30000
```

`EMAIL_HOST` remains the sender account address for backward compatibility.

### 3. Optional: Configure API Base URL

Add to `.env` if you want to customize the verification link base URL (defaults to first CORS_ORIGIN):

```env
API_BASE_URL=https://innopappserver.xyz
```

## Files Created/Modified

### New Files
- `/src/services/emailService.js` - Email sending service with HTML templates
- `/src/services/emailVerificationService.js` - Token generation, verification, and database operations

### Modified Files
- `/database/schema.sql` - Added EmailVerificationTokens table
- `/src/controllers/registrationController.js` - Updated approval logic to create inactive users and send emails
- `/src/controllers/userController.js` - Added verifyEmailAndActivateAccount endpoint
- `/src/routes/v1/authRoutes.js` - Added verify-email route
- `package.json` - Added nodemailer dependency

## API Endpoints

### Email Verification Endpoint

**GET** `/api/v1/auth/verify-email`

**Query Parameters:**
- `token` (required) - The verification token from the email link

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Email verified successfully! Your account is now active. You can now log in.",
  "data": {
    "userId": 10000001,
    "username": "johnparkguide",
    "email": "john@example.com",
    "fullName": "John Park Guide",
    "isActive": true,
    "status": "Active"
  }
}
```

**Response (Error - Invalid Token):**
```json
{
  "success": false,
  "message": "Invalid or expired verification token. Please request a new one."
}
```

### Registration Approval Response (Admin Endpoint)

When admin approves a registration, the response now includes email status:

**POST** `/api/v1/admin/registration/:registrationId/status`

**Response:**
```json
{
  "success": true,
  "message": "Registration request approved successfully.",
  "data": {
    "registrationId": 1,
    "status": "approved",
    "createdUserId": 10000001,
    "emailSent": true,
    "emailStatus": "Verification email sent successfully. User must verify email to activate account."
  }
}
```

## Testing

### Test Email Configuration

Test the email service directly in Node.js REPL:

```javascript
const emailService = require('./src/services/emailService');

// Test email connection
await emailService.testEmailConnection();
```

### Manual Testing Flow

1. **Submit a registration request** (as a user):
   ```bash
   curl -X POST http://localhost:3000/api/v1/public/register \
     -F "username=testguide" \
     -F "password=TestPass123" \
     -F "fullName=Test Guide" \
     -F "phoneNumber=012-3456789" \
     -F "email=test@example.com" \
     -F "resume=@resume.pdf"
   ```

2. **Approve the registration** (as admin):
   ```bash
   curl -X POST http://localhost:3000/api/v1/admin/registration/1/status \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <admin_token>" \
     -d '{"status": "approved"}'
   ```

3. **Check email** - Look for verification email (check spam folder)

4. **Verify email** - Click the link or manually call:
   ```bash
   curl "http://localhost:3000/api/v1/auth/verify-email?token=<token_from_email>"
   ```

5. **Login** - Now user should be able to log in:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "testguide", "password": "TestPass123"}'
   ```

## User Account States

### During Workflow

1. **After Approval (Before Email Verification)**
   - `IsActive` = 0
   - `Status` = "Inactive"
   - User cannot login
   - Verification email is sent

2. **After Email Verification**
   - `IsActive` = 1
   - `Status` = "Active"
   - User can now login
   - Verification token is deleted

### Database Queries

**Check user activation status:**
```sql
SELECT UserID, Username, Email, IsActive, Status 
FROM Users 
WHERE Username = 'johnparkguide';
```

**View verification tokens:**
```sql
SELECT TokenID, UserID, TokenType, ExpiresAt, CreatedAt
FROM EmailVerificationTokens
WHERE UserID = 10000001;
```

**Check expired tokens:**
```sql
SELECT * FROM EmailVerificationTokens 
WHERE ExpiresAt < NOW();
```

## Email Template

The verification email includes:
- Professional HTML design with Sarawak branding
- Large call-to-action button ("Activate Account")
- Direct link to verification endpoint
- 7-day expiration notice
- Plain text fallback for email clients without HTML support
- Requirements checklist
- Next steps guidance

**Design Colors:**
- Primary: #2E6B4D (Sarawak Green)
- Accent: #ECF2E5 (Light Green)
- Text: #445A4D (Dark Gray)

## Production Deployment (Cloudflared Tunnel)

Since your server runs on Raspberry Pi with Cloudflared tunnel:

1. **Verification links will use:** `https://innopappserver.xyz/api/v1/auth/verify-email?token=...`

2. **Ensure your `.env` includes:**
   ```env
   CORS_ORIGIN=https://innopappserver.xyz
   API_BASE_URL=https://innopappserver.xyz
   ```

3. **Test the full URL flow:**
   - Email will contain: `https://innopappserver.xyz/api/v1/auth/verify-email?token=...`
   - Tunnel will route request to your local API
   - Verification will work correctly

## Security Considerations

### Token Security
- Tokens are 64-character random hexadecimal strings (256-bit entropy)
- Tokens are stored hashed in database
- Each approval generates a new token
- Old tokens for the same user are automatically deleted

### Email Configuration
- Never hardcode credentials - use environment variables
- Gmail App Passwords are safer than account passwords
- Email is only sent after successful database transaction

### Account Security
- Accounts remain inactive until verified
- No login is possible without activation
- Password is already hashed during registration request

### Token Expiration
- Tokens expire after 7 days (configurable in emailVerificationService.js)
- Expired tokens are automatically deleted
- Optional: Run cleanup job periodically

```javascript
// Optional: Add periodic cleanup (e.g., daily)
const emailVerificationService = require('./src/services/emailVerificationService');
setInterval(async () => {
  await emailVerificationService.cleanupExpiredTokens();
}, 24 * 60 * 60 * 1000); // Every 24 hours
```

## Error Handling

### Common Issues

**Email not sending?**
- Check Gmail credentials in `.env`
- Verify Gmail account has 2FA enabled and App Password configured
- Check server logs: `console.error()` messages
- Test with `emailService.testEmailConnection()`

**Token not found after verification?**
- Token may have expired (7 days)
- Token may have already been used
- Check database for token record

**User can't login after verification?**
- Verify `IsActive` = 1 in database
- Verify `Status` = "Active" in database
- Check JWT token generation

**CORS errors on verification?**
- Ensure frontend domain is in `CORS_ORIGIN`
- Verify API base URL is correct

## Future Enhancements

Potential improvements for the system:

1. **Resend Email Functionality**
   - Allow users to request new verification email
   - Endpoint: `POST /api/v1/auth/resend-verification`

2. **Email Templates Customization**
   - Store templates in database
   - Allow admins to customize email content

3. **Different Token Types**
   - `password_reset` - For forgot password functionality
   - `email_change` - For email update verification

4. **Activity Logging**
   - Log email sends in audit table
   - Track verification attempts

5. **SMS Verification** (Alternative)
   - Two-factor verification option
   - SMS gateway integration

## Support & Troubleshooting

### Check Email Service Status
```bash
# Verify service can send emails
node -e "require('./src/services/emailService').testEmailConnection()"
```

### View Recent Tokens
```bash
# Check if tokens are being created
mysql -u innogroup -p -e "SELECT * FROM appdb.EmailVerificationTokens LIMIT 10;"
```

### Clear Expired Tokens
```bash
# Manual cleanup
mysql -u innogroup -p -e "DELETE FROM appdb.EmailVerificationTokens WHERE ExpiresAt < NOW();"
```

## Contact & Support

For issues or questions about this feature:
1. Check the error logs in server console
2. Verify database tables exist with `SHOW TABLES;`
3. Test email configuration independently
4. Review this documentation thoroughly

---

**Last Updated:** May 4, 2026
**Version:** 1.0.0
