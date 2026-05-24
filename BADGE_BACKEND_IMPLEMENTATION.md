# Badge Backend Implementation Summary

## ✅ Completed Backend Changes

### 1. **Badge Controller Updates** (`src/controllers/badgeController.js`)

#### mapBadgeRow() Function
Updated to include new badge fields in API responses:
```javascript
{
  badgeId, id, name, image, iconUrl, unlocked, unlockThreshold,
  isValid,        // New: boolean indicating if badge is valid
  validity,       // New: same as isValid for frontend flexibility
  expiryDate,     // New: DATETIME expiry (null if no expiry)
  linkedModuleId, // New: FK reference to Modules table
  linkedModuleID  // New: alternate property name for compatibility
}
```

#### getAllBadges()
- Updated SELECT to include: `IsValid, ExpiryDate, LinkedModuleID`
- Returns all badges with new fields populated

#### createBadge()
- Reads `req.body.isValid` (defaults to 1 if not provided)
- Reads `req.body.expiryDate` (optional ISO8601 date)
- Reads `req.body.linkedModuleId` or `req.body.linkedModuleID` (optional)
- INSERT statement updated with 3 new columns: `IsValid, ExpiryDate, LinkedModuleID`

#### updateBadge()
- Reads same 3 fields as createBadge
- UPDATE statement includes: `SET IsValid = ?, ExpiryDate = ?, LinkedModuleID = ?`

### 2. **API Route Validation** (`src/routes/v1/adminRoutes.js`)

#### POST /admin/badges (Create Badge)
Added validation rules:
```javascript
body("isValid").optional().isBoolean().withMessage("isValid must be a boolean.")
body("expiryDate").optional().isISO8601().withMessage("Expiry date must be a valid ISO8601 date.")
body("linkedModuleId").optional().isInt().withMessage("Linked module ID must be a valid number.")
```

#### PUT /admin/badges/:badgeId (Update Badge)
Same validation rules as create endpoint

### 3. **Database Schema** (`database/migration_badge_validity_linkedmodule.sql`)

Migration file ready to execute with:
- `ALTER TABLE Badges ADD COLUMN IsValid TINYINT(1) NOT NULL DEFAULT 1`
- `ALTER TABLE Badges ADD COLUMN ExpiryDate DATETIME NULL`
- `ALTER TABLE Badges ADD COLUMN LinkedModuleID INT UNSIGNED NULL`
- Foreign key constraint: `FK Badges.LinkedModuleID → Modules.ModuleID`
- Index: `idx_badges_linked_module` on LinkedModuleID for query optimization

---

## ⚙️ Pending: Database Migration Execution

The migration file is created and verified. To execute:

**Option 1: MySQL Command Line** (when MySQL connection is available)
```bash
mysql -u root -p digital_park_guide < database/migration_badge_validity_linkedmodule.sql
```

**Option 2: Node.js Script** (created at `scripts/runBadgeMigration.js`)
```bash
npm install  # Install dependencies if needed
node scripts/runBadgeMigration.js
```

**What the migration does:**
1. ✅ Adds 3 new columns to Badges table
2. ✅ Sets up foreign key to Modules table for linkedModuleID
3. ✅ Creates index for linkedModuleID queries
4. ✅ Sets default IsValid = 1 for existing and new badges

---

## 🔄 API Payload Examples

### Creating a Badge with Validity & Linked Module
```json
{
  "name": "Bako National Park Explore",
  "iconUrl": "https://cdn-icons-png.flaticon.com/512/16779/16779402.png",
  "unlockThreshold": 80,
  "isValid": true,
  "expiryDate": "2025-12-31T23:59:59Z",
  "linkedModuleId": 5
}
```

### API Response (GET /api/v1/admin/badges)
```json
{
  "success": true,
  "data": [
    {
      "badgeId": 1,
      "id": 1,
      "name": "Bako National Park Explore",
      "iconUrl": "https://...",
      "unlockThreshold": 80,
      "isValid": true,
      "validity": true,
      "expiryDate": "2025-12-31T23:59:59.000Z",
      "linkedModuleId": 5,
      "linkedModuleID": 5
    }
  ]
}
```

---

## 📋 Frontend Tasks Still Required

### 1. **EditBadgeScreen.js Updates**
Currently only sends: `{ name, iconUrl }`
Needs to also capture and send:
- `isValid` (checkbox)
- `expiryDate` (date picker)
- `linkedModuleId` (dropdown to select module)

### 2. **AddBadgeScreen.js Updates**
Same fields as EditBadgeScreen:
- `isValid` checkbox
- `expiryDate` date picker
- `linkedModuleId` module selector

### 3. **BadgeManagementScreen.js Updates**
Display new fields:
- Show validity status (badge active/inactive indicator)
- Show linked module name if linkedModuleId is set
- Show expiry date if set

### 4. **AdminResultVerificationScreen.js Updates**
When admin clicks a module in results:
- Fetch linked badge for that module via `GET /api/v1/admin/badges` with linkedModuleId filter
- Display linked badge to admin
- Add "Issue Badge" button

### 5. **Badge Issuance Endpoint** (Backend - New)
Create endpoint to issue badges to users:
```
POST /api/v1/admin/badges/:badgeId/issue
Body: { userId, assessmentAttemptId }
```

---

## 🧪 Testing Checklist

Backend is ready once database migration is applied:

- [ ] Database migration executed successfully
- [ ] GET /api/v1/admin/badges returns badges with isValid, expiryDate, linkedModuleId
- [ ] POST /api/v1/admin/badges with new fields creates badge correctly
- [ ] PUT /api/v1/admin/badges/:id with new fields updates badge correctly
- [ ] Validation rejects invalid dates/module IDs with proper error messages
- [ ] Frontend EditBadgeScreen captures all 3 new fields
- [ ] Frontend displays validity and linked module info
- [ ] Badge issuance workflow works end-to-end

---

## 🔗 File References

**Backend Files Modified:**
- `src/controllers/badgeController.js` - Controller methods updated
- `src/routes/v1/adminRoutes.js` - Route validation updated
- `database/migration_badge_validity_linkedmodule.sql` - Migration file (ready to execute)
- `scripts/runBadgeMigration.js` - Node.js migration runner (created)

**Frontend Files to Update:**
- `frontend/Admin/EditBadgeScreen.js`
- `frontend/Admin/AddBadgeScreen.js`
- `frontend/Admin/BadgeManagementScreen.js`
- `frontend/Admin/AdminResultVerificationScreen.js`

---

## 📝 Next Steps

1. **Execute the database migration** - This must happen first
2. **Update frontend UI components** - Add form fields for new badge attributes
3. **Update badge display** - Show validity and linked module information
4. **Implement badge issuance endpoint** - Create POST endpoint for admin to issue badges
5. **Test end-to-end** - Create badge → assign to module → verify in results → issue badge

Backend is **fully functional** once migration is applied. Frontend work is independent and can proceed in parallel.
