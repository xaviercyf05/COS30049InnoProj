## API Testing Guide

This guide explains how to test the Digital Park Guide Training Platform API endpoints. All endpoints follow the standard response format:

```json
{
  "success": boolean,
  "data": {...},
  "message": "string"
}
```

### Setup Instructions

#### 1. Start the Database
```sql
mysql -u root -p < database/schema.sql
```

#### 2. Seed Sample Data
```bash
node scripts/seedSampleData.js
```

This creates:
- 3 test users (guide_john, guide_sarah, guide_mike) with password username123 appended
- 3 sample qualifications
- 3 modules per qualification
- 5 learning materials per module
- 10 assessment questions per module
- Sample schedules for test users

#### 3. Start the Server
```bash
npm install
npm run dev
```

Server runs on `http://localhost:5000`

---

## Testing Workflow

### Phase 1: Authentication

#### 1.1 Login as a User Guide

**Request:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "guide_john",
    "password": "guide_john123"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": 3,
      "username": "guide_john",
      "role": "User"
    }
  },
  "message": "Login successful"
}
```

**Save the token for subsequent requests:**
```bash
TOKEN="your_token_here"
```

---

### Phase 2: Browse Qualifications (Public)

#### 2.1 Get All Qualifications

**Request:**
```bash
curl http://localhost:5000/api/v1/qualifications
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "qualificationId": 1,
      "qualificationName": "Sarawak National Park Guide Certification",
      "moduleCount": 3,
      "status": "Active"
    }
  ],
  "message": "Qualifications retrieved successfully"
}
```

#### 2.2 Get Qualification Details (Including Modules)

**Request:**
```bash
curl http://localhost:5000/api/v1/qualifications/1
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "qualificationId": 1,
    "qualificationName": "Sarawak National Park Guide Certification",
    "modules": [
      {
        "moduleId": 1,
        "moduleTitle": "Module 1: Conservation Fundamentals",
        "description": "Learn the basics of park conservation..."
      }
    ]
  },
  "message": "Qualification details retrieved"
}
```

---

### Phase 3: Enroll in Qualification (Protected)

#### 3.1 Enroll User in Qualification

**Request:**
```bash
curl -X POST http://localhost:5000/api/v1/qualifications/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "qualificationId": 1
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "certificateId": 1,
    "enrollmentDate": "2024-01-15T10:00:00Z",
    "status": "Pending"
  },
  "message": "Enrolled in qualification successfully"
}
```

---

### Phase 4: View Learning Materials

#### 4.1 Get Qualification Progress

**Request:**
```bash
curl http://localhost:5000/api/v1/qualifications/1/progress \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "qualificationId": 1,
    "completionPercentage": 0,
    "modules": [
      {
        "moduleId": 1,
        "title": "Module 1: Conservation Fundamentals",
        "status": "Unlocked",
        "materialsCompleted": 0,
        "totalMaterials": 5,
        "assessmentPassed": false
      },
      {
        "moduleId": 2,
        "title": "Module 2: Biodiversity Deep Dive",
        "status": "Locked",
        "materialsCompleted": 0,
        "totalMaterials": 5,
        "assessmentPassed": false
      }
    ]
  },
  "message": "Progress retrieved successfully"
}
```

#### 4.2 Get Module Details with Materials

**Request:**
```bash
curl http://localhost:5000/api/v1/modules/1/details \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "moduleId": 1,
    "moduleTitle": "Module 1: Conservation Fundamentals",
    "chapters": ["Conservation", "Biodiversity", "Eco-tourism", "Legislation", "Safety"],
    "materials": [
      {
        "materialId": 1,
        "title": "Conservation - Module 1 Content",
        "chapter": "Conservation",
        "isCompleted": false
      }
    ]
  },
  "message": "Module details retrieved"
}
```

#### 4.3 Get Material Content for Reading

**Request:**
```bash
curl http://localhost:5000/api/v1/modules/material/1/content \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "materialId": 1,
    "title": "Conservation - Module 1 Content",
    "chapter": "Conservation",
    "contentText": "# Welcome to Conservation Fundamentals\n\nConservation is the practice of preserving biodiversity..."
  },
  "message": "Material content retrieved"
}
```

#### 4.4 Mark Material as Completed

**Request:**
```bash
curl -X POST http://localhost:5000/api/v1/modules/material/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "materialId": 1
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "materialId": 1,
    "isCompleted": true,
    "completedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Material marked as completed"
}
```

**Complete all 5 materials before attempting assessment:**
```bash
# Repeat step 4.4 for materialIds 2-5
for i in 2 3 4 5; do
  curl -X POST http://localhost:5000/api/v1/modules/material/complete \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"materialId\": $i}"
  sleep 1
