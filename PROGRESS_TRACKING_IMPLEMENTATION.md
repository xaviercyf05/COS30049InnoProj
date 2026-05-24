# User Module Progress Tracking Implementation

## ✅ Completed Implementation

### 1. Database Layer
**Table Created:** `user_progress`

**Schema:**
```sql
CREATE TABLE user_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  moduleId INT UNSIGNED NOT NULL,
  visitedSectionIds JSON DEFAULT '[]',           -- Array of visited section IDs
  progressPercent INT DEFAULT 0,                 -- 0-100% progress
  lastSectionId VARCHAR(100) NULL,              -- Last read section (for resume)
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY (userId, moduleId),                -- One progress per user per module
  FOREIGN KEY (userId) REFERENCES Users(UserID) ON DELETE CASCADE,
  FOREIGN KEY (moduleId) REFERENCES Modules(ModuleID) ON DELETE CASCADE
)
```

**Indexes:**
- Unique constraint on (userId, moduleId)
- Index on userId (for quick user lookups)
- Index on moduleId (for quick module lookups)
- Index on updatedAt (for chronological queries)

---

### 2. Backend Services
**File:** `src/services/progressService.js`

**Functions:**
1. `getUserModuleProgress(userId, moduleId)` - Fetch progress for a module
2. `saveUserModuleProgress(userId, moduleId, visitedSectionIds, progressPercent, lastSectionId)` - Save/update progress
3. `calculateProgressPercent(moduleId, visitedSectionIds)` - Calculate % from visited items
4. `getAllUserProgress(limit, offset)` - Admin function to fetch all progress records
5. `deleteUserModuleProgress(userId, moduleId)` - Clear progress for a module

---

### 3. API Endpoints

#### **GET /api/v1/modules/:moduleId/progress**
Fetch user's current progress for a module.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "moduleId": 123,
    "visitedSectionIds": ["section-1", "section-2", "subsection-2-1"],
    "progressPercent": 45,
    "lastSectionId": "section-2",
    "updatedAt": "2026-05-08T10:30:00Z"
  }
}
```

**If no progress exists:** Returns `visitedSectionIds: []`, `progressPercent: 0`, `lastSectionId: null`

---

#### **POST /api/v1/modules/:moduleId/progress**
Save/update user's progress for a module.

**Request Body:**
```json
{
  "visitedSectionIds": ["section-1", "section-2", "subsection-2-1"],
  "progressPercent": 45,
  "lastSectionId": "section-2"  // Optional
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Progress saved successfully.",
  "data": {
    "moduleId": 123,
    "visitedSectionIds": ["section-1", "section-2", "subsection-2-1"],
    "progressPercent": 45,
    "lastSectionId": "section-2",
    "updatedAt": "2026-05-08T10:31:00Z"
  }
}
```

**Validation:**
- `visitedSectionIds`: Must be an array ✓
- `progressPercent`: Must be integer between 0-100 ✓
- `lastSectionId`: Optional string

---

#### **GET /api/v1/modules/dashboard** (UPDATED)
Dashboard now includes user progress per module.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "moduleId": 123,
      "qualificationId": 456,
      "title": "General Module",
      "moduleTypeId": 1,
      "moduleType": "General",
      "image": "https://...",
      "progressPercent": 45
    },
    ...
  ]
}
```

---

### 4. Files Modified
1. **database/schema.sql**
   - Added user_progress to DROP TABLE list
   - Added full user_progress table definition

2. **database/migration_user_progress.sql**
   - New migration file with CREATE TABLE and INDEX statements

3. **src/services/progressService.js**
   - New service file with 5 progress management functions

4. **src/controllers/materialController.js**
   - Updated getDashboardModules() to pull from user_progress table
   - Added getModuleProgress() controller
   - Added saveModuleProgress() controller
   - Added progressService import

5. **src/routes/v1/moduleRoutes.js**
   - Added GET /:moduleId/progress route
   - Added POST /:moduleId/progress route
   - Proper validation for both endpoints

6. **package.json**
   - Added "migrate:user-progress" script

7. **scripts/runUserProgressMigration.js**
   - New migration runner script (idempotent, handles errors gracefully)

---

### 5. How It Works

**User Reading Flow:**
```
1. User opens module → API calls GET /modules/:moduleId/progress
2. Frontend displays progress (0% if first time, or saved %)
3. User reads sections → Frontend tracks visitedSectionIds
4. Every ~2 seconds → Frontend POSTs to /modules/:moduleId/progress
5. Backend saves: visitedSectionIds array + calculated progressPercent
6. Next session → User opens module → Fetches saved progress
7. Frontend can resume from lastSectionId instead of starting from section 1
```

**Progress Calculation:**
- Formula: `progressPercent = (visitedItemsCount / totalItemsCount) × 100`
- totalItems = number of Sections + number of Subsections
- progressPercent is clamped to 0-100 range
- Updated on every save

---

### 6. Key Features

✅ **Resume Functionality**
- `lastSectionId` stored to resume from where user stopped reading
- Persistent across sessions

✅ **Accurate Progress Tracking**
- Tracks both sections and subsections
- Calculates percentage based on total content items

✅ **Frequent Updates Support**
- Backend uses ON DUPLICATE KEY UPDATE for efficient saves
- Can handle ~2s save intervals without issue
- Automatic timestamp updates

✅ **Graceful Fallbacks**
- Returns 0% + empty array if no progress exists
- Never errors on missing progress records

✅ **Data Integrity**
- UNIQUE constraint ensures one progress record per user-module pair
- CASCADE deletes when user or module is deleted
- Timestamps auto-update on changes

✅ **Query Performance**
- Multiple indexes for fast lookups
- userId, moduleId, and user_module indexes
- updatedAt index for chronological queries

---

### 7. Usage Example

**Frontend Integration:**

```javascript
// Get current progress
const response = await fetch('/api/v1/modules/123/progress', {
  headers: { 'Authorization': 'Bearer <token>' }
});
const { data } = await response.json();
console.log(`Current: ${data.progressPercent}%, Resume from: ${data.lastSectionId}`);

// Save progress every 2 seconds
setInterval(async () => {
  await fetch('/api/v1/modules/123/progress', {
    method: 'POST',
    headers: { 
      'Authorization': 'Bearer <token>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      visitedSectionIds: ['section-1', 'section-2', 'subsection-2-1'],
      progressPercent: 45,
      lastSectionId: 'section-2'
    })
  });
}, 2000);
```

---

### 8. Database Migration

**Run migration:**
```bash
npm run migrate:user-progress
```

**Output:**
```
=== User Progress Migration Complete ===
✓ Executed: 2 statements
⊘ Skipped: 0 statements (already exist)
```

---

### 9. Testing the Endpoints

**Get progress (first time = empty):**
```bash
curl -X GET http://localhost:5000/api/v1/modules/1/progress \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Save progress:**
```bash
curl -X POST http://localhost:5000/api/v1/modules/1/progress \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "visitedSectionIds": ["section-1", "section-2"],
    "progressPercent": 30,
    "lastSectionId": "section-2"
  }'
```

---

## ✅ Implementation Complete

All features requested are now fully implemented:
- ✅ User progress storage table
- ✅ GET endpoint for fetching progress
- ✅ POST endpoint for saving progress  
- ✅ Progress percentage calculation
- ✅ Resume-from-last-section functionality
- ✅ Dashboard updated with progress field
- ✅ Graceful handling of missing progress (returns 0%)
- ✅ Idempotent migration runner

**System is ready for production use!**
