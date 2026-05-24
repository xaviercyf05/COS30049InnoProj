# Backend Module Linking Fix - On-Site Access Control

## Problem Identified

On-site modules were not locking/unlocking correctly after TPA assessments because the backend API endpoint `/api/v1/modules/dashboard` was **not returning the `linkedTpaModuleId` field** needed by the frontend to determine prerequisites.

**Example:**
- Backend query was selecting: `ModuleID`, `ModuleTitle`, `ModuleTypeID`, `TypeName`, `CoverImageUrl`
- Missing: `LinkedTpaModuleID` (from database Modules table)
- Result: Frontend received `linkedTpaModuleId: undefined` for all modules
- Consequence: On-site modules couldn't determine their TPA prerequisites

## Solution Implemented

### Updated Endpoint: `GET /api/v1/modules/dashboard`

**File Modified:** `src/controllers/materialController.js`

**Changes Made:**

#### 1. Query 1 - Get Qualification Modules (lines 79-88)
```sql
SELECT m.ModuleID,
       m.QualificationID,
       m.ModuleTitle,
       m.ModuleTypeID,
       mt.TypeName,
       meta.CoverImageUrl,
       m.LinkedTpaModuleID,           -- ✅ ADDED
       m.LinkedOnsiteModuleID         -- ✅ ADDED
FROM Modules m
LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
WHERE m.QualificationID = ?
```

#### 2. Query 2 - Get Certificate Modules (lines 104-113)
```sql
SELECT m.ModuleID,
       m.QualificationID,
       m.ModuleTitle,
       m.ModuleTypeID,
       mt.TypeName,
       meta.CoverImageUrl,
       m.LinkedTpaModuleID,           -- ✅ ADDED
       m.LinkedOnsiteModuleID         -- ✅ ADDED
FROM Certificates c
INNER JOIN Modules m ON m.QualificationID = c.QualificationID
LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
WHERE c.UserID = ?
```

#### 3. Query 3 - Get All Modules (lines 131-140)
```sql
SELECT m.ModuleID,
       m.QualificationID,
       m.ModuleTitle,
       m.ModuleTypeID,
       mt.TypeName,
       meta.CoverImageUrl,
       m.LinkedTpaModuleID,           -- ✅ ADDED
       m.LinkedOnsiteModuleID         -- ✅ ADDED
FROM Modules m
LEFT JOIN ModuleUiMeta meta ON meta.ModuleID = m.ModuleID
LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
ORDER BY m.ModuleTypeID ASC, m.ModuleID ASC
```

#### 4. Response Mapping (lines 225-226)
```javascript
return {
  moduleId: row.ModuleID,
  title: row.ModuleTitle,
  stage: normalizeModuleStage(row.TypeName),
  progressPercent,
  unlocked: unlockState.unlocked,
  lockReason: unlockState.unlocked ? "" : "Complete the previous module to unlock this module.",
  qualificationId: row.QualificationID,
  moduleTypeId: row.ModuleTypeID,
  moduleType: row.TypeName || "Unassigned",
  image: resolveModuleCoverImage(row.ModuleID, row.CoverImageUrl),
  linkedTpaModuleId: row.LinkedTpaModuleID || null,       -- ✅ ADDED
  linkedOnsiteModuleId: row.LinkedOnsiteModuleID || null, -- ✅ ADDED
};
```

## API Response Example

### Before Fix
```json
{
  "success": true,
  "data": [
    {
      "moduleId": 49,
      "title": "On-Site: Similajau",
      "stage": "on-site",
      "progressPercent": 0,
      "moduleTypeId": 3,
      "moduleType": "On-Site Training Modules",
      "linkedTpaModuleId": undefined,      // ❌ Missing!
      "linkedOnsiteModuleId": undefined
    }
  ]
}
```

### After Fix
```json
{
  "success": true,
  "data": [
    {
      "moduleId": 49,
      "title": "On-Site: Similajau",
      "stage": "on-site",
      "progressPercent": 0,
      "moduleTypeId": 3,
      "moduleType": "On-Site Training Modules",
      "linkedTpaModuleId": 35,            // ✅ Now present!
      "linkedOnsiteModuleId": null
    }
  ]
}
```

