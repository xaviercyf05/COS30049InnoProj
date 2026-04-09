# Digital Park Guide Training Platform - API Documentation

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
Most endpoints require a Bearer token obtained from login. Include token in headers:
```
Authorization: Bearer <token>
```

---

## 1. AUTHENTICATION ENDPOINTS

### POST `/auth/login`
Login a user (park guide or admin).

**Request Body:**
```json
{
  "username": "john_guide",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": "12h",
    "user": {
      "userId": 1,
      "username": "john_guide",
      "role": "User"
    }
  }
}
```

---

## 2. USER PROFILE ENDPOINTS

### GET `/user/profile`
Get logged-in user's profile. **(Requires Auth)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "username": "john_guide",
    "fullName": "John Guide",
    "email": "john@example.com",
    "role": "User",
    "status": "Active",
    "isActive": true,
    "progress": 0,
    "createdAt": "2026-04-10T12:00:00Z"
  }
}
```

### PUT `/user/profile`
Update user profile information. **(Requires Auth)**

**Request Body:**
```json
{
  "fullName": "John Updated",
  "email": "john.new@example.com"
}
```

### POST `/user/change-password`
Change user password. **(Requires Auth)**

**Request Body:**
```json
{
  "currentPassword": "SecurePass123",
  "newPassword": "NewSecurePass456"
}
```

---

## 3. QUALIFICATIONS ENDPOINTS

### GET `/qualifications`
Get all available qualifications. **(Public)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "qualificationId": 1,
      "name": "Sarawak National Park Guide",
      "status": "Active"
    },
    {
      "qualificationId": 2,
      "name": "Nature Reserve Conservation",
      "status": "Active"
    }
  ]
}
```

### GET `/qualifications/:qualificationId`
Get qualification details including modules. **(Public)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "qualificationId": 1,
    "name": "Sarawak National Park Guide",
    "status": "Active",
    "modules": [
      {
        "moduleId": 1,
        "title": "Module 1: Conservation Fundamentals"
      },
      {
        "moduleId": 2,
        "title": "Module 2: Biodiversity Deep Dive"
      },
      {
        "moduleId": 3,
        "title": "Module 3: Advanced Park Management"
      }
    ]
  }
}
```

### POST `/qualifications/enroll`
Enroll user in a qualification. **(Requires Auth)**

**Request Body:**
```json
{
  "qualificationId": 1
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Successfully enrolled in qualification.",
  "data": {
    "certificateId": 5,
    "qualificationId": 1,
    "status": "Pending"
  }
}
```

### GET `/qualifications/user/my-qualifications`
Get user's enrolled qualifications. **(Requires Auth)**

### GET `/qualifications/:qualificationId/progress`
Get user's progress in a qualification including module status. **(Requires Auth)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "qualificationId": 1,
    "moduleProgress": [
      {
        "moduleId": 1,
        "moduleTitle": "Module 1: Conservation Fundamentals",
        "materialsCompleted": 3,
        "materialTotal": 5,
        "assessmentPassed": false,
        "canAttemptAssessment": true,
        "isUnlocked": true
      },
      {
        "moduleId": 2,
        "moduleTitle": "Module 2: Biodiversity Deep Dive",
        "materialsCompleted": 0,
        "materialTotal": 5,
        "assessmentPassed": false,
        "canAttemptAssessment": false,
        "isUnlocked": false
      }
    ],
    "overallStatus": "In Progress",
    "completionPercentage": 33
  }
}
```

---

## 4. MODULES & MATERIALS ENDPOINTS

### GET `/modules/:qualificationId/all`
Get all modules for a qualification. **(Requires Auth)**

### GET `/modules/:moduleId/details`
Get module details with learning materials list. **(Requires Auth)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "moduleId": 1,
    "qualificationId": 1,
    "title": "Module 1: Conservation Fundamentals",
    "chapters": [
      "Conservation Basics",
      "Biodiversity",
      "Eco-tourism",
      "Legislation",
      "Safety"
    ],
    "materials": [
      {
        "materialId": 1,
        "chapter": "Conservation Basics",
        "title": "Introduction to Conservation",
        "contentType": "text",
        "isCompleted": true
      },
      {
        "materialId": 2,
        "chapter": "Conservation Basics",
        "title": "Sustainable Practices",
        "contentType": "text",
        "isCompleted": false
      }
    ]
  }
}
```

### GET `/modules/material/:materialId/content`
Get full learning material content. **(Requires Auth)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "materialId": 1,
    "moduleId": 1,
    "chapter": "Conservation Basics",
    "title": "Introduction to Conservation",
    "contentType": "text",
    "content": "Long content text here...",
    "isCompleted": false
  }
}
```

### POST `/modules/material/complete`
Mark a learning material as completed. **(Requires Auth)**

**Request Body:**
```json
{
  "materialId": 1
}
```

---

## 5. ASSESSMENTS ENDPOINTS

### GET `/assessments/:moduleId/questions`
Get assessment questions for a module with options. **(Requires Auth)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "assessmentId": 1,
    "moduleId": 1,
    "title": "Module 1 Assessment",
    "passingScore": 70,
    "totalQuestions": 10,
    "questions": [
      {
        "questionId": 1,
        "questionText": "What is conservation?",
        "questionType": "multiple_choice",
        "options": [
          {
            "optionId": 1,
            "text": "Preserving natural resources"
          },
          {
            "optionId": 2,
            "text": "Destroying habitats"
          }
        ]
      }
    ]
  }
}
```

### GET `/assessments/:assessmentId/eligibility`
Check if user can attempt assessment (remaining attempts, cooldown). **(Requires Auth)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "canAttempt": true,
    "remainingAttempts": 2
  }
```

