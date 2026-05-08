# On-Site Module Access Control Fix - Implementation Summary

## Problem Identified

### Root Cause: Incorrect Prerequisite Matching
The frontend was using **array index matching** to find prerequisite modules instead of using the actual `linkedTpaModuleId` from the database. This caused:

**Before Fix:**
```javascript
// WRONG: Uses array position instead of actual relationship
if (stage === 'on-site') {
    const trackIndex = onSiteModules.findIndex(
        (onSiteModule) => String(onSiteModule.moduleId) === String(module.moduleId)
    );
    prerequisiteModuleId = parkSpecificModules[trackIndex]?.moduleId ?? null;  // ❌ Index-based
}
```

**Example of the bug with your data:**
- User passes assessment for Module 35 (Similajau TPA)
- System incorrectly unlocks Module 49 (On-Site: Similajau) ✓ Correct by chance
- BUT if module order changes in database, user might unlock Module 48 (On-Site: Bako) ❌ Wrong!

This is because the code assumed `onSiteModules` and `parkSpecificModules` arrays maintain the same index ordering, which isn't guaranteed.

## Solution Implemented

### Fix 1: Use Actual Database Relationships ✅
```javascript
// CORRECT: Uses actual linkedTpaModuleId from database
if (stage === 'on-site') {
    // Use the linkedTpaModuleId from the module object (database relationship)
    // instead of array index matching to correctly link to the corresponding TPA module
    prerequisiteModuleId = module.linkedTpaModuleId ?? null;  // ✅ Direct relationship
    unlocked = !prerequisiteModuleId || passedModuleIds.has(String(prerequisiteModuleId));
}
```

### Fix 2: Preserve Linking Fields in Module Transformation ✅
Added `linkedTpaModuleId` and `linkedOnsiteModuleId` to the module object during transformation:
```javascript
return {
    // ... existing fields ...
    // Preserve linking relationships from the API response
    linkedTpaModuleId: module.linkedTpaModuleId || null,    // ✅ Now preserved
    linkedOnsiteModuleId: module.linkedOnsiteModuleId || null,
};
```

### Fix 3: Update Module Type Normalization ✅
Updated `normalizeModuleType()` in `App.js` to handle full database strings:
```javascript
// Now handles:
- "General Modules" → 'general'
- "Total Protected Area Modules" → 'park-specific'
- "On-Site Training Modules" → 'on-site'
```

## Files Modified

| File | Changes |
|------|---------|
| `frontend/App.js` | ✅ Fixed prerequisite checking (use `linkedTpaModuleId`)<br>✅ Preserved linking fields in module transformation<br>✅ Updated `normalizeModuleType()` for full strings |

## Expected Behavior After Fix

### User Journey - Correct Access Control

**Scenario: User passes Bako TPA assessment (Module 51)**

**Before Fix (Bug):**
- System: "Let me find on-site module at index [position of module 51]"
- Result: User unlocked wrong on-site module (depends on array order)

**After Fix (Correct):**
- System: "Module 50 (On-Site: Kubah) has linkedTpaModuleId = 36"
- System: "Module 50 is NOT unlocked (needs module 36, not module 51)" ✓
- User: Cannot access Module 50 (correct)

**Scenario: User passes Similajau TPA assessment (Module 35)**
- System: "Module 49 (On-Site: Similajau) has linkedTpaModuleId = 35"
- System: "User passed module 35, so Module 49 is unlocked" ✓
- User: Can access Module 49 (correct)

## Verification Table

Your test data with correct relationships:

| On-Site Module | TPA Prerequisite | User Passes TPA | Result |
|---|---|---|---|
| 48 (Bako On-Site) | 51 (Bako TPA) | Module 51 | ✅ Unlocks 48 |
| 49 (Similajau On-Site) | 35 (Similajau TPA) | Module 35 | ✅ Unlocks 49 |
| 50 (Kubah On-Site) | 36 (Kubah TPA) | Module 36 | ✅ Unlocks 50 |
| 54 (Gunung Mulu On-Site) | 52 (Gunung Mulu TPA) | Module 52 | ✅ Unlocks 54 |
| 55 (Maludam On-Site) | 53 (Maludam TPA) | Module 53 | ✅ Unlocks 55 |

## How the Access Control Works Now

