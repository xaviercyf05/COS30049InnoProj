# Digital Park Guide Training Platform - API Documentation

This document reflects the implemented backend routes in `src/routes`, `feature_modules/rich-content`, and the health routes defined in `src/app.js`.

## Base URLs

Development:
```
http://localhost:3000/api/v1
```

Production:
```
https://api.innopappserver.xyz/api/v1
```

## Authentication

Most protected endpoints require a Bearer token:
```
Authorization: Bearer <token>
```

Admin endpoints require an admin JWT. User endpoints accept user or admin JWTs where the middleware allows it.

## Standard Response Pattern

Most JSON responses use one of these shapes:
```
{ "success": true, "data": ... }
```
```
{ "success": true, "message": "..." }
```
```
{ "success": false, "message": "..." }
```

## Health and Root Routes

### GET `/health`
Checks database connectivity.

### GET `/api/health`
Alias for `/health`.

### GET `/`
Returns the frontend entry page when a build is available, otherwise serves `public/index.html`.

### GET `/icons/:icon`
Serves icon assets from the built frontend or `public/icons` when available.

## Public API

### POST `/public/register`
Submit a registration request with a resume upload.

Multipart form fields:
- `resume` - PDF resume file

## Authentication API

### GET `/auth/login`
Returns `405 Method Not Allowed`. Use `POST /auth/login`.

### POST `/auth/login`
Login with username or user ID.

### POST `/auth/login/methods`
Check which login methods are enabled for an account.

### POST `/auth/login/recovery-code`
Login using an MFA recovery code.

### POST `/auth/passkey/login/options`
Generate passkey authentication options.

### POST `/auth/passkey/login/verify`
Verify a passkey authentication response.

### POST `/auth/login/email-code/request`
Request a passwordless email sign-in code.

### POST `/auth/login/email-code/verify`
Verify a passwordless email sign-in code.

### POST `/auth/forgot-password`
Request a password reset email.

### POST `/auth/refresh`
Refresh a valid JWT token.

### GET `/auth/reset-password`
Render the password reset form.

### POST `/auth/reset-password`
Complete a password reset.

### GET `/auth/verify-email`
Verify email and activate the user account.

### POST `/auth/mfa/verify-token`
Verify an MFA token or recovery code during login.

### POST `/auth/mfa/complete-login`
Complete login after MFA verification.

## User API

All routes in this section require a valid user or admin token.

### GET `/user/profile`
Get the current user profile.

### PUT `/user/profile`
Update the current user profile.

### PUT `/user/profile/image`
Update the current user profile image.

### POST `/user/change-password`
Change the current user password.

### POST `/user/mfa/setup/initiate`
Initiate MFA setup and return setup data.

### POST `/user/mfa/setup/confirm`
Confirm MFA setup with a verification token.

### GET `/user/mfa/status`
Get MFA status for the current user.

### POST `/user/mfa/disable`
Disable MFA for the current user.

### POST `/user/mfa/recovery-codes/regenerate`
Regenerate MFA recovery codes.

### GET `/user/passkeys`
List registered passkeys for the current user.

### POST `/user/passkeys/setup/initiate`
Begin passkey registration.

### POST `/user/passkeys/setup/confirm`
Finish passkey registration.

### DELETE `/user/passkeys/:credentialId`
Remove a registered passkey.

## Qualifications API

### GET `/qualifications`
List all qualifications. Public.

### GET `/qualifications/:qualificationId`
Get qualification details. Public.

### GET `/qualifications/user/my-qualifications`
Get the authenticated user’s enrolled qualifications.

### POST `/qualifications/enroll`
Enroll the authenticated user in a qualification.

### GET `/qualifications/:qualificationId/progress`
Get the authenticated user’s progress in a qualification.

## Modules API

All routes in this section require a valid user or admin token.

### GET `/modules/dashboard`
Get modules and progress summary for dashboard cards.

### GET `/modules/:qualificationId/all`
Get all modules for a qualification.

### GET `/modules/:moduleId/details`
Get module details with learning materials.

### GET `/modules/material/:materialId/content`
Get full learning material content.

### POST `/modules/material/complete`
Mark a learning material as completed.

### GET `/modules/:moduleId/progress`
Get the authenticated user’s progress for a module.

### POST `/modules/:moduleId/progress`
Save the authenticated user’s progress for a module.

### GET `/modules/:moduleId/payment-status`
Get the authenticated user’s payment or evidence status for a module.

## Assessments API

All routes in this section require a valid user or admin token, except the dev-only submission helper.

### GET `/assessments/:moduleId/questions`
Get assessment questions for a module.

### GET `/assessments/:assessmentId`
Get assessment details.

### GET `/assessments/:assessmentId/eligibility`
Check whether the authenticated user can attempt an assessment.

### POST `/assessments/submit-test`
Dev-only helper to simulate an assessment submission without authentication.

### POST `/assessments/submit`
Submit an authenticated assessment attempt.

### GET `/assessments/:moduleId/history`
Get the authenticated user’s assessment attempt history.

## Notifications API

All routes in this section require a valid user or admin token.

### GET `/notifications`
Get the current user’s notifications.

### GET `/notifications/announcements`
Get announcements relevant to the current user’s role.

## Badge API

### GET `/badges`
Get the badge list for the current authenticated user.

## Sensor API

These routes are mounted at `/api/v1/sensors`.

### POST `/sensors/log`
Submit sensor data from a device.