Or if on cooldown:
```json
{
  "success": true,
  "data": {
    "canAttempt": false,
    "reason": "Must wait 45 more minutes before next attempt",
    "remainingAttempts": 1,
    "cooldownEndsAt": "2026-04-10T13:45:00Z"
  }
}
```

### POST `/assessments/submit`
Submit assessment attempt with answers. **(Requires Auth)**

**Request Body:**
```json
{
  "assessmentId": 1,
  "answers": [
    { "optionId": 1 },
    { "optionId": 4 },
    { "optionId": 2 }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Assessment attempt submitted successfully.",
  "data": {
    "attemptId": 10,
    "assessmentId": 1,
    "score": 80,
    "totalQuestions": 10,
    "correctCount": 8,
    "passingScore": 70,
    "status": "Passed",
    "passed": true
  }
}
```

### GET `/assessments/:moduleId/history`
Get user's assessment attempt history. **(Requires Auth)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "attemptId": 10,
      "assessmentId": 1,
      "score": 80,
      "status": "Passed",
      "submittedAt": "2026-04-10T13:00:00Z",
      "isPassed": true,
      "passingScore": 70
    }
  ]
}
```

---

## 6. NOTIFICATIONS & CERTIFICATES ENDPOINTS

### GET `/notifications`
Get user's notifications. **(Requires Auth)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "notificationId": 1,
      "title": "Assessment Passed! 🎉",
      "message": "Congratulations! You passed the Module 1 assessment..."
    }
  ]
}
```

### GET `/notifications/announcements`
Get announcements for user's role. **(Requires Auth)**

### GET `/notifications/schedules`
Get user's scheduled events. **(Requires Auth)**

### GET `/notifications/certificates`
Get user's certificates. **(Requires Auth)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "certificateId": 5,
      "qualificationId": 1,
      "qualificationName": "Sarawak National Park Guide",
      "status": "Issued",
      "isIssued": true
    }
  ]
}
```

### GET `/notifications/certificates/:certificateId`
Get certificate details. **(Requires Auth)**

---

## 7. ADMIN MANAGEMENT ENDPOINTS

### POST `/admin/qualifications`
Create new qualification. **(Requires Admin Auth)**

**Request Body:**
```json
{
  "name": "New Park Guide Program",
  "status": "Active"
}
```

### POST `/admin/announcements`
Create announcement for specific role. **(Requires Admin Auth)**

**Request Body:**
```json
{
  "title": "Important Maintenance Notice",
  "content": "The park will be closed for maintenance...",
  "targetRole": "User",
  "expiryDate": "2026-05-01"
}
```

### POST `/admin/schedules`
Create schedule event for a user. **(Requires Admin Auth)**

**Request Body:**
```json
{
  "targetUserId": 2,
  "qualificationId": 1,
  "title": "Field Training Session",
  "description": "Indoor training for Module 2",
  "eventDate": "2026-05-15",
  "startTime": "09:00",
  "endTime": "12:00"
}
```

### GET `/admin/users`
Get all users. **(Requires Admin Auth)**

### PUT `/admin/users/:userId/status`
Update user account status. **(Requires Admin Auth)**

**Request Body:**
```json
{
  "targetUserId": 2,
  "status": "Suspended"
}
```

### GET `/admin/users/:userId/enrollments`
Get user's enrollment and qualification progress. **(Requires Admin Auth)**

---

## ERROR RESPONSES

All endpoints follow standard error format:

```json
{
  "success": false,
  "message": "Error description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate entry)
- `500` - Internal Server Error

---

## LEARNING FLOW SUMMARY

1. **User enrolls in qualification** → Gets access to Module 1
2. **User reads learning materials** → Can be in any order
3. **User completes materials** (optional for assessment, but recommended)
4. **User attempts assessment** → Limited to 3 attempts with 1-hour cooldown
5. **User passes assessment** → Unlocks next module
6. **User completes all modules** → Certificate issued automatically
7. **User gets notifications** → For enrollment, assessment results, certificates, schedules

---

## RESPONSE CODES QUICK REFERENCE

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/auth/login` | POST | No | Authenticate user |
| `/user/profile` | GET | Yes | Get own profile |
| `/user/profile` | PUT | Yes | Update own profile |
| `/user/change-password` | POST | Yes | Change password |
| `/qualifications` | GET | No | List all qualifications |
| `/qualifications/:id` | GET | No | Get qualification details |
| `/qualifications/enroll` | POST | Yes | Enroll in qualification |
| `/qualifications/:id/progress` | GET | Yes | Get progress |
| `/modules/:qId/all` | GET | Yes | List modules |
| `/modules/:mId/details` | GET | Yes | Get module details |
| `/modules/material/:mId/content` | GET | Yes | Get material content |
| `/modules/material/complete` | POST | Yes | Mark material done |
| `/assessments/:mId/questions` | GET | Yes | Get assessment |
| `/assessments/:aId/eligibility` | GET | Yes | Check attempt eligibility |
| `/assessments/submit` | POST | Yes | Submit attempt |
| `/assessments/:mId/history` | GET | Yes | Get attempt history |
| `/notifications` | GET | Yes | Get notifications |
| `/notifications/announcements` | GET | Yes | Get announcements |
| `/notifications/schedules` | GET | Yes | Get schedules |
| `/notifications/certificates` | GET | Yes | List certificates |
| `/admin/qualifications` | POST | Admin | Create qualification |
| `/admin/announcements` | POST | Admin | Create announcement |
| `/admin/schedules` | POST | Admin | Create schedule |
| `/admin/users` | GET | Admin | List all users |
| `/admin/users/:uid/status` | PUT | Admin | Update user status |
| `/admin/users/:uid/enrollments` | GET | Admin | Get enrollments |