### Step 1: User passes TPA Assessment
- User completes learning materials for Module 35 (Similajau TPA)
- User takes assessment and passes it
- System: `passedModuleIds` = {35, ...}

### Step 2: Module List Rendered
- App fetches all modules including linking relationships
- For each On-Site module, system checks:
  ```javascript
  prerequisiteModuleId = module.linkedTpaModuleId  // e.g., 35 for module 49
  unlocked = !prerequisiteModuleId || passedModuleIds.has(String(35))  // true
  ```

### Step 3: User Sees Correct Access
- Module 49 (On-Site: Similajau) shows as **Unlocked** ✓
- All other On-Site modules show as **Locked** with message ✓

## Testing Instructions

### Test 1: Verify Lock Status in Module List
1. **Login as a regular user**
2. **Go to Training Modules dashboard**
3. **Expected:**
   - All On-Site modules show as "Locked"
   - Lock message: "Complete and pass the matching Park Specific assessment to unlock this On-Site module."

### Test 2: Pass TPA Assessment and Unlock Correct On-Site Module
1. **Complete and pass Similajau TPA assessment (Module 35)**
2. **Go to Training Modules dashboard (refresh if needed)**
3. **Expected:**
   - Module 49 (On-Site: Similajau) now shows as **Unlocked** ✓
   - Modules 48, 50, 54, 55 still show as **Locked** ✓

### Test 3: Verify Other TPA Assessments Unlock Correct Modules
1. **Pass Bako TPA assessment (Module 51)**
2. **Refresh dashboard**
3. **Expected:**
   - Module 48 (On-Site: Bako) is now **Unlocked** ✓

### Test 4: Multiple Unlocks
1. **Pass assessments for multiple parks:**
   - Similajau TPA (35) → unlocks Similajau On-Site (49)
   - Bako TPA (51) → unlocks Bako On-Site (48)
   - Kubah TPA (36) → unlocks Kubah On-Site (50)
2. **Expected:** Only the corresponding on-site modules are unlocked

### Test 5: Admin Bypass
1. **Login as admin**
2. **Go to Training Modules**
3. **Expected:** All modules show as **Unlocked** regardless of assessment status

## Debug Information

### How to verify the fix is working:
1. **Open browser console (F12)**
2. **In React DevTools**, inspect module objects
3. **Look for:**
   - `linkedTpaModuleId: 35` (for on-site modules)
   - `linkedOnsiteModuleId: 49` (for TPA modules)
   - `unlocked: true/false` (based on prerequisite passed)

### Console logging for debugging:
Add this to `App.js` if needed for debugging:
```javascript
console.debug('Module progression check:', {
    moduleId: module.moduleId,
    moduleType: module.moduleType,
    stage,
    linkedTpaModuleId: module.linkedTpaModuleId,
    unlocked,
    lockReason,
    prerequisiteModuleId,
    prerequisitePassed: passedModuleIds.has(String(prerequisiteModuleId))
});
```

## Related Components

### On-Site Training Assessment
- On-Site modules have **empty assessments** (expected)
- Assessment must be confirmed offline by senior park guide/admin
- Users can **view** on-site module materials after passing prerequisite TPA assessment
- Users **cannot take assessment** (no questions to answer)

### General Module Path
1. User must first pass **General Module** assessment
2. This unlocks all **Park Specific (TPA) Modules**
3. Passing each TPA assessment unlocks its linked **On-Site Module**

## Safety Checks

### What if linkedTpaModuleId is null?
```javascript
prerequisiteModuleId = module.linkedTpaModuleId ?? null;
unlocked = !prerequisiteModuleId || passedModuleIds.has(String(prerequisiteModuleId));
// If linkedTpaModuleId is null: unlocked = true (no prerequisite)
```

### What if a TPA module ID is invalid?
```javascript
passedModuleIds.has(String(invalidId))  // false
// Result: On-Site module stays locked (safe default)
```

## Performance Impact

- ✅ No additional API calls
- ✅ Uses data already loaded from API
- ✅ O(1) lookup instead of O(n) array search
- ✅ More reliable and maintainable

## Rollback (if needed)

If issues arise, revert changes to `App.js`:
1. Remove `linkedTpaModuleId` and `linkedOnsiteModuleId` from module object
2. Restore original array index matching logic
3. However, **this is not recommended** as the current fix is the correct implementation