### GET `/sensors/device/:deviceID`
Get the latest sensor data for a device.

### GET `/sensors/stats/:deviceID`
Get sensor statistics for a device.

### GET `/sensors/alerts/:deviceID`
Get sensor alerts for a device.

## Evidence API

These routes are mounted at `/api/v1/evidence`.

### POST `/evidence/log`
Submit an evidence clip from a device.

## Rich Content API

These routes are mounted at `/api/v1/rich-content` and require a valid user or admin token.

### GET `/rich-content`
List rich content entries.

### GET `/rich-content/:contentId`
Get a single rich content entry including attachment URLs.

### POST `/rich-content`
Create a rich content entry with optional file attachments.

Multipart form fields:
- `title` - content title
- `contentHtml` - HTML content
- `files` - up to 10 attachments

## Admin API

All routes in this section require an admin token.

### Qualifications

### POST `/admin/qualifications`
Create a qualification.

### Announcements

### POST `/admin/announcements`
Create an announcement.

### GET `/admin/announcements`
List announcements.

### PUT `/admin/announcements/:announcementId`
Update an announcement.

### DELETE `/admin/announcements/:announcementId`
Delete an announcement.

### Users

### GET `/admin/users`
List users.

### PUT `/admin/users/:userId/status`
Update a user status.

### GET `/admin/users/:userId/enrollments`
Get a user’s enrollment details.

### Evidence and Sensor Alerts

### GET `/admin/evidence`
List evidence alerts.

### GET `/admin/evidence/:evidenceId/video`
Stream an evidence video.

### PUT `/admin/evidence/:evidenceId/status`
Update solved status for an evidence item.

### GET `/admin/esp32sensorlogs`
List ESP32 sensor alerts.

### GET `/admin/esp32-sensor-logs`
Alias for ESP32 sensor alerts.

### GET `/admin/sensor-logs`
Alias for ESP32 sensor alerts.

### POST `/admin/esp32sensorlogs/upload`
Upload ESP32 sensor logs from CSV.

### POST `/admin/esp32-sensor-logs/upload`
Alias for CSV upload.

### POST `/admin/sensor-logs/upload`
Alias for CSV upload.

### PUT `/admin/esp32sensorlogs/:logId/status`
Update solved status for an ESP32 sensor log.

### PUT `/admin/esp32-sensor-logs/:logId/status`
Alias for sensor log status updates.

### PUT `/admin/sensor-logs/:logId/status`
Alias for sensor log status updates.

### Payments

### GET `/admin/payments`
List payment evidence submissions.

### PUT `/admin/payments/:paymentId/status`
Approve or reject a payment evidence submission.

### Analytics

### GET `/admin/analytics/dashboard`
Get aggregated analytics dashboard data.

### Registrations

### GET `/admin/registrations`
List registration requests.

### PUT `/admin/registrations/:registrationId/status`
Approve or reject a registration request.

### POST `/admin/registrations/:registrationId/resend-token`
Resend the registration verification token email.

### GET `/admin/registrations/:registrationId/resume`
Stream an applicant resume.

### Modules

### GET `/admin/modules/types`
List available module types.

### GET `/admin/modules`
List modules for admin management.

### GET `/admin/modules/:moduleId`
Get module details for editing.

### POST `/admin/modules/cover-image`
Upload a module cover image.

### POST `/admin/modules`
Create a module.

### PUT `/admin/modules/:moduleId`
Update a module.

### PATCH `/admin/modules/:moduleId/link-tpa`
Link or unlink a module to a TPA module.

### DELETE `/admin/modules/:moduleId`
Delete a module.

### Badges

### GET `/admin/badges`
List badges.

### POST `/admin/badges`
Create a badge.

### PUT `/admin/badges/:badgeId`
Update a badge.

### DELETE `/admin/badges/:badgeId`
Delete a badge.

### GET `/admin/modules/:moduleId/badges`
Get badges linked to a module.

### GET `/admin/badges/issuance-status`
Get a badge issuance record by user, assessment, and badge.

### POST `/admin/badges/issue`
Issue a badge to a user.

### Assessments

### GET `/admin/assessments`
List assessments.

### POST `/admin/assessments`
Create an assessment.

### PUT `/admin/assessments/:assessmentId/settings`
Update assessment settings.

### DELETE `/admin/assessments/:assessmentId`
Delete an assessment.

### GET `/admin/assessments/:assessmentId/questions`
Get assessment questions.

### POST `/admin/assessments/:assessmentId/questions`
Add an assessment question.

### PUT `/admin/assessments/questions/:questionId`
Update an assessment question.

### DELETE `/admin/assessments/questions/:questionId`
Delete an assessment question.

### GET `/admin/assessments/:assessmentId/attempts`
List assessment attempts.

### POST `/admin/assessments/:assessmentId/attempts/:attemptId/reset`
Reset a user attempt.

### PUT `/admin/assessments/:assessmentId/badge/:badgeId`
Link a badge to an assessment.

### DELETE `/admin/assessments/:assessmentId/badge`
Unlink a badge from an assessment.

### GET `/admin/assessments/:assessmentId/badge`
Get the badge linked to an assessment.

### Users and Completion Management

### POST `/admin/users/:userId/badges`
Issue a badge to a user.

### GET `/admin/qualifications/on-site-completions`
Read persisted on-site completion rows.

### POST `/admin/users/:userId/modules/:moduleId/complete`
Manually mark a module as completed.