done
```

---

### Phase 5: Assessment & Grading

#### 5.1 Get Assessment Questions

**Request:**
```bash
curl http://localhost:5000/api/v1/assessments/1/questions \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "assessmentId": 1,
    "moduleId": 1,
    "title": "Assessment for Module 1",
    "passingScore": 70,
    "questions": [
      {
        "questionId": 1,
        "questionText": "Question 1: Sample question about park management?",
        "questionType": "multiple_choice",
        "options": [
          {
            "optionId": 1,
            "optionText": "First option"
          },
          {
            "optionId": 2,
            "optionText": "Second option"
          }
        ]
      }
    ]
  },
  "message": "Assessment questions retrieved"
}
```

**Note:** `IsCorrect` flag is hidden from the response for integrity.

#### 5.2 Check Attempt Eligibility

**Request:**
```bash
curl http://localhost:5000/api/v1/assessments/1/eligibility \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "eligible": true,
    "attemptsRemaining": 3,
    "lastAttemptAt": null,
    "canRetryAt": null,
    "message": "Ready to attempt assessment"
  },
  "message": "Eligibility check successful"
}
```

**Ineligible Response (if already passed):**
```json
{
  "success": true,
  "data": {
    "eligible": false,
    "attemptsRemaining": 0,
    "message": "Assessment already passed. Module unlocked."
  },
  "message": "Already completed"
}
```

**Ineligible Response (cooldown period):**
```json
{
  "success": true,
  "data": {
    "eligible": false,
    "attemptsRemaining": 2,
    "cooldownMinutesRemaining": 45,
    "canRetryAt": "2024-01-15T11:45:00Z",
    "message": "Must wait before retrying failed attempt"
  },
  "message": "Retry not yet available"
}
```

#### 5.3 Submit Assessment Attempt

**Request:**
```bash
curl -X POST http://localhost:5000/api/v1/assessments/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "assessmentId": 1,
    "moduleId": 1,
    "answers": [
      {
        "questionId": 1,
        "selectedOptionId": 4
      },
      {
        "questionId": 2,
        "selectedOptionId": 8
      },
      {
        "questionId": 3,
        "selectedOptionId": 11
      },
      {
        "questionId": 4,
        "selectedOptionId": 15
      },
      {
        "questionId": 5,
        "selectedOptionId": 19
      },
      {
        "questionId": 6,
        "selectedOptionId": 1
      },
      {
        "questionId": 7,
        "selectedOptionId": 5
      },
      {
        "questionId": 8,
        "selectedOptionId": 9
      },
      {
        "questionId": 9,
        "selectedOptionId": 13
      },
      {
        "questionId": 10,
        "selectedOptionId": 17
      }
    ]
  }'