## How It Works Now

### Complete Access Control Flow

1. **Backend retrieves modules** with linking relationships
   ```
   GET /api/v1/modules/dashboard
   ↓
   Returns: modules with linkedTpaModuleId values
   ```

2. **Frontend receives linking info**
   ```javascript
   Frontend receives: linkedTpaModuleId = 35
   ```

3. **Frontend checks prerequisite**
   ```javascript
   // On-site module unlock logic
   prerequisiteModuleId = 35  // From linkedTpaModuleId
   unlocked = prerequisiteModuleId ? passedModuleIds.has(String(35)) : false
   // If user passed module 35 → unlocked = true
   // If user hasn't passed module 35 → unlocked = false
   ```

4. **User sees correct lock/unlock status**
   - **User passed Similajau TPA (35)** → Module 49 (On-Site: Similajau) shows **Unlocked** ✓
   - **User hasn't passed TPA (35)** → Module 49 shows **Locked** ✓

## Testing Verification

### Test Scenario 1: User Without Any Passed Assessments
1. Login as regular user (no assessments completed)
2. Go to Training Modules dashboard
3. **Expected:** All on-site modules show as **LOCKED** ✓

### Test Scenario 2: Pass One TPA Assessment
1. Complete and pass **Similajau TPA assessment (Module 35)**
2. Refresh Training Modules dashboard
3. **Expected:**
   - Module 49 (On-Site: Similajau) shows as **UNLOCKED** ✓
   - All other on-site modules still **LOCKED** ✓

### Test Scenario 3: Pass Multiple TPA Assessments
1. Pass assessments for:
   - Similajau TPA (35)
   - Bako TPA (51)
   - Kubah TPA (36)
2. Refresh dashboard
3. **Expected:** Only matching on-site modules unlock (49, 48, 50) ✓

## Database Verification

The `LinkedTpaModuleID` field exists in the database:

```sql
SELECT ModuleID, ModuleTitle, LinkedTpaModuleID, LinkedOnsiteModuleID
FROM Modules
WHERE ModuleTypeID IN (2, 3);
```

Sample output:
```
| ModuleID | ModuleTitle           | LinkedTpaModuleID | LinkedOnsiteModuleID |
|----------|----------------------|-------------------|----------------------|
| 35       | Similajau TPA        | NULL              | 49                   |
| 49       | On-Site: Similajau   | 35                | NULL                 |
| 51       | Bako TPA             | NULL              | 48                   |
| 48       | On-Site: Bako        | 51                | NULL                 |
```

## Related Components

### Frontend Fix (Already Applied)
- File: `frontend/App.js`
- Change: On-site module unlock logic updated to require actual prerequisite (not optional)
- Before: `unlocked = !prerequisiteModuleId || passedModuleIds.has(...)`
- After: `unlocked = prerequisiteModuleId ? passedModuleIds.has(...) : false`

### Admin Endpoints (No Changes Needed)
- `GET /api/v1/admin/modules` already returns `linkedTpaModuleId`
- Admin users already see correct module relationships

## Performance Impact

- ✅ No performance degradation (fields already exist in database)
- ✅ No additional queries (fields added to existing queries)
- ✅ Same network payload (two additional small integer fields)

## Debugging

If on-site modules are still not locking/unlocking correctly after this fix:

1. **Check API response** (Browser Dev Tools):
   ```javascript
   // Network tab → fetch call to /api/v1/modules/dashboard
   // Response should include: "linkedTpaModuleId": 35
   ```

2. **Check frontend module object** (React DevTools):
   ```javascript
   // Inspect module props
   // Should have: linkedTpaModuleId: 35
   ```

3. **Check assessment tracking** (Browser Console):
   ```javascript
   // User should have passed modules in passedModuleIds Set
   // If TPA was passed, module ID should be in the Set
   ```

## Rollback (if needed)

Simply remove the two fields from the SQL queries and response mapping. However, this is the correct implementation and should remain.

## Deployment Notes

- ✅ No database migration needed (columns already exist)
- ✅ Backward compatible (nullable fields)
- ✅ Ready for immediate deployment
- ✅ Can be deployed without frontend changes (frontend can handle null values)