```

**Expected Response if Passed (70% or higher) (200):**
```json
{
  "success": true,
  "data": {
    "attemptId": 1,
    "assessmentId": 1,
    "score": 80,
    "percentage": 80,
    "status": "Passed",
    "message": "Congratulations! You passed the assessment.",
    "nextModuleUnlocked": true,
    "certificateProgress": {
      "modulesCompleted": 1,
      "totalModules": 3,
      "completionPercentage": 33
    }
  },
  "message": "Assessment submitted successfully"
}
```

**Expected Response if Failed (< 70%) (200):**
```json
{
  "success": true,
  "data": {
    "attemptId": 2,
    "assessmentId": 1,
    "score": 60,
    "percentage": 60,
    "status": "Failed",
    "message": "Score: 60%. Passing score is 70%. Try again!",
    "attemptsRemaining": 2,
    "cooldownMinutes": 60,
    "canRetryAt": "2024-01-15T12:30:00Z"
  },
  "message": "Assessment submitted successfully"
}
```

#### 5.4 Get Assessment History

**Request:**
```bash
curl http://localhost:5000/api/v1/assessments/1/history \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "assessmentId": 1,
    "moduleId": 1,
    "attempts": [
      {
        "attemptId": 2,
        "attemptDate": "2024-01-15T11:30:00Z",
        "score": 60,
        "percentage": 60,
        "status": "Failed"
      },
      {
        "attemptId": 1,
        "attemptDate": "2024-01-15T11:00:00Z",
        "score": 65,
        "percentage": 65,
        "status": "Failed"
      }
    ]
  },
  "message": "Assessment history retrieved"
}
```

---

### Phase 6: Certificates & Progress

#### 6.1 Get User Certificates

**Request:**
```bash
curl http://localhost:5000/api/v1/notifications/certificates \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "certificateId": 1,
      "qualificationName": "Sarawak National Park Guide Certification",
      "enrollmentDate": "2024-01-15T10:00:00Z",
      "status": "Pending",
      "isIssued": false,
      "issuedDate": null,
      "progress": {
        "modulesCompleted": 3,
        "totalModules": 3,
        "completionPercentage": 100
      }
    }
  ],
  "message": "User certificates retrieved"
}
```

#### 6.2 Get Certificate Details

**Request:**
```bash
curl http://localhost:5000/api/v1/notifications/certificates/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "certificateId": 1,
    "qualificationName": "Sarawak National Park Guide Certification",
    "awardedTo": "John Park Guide",
    "enrollmentDate": "2024-01-15T10:00:00Z",
    "issuedDate": "2024-01-20T16:00:00Z",
    "status": "Issued",
    "certificateNumber": "DPTP-2024-001",
    "moduleDetails": [
      {
        "moduleId": 1,
        "moduleTitle": "Module 1: Conservation Fundamentals",
        "completedDate": "2024-01-16T14:30:00Z"
      }
    ]
  },
  "message": "Certificate details retrieved"
}
```

---

### Phase 7: Notifications

#### 7.1 Get User Notifications

**Request:**
```bash
curl http://localhost:5000/api/v1/notifications \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "notificationId": 1,
      "title": "Welcome to Sarawak National Park Guide Certification",
      "message": "You have successfully enrolled in the certification program.",
      "notificationType": "Enrollment",
      "createdAt": "2024-01-15T10:05:00Z",
      "isRead": false
    },
    {
      "notificationId": 2,
      "title": "Assessment Passed!",
      "message": "Congratulations! You scored 80% on the Module 1 assessment.",
      "notificationType": "Assessment",
      "createdAt": "2024-01-15T11:35:00Z",
      "isRead": false
    }
  ],
  "message": "Notifications retrieved successfully"
}
```

#### 7.2 Get Announcements

**Request:**
```bash
curl http://localhost:5000/api/v1/notifications/announcements \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "announcementId": 1,
      "title": "New Training Schedule Released",
      "message": "Check your schedules for upcoming training sessions.",
      "targetRole": "User",
      "createdAt": "2024-01-10T09:00:00Z",
      "expiryDate": null
    }
  ],
  "message": "Announcements retrieved successfully"
}
```

#### 7.3 Get User Schedules

**Request:**
```bash
curl http://localhost:5000/api/v1/notifications/schedules \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "scheduleId": 1,
      "qualificationName": "Sarawak National Park Guide Certification",
      "title": "Module 1 Theory Session",
      "description": "Interactive classroom session covering conservation basics",
      "eventDate": "2024-01-22",
      "startTime": "09:00",
      "endTime": "11:30"
    }
  ],
  "message": "Schedules retrieved successfully"
}
```

---

### Phase 8: User Profile Management

#### 8.1 Get User Profile

**Request:**
```bash
curl http://localhost:5000/api/v1/user/profile \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": 3,
    "username": "guide_john",
    "fullName": "John Park Guide",
    "email": "john_guide@sarawakparks.my",
    "role": "User",
    "status": "Active",
    "joinDate": "2024-01-15T10:00:00Z"
  },
  "message": "Profile retrieved successfully"
}
```

#### 8.2 Update User Profile

**Request:**
```bash
curl -X PUT http://localhost:5000/api/v1/user/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fullName": "John Smith",
    "email": "john.smith@sarawakparks.my"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": 3,
    "username": "guide_john",
    "fullName": "John Smith",
    "email": "john.smith@sarawakparks.my"
  },
  "message": "Profile updated successfully"
}
```

#### 8.3 Change Password

**Request:**
```bash
curl -X POST http://localhost:5000/api/v1/user/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "currentPassword": "guide_john123",
    "newPassword": "newPassword@123"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {},
  "message": "Password changed successfully"
}
```

---

### Phase 9: Admin Operations (Admin Token Required)

#### 9.1 Login as Admin

**Request:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

Save the admin token:
```bash
ADMIN_TOKEN="admin_token_here"
```

#### 9.2 Create New Qualification (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:5000/api/v1/admin/qualifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "qualificationName": "Advanced Wildlife Conservation",
    "description": "Expert-level conservation program"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "qualificationId": 4,
    "qualificationName": "Advanced Wildlife Conservation",
    "createdAt": "2024-01-15T15:00:00Z"
  },
  "message": "Qualification created successfully"
}
```

#### 9.3 Get All Users (Admin Only)

**Request:**
```bash
curl http://localhost:5000/api/v1/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "userId": 3,
      "username": "guide_john",
      "fullName": "John Park Guide",
      "email": "john_guide@sarawakparks.my",
      "role": "User",
      "status": "Active",
      "joinDate": "2024-01-15T10:00:00Z"
    }
  ],
  "message": "Users retrieved successfully"
}
```

#### 9.4 Update User Status (Admin Only)

**Request:**
```bash
curl -X PUT http://localhost:5000/api/v1/admin/users/3/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "status": "Inactive"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": 3,
    "username": "guide_john",
    "status": "Inactive"
  },
  "message": "User status updated successfully"
}
```

Valid statuses: `Active`, `Inactive`, `Suspended`

#### 9.5 Create Announcement (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:5000/api/v1/admin/announcements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "Important: New Safety Guidelines",
    "message": "All guides must review the updated safety protocols.",
    "targetRole": "User"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "announcementId": 2,
    "title": "Important: New Safety Guidelines",
    "createdAt": "2024-01-15T15:30:00Z"
  },
  "message": "Announcement created successfully"
}
```

Valid targetRoles: `User`, `Admin`, `All`

#### 9.6 Create Schedule Event (Admin Only)

**Request:**
```bash
curl -X POST http://localhost:5000/api/v1/admin/schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "userId": 3,
    "qualificationId": 1,
    "title": "One-on-One Mentoring Session",
    "description": "Personalized guidance on Module 2 content",
    "eventDate": "2024-01-25",
    "startTime": "14:00:00",
    "endTime": "15:30:00"
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "scheduleId": 10,
    "title": "One-on-One Mentoring Session",
    "eventDate": "2024-01-25",
    "createdAt": "2024-01-15T15:45:00Z"
  },
  "message": "Schedule created successfully"
}
```

#### 9.7 Get User Enrollment Details (Admin Only)

**Request:**
```bash
curl http://localhost:5000/api/v1/admin/users/3/enrollments \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": 3,
    "username": "guide_john",
    "fullName": "John Park Guide",
    "enrollments": [
      {
        "certificateId": 1,
        "qualificationName": "Sarawak National Park Guide Certification",
        "enrollmentDate": "2024-01-15T10:00:00Z",
        "status": "Issued",
        "progress": {
          "modulesCompleted": 3,
          "totalModules": 3,
          "completionPercentage": 100
        }
      }
    ]
  },
  "message": "User enrollment details retrieved"
}
```

---

## Error Handling

All endpoints return error responses in the standard format:

**400 Bad Request (Validation Error):**
```json
{
  "success": false,
  "data": null,
  "message": "Validation error: 'qualificationId' must be a valid number"
}
```

**401 Unauthorized (Missing/Invalid Token):**
```json
{
  "success": false,
  "data": null,
  "message": "No token provided. Please login first."
}
```

**403 Forbidden (Insufficient Permissions):**
```json
{
  "success": false,
  "data": null,
  "message": "Access denied. Admin privileges required."
}
```

**404 Not Found:**
```json
{
  "success": false,
  "data": null,
  "message": "Qualification not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "data": null,
  "message": "An error occurred while processing your request"
}
```

---

## Workflow Summary

**Complete User Journey:**

1. **Login** → obtain JWT token
2. **Browse Qualifications** → view available certifications (public)
3. **View Details** → examine modules, scope of work (public)
4. **Enroll** → create Certificate record with "Pending" status
   - Triggers enrollment notification
5. **Learn Materials** (per module):
   - Get module details
   - Read materials (5 per module)
   - Mark material as completed
6. **Complete Assessment** (after materials):
   - Check eligibility (previous module must be passed)
   - Get assessment questions
   - Submit answers
   - Receive automatic score + pass/fail
7. **Progress Through Modules** → automatic unlock of Module 2 after Module 1 passed
8. **Auto-Issue Certificate** → when all 3 modules completed
   - Status changes to "Issued"
   - User receives certificate notification
9. **View Progress** → anytime check completion percentage
10. **View Schedules** → admin-scheduled events for this user
11. **View Announcements** → role-targeted messages from admin

**Admin Operations:**
- Create qualifications, announcements, schedules
- View all users and their progress
- Update user status (Active/Inactive/Suspended)
- Export enrollment details

---

## Quick Test Commands

Run this bash script to test the complete user workflow:

```bash
#!/bin/bash

BASE_URL="http://localhost:5000/api/v1"
USERNAME="guide_john"
PASSWORD="guide_john123"

echo "=== Login ==="
LOGIN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo $LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token: $TOKEN"

echo -e "\n=== Get Qualifications ==="
curl -s $BASE_URL/qualifications | jq .

echo -e "\n=== Enroll in Qualification ==="
curl -s -X POST $BASE_URL/qualifications/enroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"qualificationId":1}' | jq .

echo -e "\n=== Get Progress ==="
curl -s $BASE_URL/qualifications/1/progress \
  -H "Authorization: Bearer $TOKEN" | jq .

echo -e "\n=== Get Profile ==="
curl -s $BASE_URL/user/profile \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Save as `test_api.sh`, make executable, and run:
```bash
chmod +x test_api.sh
./test_api.sh
```
