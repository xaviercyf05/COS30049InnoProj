# On-Site Training Module to TPA Module Linking Guide

## Overview

This guide explains how to link On-Site Training Modules to Total Protected Area (TPA) Modules in the COS30049 Innovation Project. Each park will have:
- **1 TPA Module** - Contains park-specific materials for theoretical learning
- **1 On-Site Training Module** - Contains park-specific on-site training materials, linked to the corresponding TPA module

## Architecture

### Database Schema

The system uses self-referential foreign keys in the `Modules` table:

```sql
CREATE TABLE Modules (
  ModuleID INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  QualificationID INT UNSIGNED NOT NULL,
  ModuleTitle VARCHAR(160) NOT NULL,
  ModuleTypeID TINYINT UNSIGNED NULL DEFAULT 1,
  LinkedTpaModuleID INT UNSIGNED NULL,      -- For On-Site modules: points to TPA module
  LinkedOnsiteModuleID INT UNSIGNED NULL,   -- For TPA modules: points to On-Site module (reverse lookup)
  -- ... constraints and indexes
);
```

### Module Types

The system supports 3 module types stored in the `ModuleTypes` table:

| ModuleTypeID | TypeName | Purpose |
|---|---|---|
| 1 | General Modules | Park-independent general learning materials |
| 2 | Total Protected Area Modules | Park-specific theoretical materials |
| 3 | On-Site Training Modules | Park-specific on-site training (must be linked to a TPA module) |

## Admin Workflow

### Step 1: Create a TPA Module (Park-Specific)

1. **Navigate to Admin Dashboard** → **Add Module**
2. **Enter Module Details:**
   - Title: e.g., "Kruger National Park - TPA Module"
   - Module Type: Select "Total Protected Area (TPA) Modules"
   - Cover Image: Upload park-specific image
   - Sections: Add park-specific materials (guides, best practices, etc.)
3. **Click Save** - The module is now available as a TPA module

### Step 2: Create an On-Site Training Module (Linked to TPA)

1. **Navigate to Admin Dashboard** → **Add Module**
2. **Enter Module Details:**
   - Title: e.g., "Kruger National Park - On-Site Training Module"
   - Module Type: Select "On Site Training Modules"
   - **NEW: Linked TPA Module:** A selection UI will appear showing all available TPA modules
     - Select the corresponding TPA module (e.g., "Kruger National Park - TPA Module")
   - Cover Image: Upload on-site training image
   - Sections: Add on-site training materials (practical activities, safety protocols, etc.)
3. **Click Save** - The On-Site module is now linked to the TPA module

### Step 3: Manage Module Links (Edit Existing Module)

1. **Navigate to Admin Dashboard** → **Manage Modules**
2. **Select an existing On-Site Training Module**
3. **To Change the TPA Link:**
   - Go to "Module Type" section
   - Under "Linked TPA Module", select a different TPA module
   - Changes are automatically reflected
4. **To Remove the TPA Link:**
   - Change the module type to something other than "On-Site Training Modules"
   - The link will be automatically cleared
5. **Click Save** to persist changes

## System Validations

The system enforces these business rules:

### ✅ Valid Operations
- Creating an On-Site module linked to a TPA module
- Creating a TPA module without any On-Site link (initially)
- Editing an On-Site module to link/unlink a different TPA module
- Changing an On-Site module type (which clears the link)

### ❌ Invalid Operations (Rejected with Error Messages)
- **Saving an On-Site module without a linked TPA module**
  - Error: "Please choose a linked TPA module for this On Site Training Module."
- **Linking an On-Site module to itself**
  - Error: "A module cannot be linked to itself."
- **Linking an On-Site module to another On-Site module**
  - Error: "Linked module must be a Total Protected Area module."
- **Linking a non-On-Site module to a TPA module**
  - Error: "Only On-Site Training Modules can be linked to a TPA module."

## API Endpoints

### Create Module with TPA Link

```http
POST /api/v1/admin/modules
Content-Type: application/json

{
  "title": "Kruger - On-Site Training",
  "moduleType": "on-site",
  "moduleTypeId": 3,
  "linkedTpaModuleId": 5,  // ID of the corresponding TPA module
  "sections": [
    {
      "title": "Section 1",
      "description": "Description",
      "ordering": 1,
      "subsections": [
        {
          "title": "Subsection 1",
          "content": "<p>Content</p>",
          "ordering": 1
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "moduleId": 12,
    "title": "Kruger - On-Site Training",
    "moduleType": "On-Site Training Modules",
    "linkedTpaModuleId": 5,
    "linkedOnsiteModuleId": null,
    "sections": [...]
  }
}
```

### Update Module with TPA Link

```http
PUT /api/v1/admin/modules/12
Content-Type: application/json

{
  "title": "Kruger - On-Site Training (Updated)",
  "linkedTpaModuleId": 6,  // Change to different TPA module
  "sections": [...]
}
```

### Dedicated Link/Unlink Endpoint

```http
PATCH /api/v1/admin/modules/12/link-tpa
Content-Type: application/json

{
  "linkedTpaModuleId": 6  // Set new link, or 0 to clear
}
```

**Response (Link):**
```json
{
  "success": true,
  "message": "Module linked to TPA successfully.",
  "data": {
    "moduleId": 12,
    "linkedTpaModuleId": 6
  }
}
```

**Response (Unlink - using 0):**
```http
PATCH /api/v1/admin/modules/12/link-tpa
Content-Type: application/json

{
  "linkedTpaModuleId": 0  // 0 means clear the link
}
```

```json
{
  "success": true,
  "message": "TPA link cleared successfully.",
  "data": {
    "moduleId": 12,
    "linkedTpaModuleId": null
  }
}
```

### Get Module Details (with Link Info)

```http
GET /api/v1/admin/modules/12
```

**Response:**
```json
{
  "success": true,
  "data": {
    "moduleId": 12,
    "qualificationId": 1,
    "title": "Kruger - On-Site Training",
    "moduleTypeId": 3,
    "moduleType": "On-Site Training Modules",
    "linkedTpaModuleId": 5,           // ← The linked TPA module
    "linkedOnsiteModuleId": null,     // ← Reverse lookup (for TPA → On-Site)
    "sections": [...]
  }
}
```

### List All Modules (with Link Info)

```http
GET /api/v1/admin/modules
```

**Response includes `linkedTpaModuleId` and `linkedOnsiteModuleId` for all modules:**
```json
{
  "success": true,
  "data": [
    {
      "moduleId": 5,
      "title": "Kruger - TPA Module",
      "moduleType": "Total Protected Area Modules",
      "linkedTpaModuleId": null,
      "linkedOnsiteModuleId": 12      // ← Points back to On-Site module
    },
    {
      "moduleId": 12,
      "title": "Kruger - On-Site Training",
      "moduleType": "On-Site Training Modules",
      "linkedTpaModuleId": 5,         // ← Points to TPA module
      "linkedOnsiteModuleId": null
    }
  ]
}
```

## Database Migrations

### Migration 1: Add Module Type Support

**File:** `database/migration_module_type.sql`

Creates the `ModuleTypes` lookup table and adds `ModuleTypeID` column to `Modules` table.

**Tables Created:**
- `ModuleTypes` - Reference table for module classification

**Columns Added:**
- `Modules.ModuleTypeID` - Foreign key to ModuleTypes

### Migration 2: Add Linking Support

**File:** `database/migration_linked_tpa_module.sql`

Adds self-referential foreign keys for module linking.

**Columns Added:**
- `Modules.LinkedTpaModuleID` - Points to the TPA module (for On-Site modules)
- `Modules.LinkedOnsiteModuleID` - Points to the On-Site module (for TPA modules)

**Indexes Created:**
- `idx_modules_linked_tpa` - Optimize queries finding linked TPA modules
- `idx_modules_linked_onsite` - Optimize reverse lookups
- `idx_modules_type_linked_tpa` - Combined index for filtering by type and link
- `idx_modules_type_linked_onsite` - Combined index for reverse filtering

**Automatic Backfill:**
The migration includes safe SQL to automatically link existing modules based on title matching when:
- There is exactly one TPA module with a matching normalized title
- There is exactly one On-Site module with a matching normalized title
- Both modules are in the same qualification

## Implementation Details

### Frontend Components

#### AddModuleScreen.js
- **File:** `frontend/Admin/AddModuleScreen.js`
- **Features:**
  - Create new modules with type selection
  - Conditional TPA module selection UI (appears only for On-Site type)
  - Validation: On-Site modules must have a TPA link before saving
  - Displays list of available TPA modules as selectable buttons
  - Clears link when switching away from On-Site type

#### AdminModuleManagerScreen.js
- **File:** `frontend/Admin/AdminModuleManagerScreen.js`
- **Features:**
  - Edit existing modules
  - Load TPA link from existing module data
  - Change TPA links on existing On-Site modules
  - Type switching with automatic link management
  - Same validation and UI as AddModuleScreen

### Backend Components

#### Module Admin Controller
- **File:** `src/controllers/moduleAdminController.js`
- **Functions:**
  - `getModuleTypes()` - Returns available module types
  - `createModule()` - Create module with optional TPA link
  - `updateModule()` - Update module and manage TPA link
  - `linkModuleToTpa()` - Dedicated endpoint for linking/unlinking
  - `listModules()` - List all modules with link information
  - `getModuleById()` - Get module details with link information

#### Admin Routes
- **File:** `src/routes/v1/adminRoutes.js`
- **Routes:**
  - `GET /admin/modules/types` - Get available module types
  - `POST /admin/modules` - Create module (accepts `linkedTpaModuleId`)
  - `PUT /admin/modules/:moduleId` - Update module (accepts `linkedTpaModuleId`)
  - `PATCH /admin/modules/:moduleId/link-tpa` - Link/unlink module
  - `GET /admin/modules` - List all modules
  - `GET /admin/modules/:moduleId` - Get module details

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Admin Dashboard                             │
└────────┬──────────────────────────────────────────────────┬─────┘
         │                                                  │
         ▼                                                  ▼
    ┌─────────────────┐                           ┌──────────────────┐
    │  Add Module     │                           │  Manage Modules  │
    │  (Create New)   │                           │  (Edit Existing) │
    └────────┬────────┘                           └────────┬─────────┘
             │                                             │
             ├──────────────────┬──────────────────────────┤
             │                  │                          │
      Step 1: Select Type    Step 1: Load Module      Step 2: Edit
             │                  │                          │
             ▼                  ▼                          ▼
      ┌─────────────────────────────────────────────────────────┐
      │  Module Type Selection UI (3 options)                    │
      │  1. General Modules                                      │
      │  2. Total Protected Area (TPA) Modules                   │
      │  3. On Site Training Modules                             │
      └────────┬────────────────────────┬───────────────────────┘
               │                        │
         Not "On-Site"            Is "On-Site"
               │                        │
               ▼                        ▼
        ┌────────────────────┐  ┌──────────────────────────┐
        │ (No TPA UI shown)   │  │ TPA Module Selection UI  │
        │ linkedTpaModuleId   │  │ (Shows all TPA modules)  │
        │ remains NULL        │  │ Select one → Update state│
        └────────────────────┘  └──────────────────────────┘
                                        │
                                        ▼
                            linkedTpaModuleId = <ID>
                                        │
                            ┌───────────┴──────────────┐
                            │ Validation               │
                            │ if On-Site &&            │
                            │    linkedTpaModuleId     │
                            │    is NULL, reject       │
                            └───────────┬──────────────┘
                                        │
                                        ▼
                                  Submit via API
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             │                                                     │
             ▼                                                     ▼
        POST /api/v1/admin/modules                   PUT /api/v1/admin/modules/:id
        (Create)                                     (Update)
             │                                                     │
             ▼                                                     ▼
    ┌────────────────────────────────┐              ┌──────────────────────────┐
    │ moduleAdminController.          │              │ moduleAdminController.   │
    │ createModule()                  │              │ updateModule()           │
    │                                 │              │                          │
    │ • Validate on-site link req.    │              │ • Validate on-site link  │
    │ • Insert to Modules table       │              │ • Update Modules table   │
    │ • Return full module object     │              │ • Manage linkedTpaId     │
    └────────────────────────────────┘              └──────────────────────────┘
             │                                                     │
             ▼                                                     ▼
    ┌────────────────────────────────────────────────────────────┐
    │  Modules Table (Database)                                  │
    │  - ModuleID                                                │
    │  - ModuleTitle                                             │
    │  - ModuleTypeID (1=General, 2=TPA, 3=On-Site)              │
    │  - LinkedTpaModuleID ← Set for On-Site modules only        │
    │  - LinkedOnsiteModuleID ← Maintained for TPA modules       │
    └────────────────────────────────────────────────────────────┘
             │
             └──> Return to Frontend
                  linkedTpaModuleId populated in response
                  Refresh module library
                  Show success message
```

## Best Practices

### For Admins

1. **Create TPA Modules First**
   - Before creating On-Site modules, ensure corresponding TPA modules exist
   - Use consistent naming: e.g., "Kruger NP - TPA Module" and "Kruger NP - On-Site Training"

2. **Validate Links Regularly**
   - Use "Manage Modules" to verify On-Site modules are properly linked
   - Check that `linkedTpaModuleId` is not NULL for all On-Site modules

3. **Backup Before Major Changes**
   - Before bulk linking or unlinking, backup your database
   - Use the database backup scripts provided

### For Developers

1. **Query Module Links Efficiently**
   - Use the composite indexes: `idx_modules_type_linked_tpa`, `idx_modules_type_linked_onsite`
   - Example: `SELECT * FROM Modules WHERE ModuleTypeID = 3 AND LinkedTpaModuleID IS NOT NULL`

2. **Handle Cascade Deletions**
   - When a TPA module is deleted, the link is set to NULL (not cascading delete)
   - This prevents data loss and allows recovery if needed

3. **Validate Data Integrity**
   - Periodically check: `SELECT * FROM Modules WHERE ModuleTypeID = 3 AND LinkedTpaModuleID IS NULL`
   - This returns On-Site modules without proper links (should be empty after migration)

## Troubleshooting

### On-Site Module Creation Fails with "Please choose a linked TPA module..."

**Cause:** You selected "On Site Training Modules" but didn't select a TPA module.

**Solution:**
1. Ensure at least one TPA module exists in the system
2. Click the refresh button to reload module library
3. Select "On Site Training Modules" type
4. Click on a TPA module in the selection UI
5. Try saving again

### TPA Module Selection Shows "No TPA modules available"

**Cause:** No TPA modules have been created yet, or they haven't been classified as type 2 (TPA Modules).

**Solution:**
1. First create a TPA module: Add Module → Select "Total Protected Area (TPA) Modules" → Save
2. Go back to creating On-Site module
3. The newly created TPA module should now appear in the selection list

### Linked On-Site Module Disappears After Changing Type

**Cause:** The system automatically clears the link when you change from "On-Site Training Modules" to another type.

**Solution:**
1. Change back to "On-Site Training Modules"
2. Select the TPA module again
3. Save the changes

This is by design: only On-Site modules can have TPA links.

## Database Queries for Verification

### Check all modules with their types and links:
```sql
SELECT 
  m.ModuleID,
  m.ModuleTitle,
  mt.TypeName as ModuleType,
  m.LinkedTpaModuleId,
  m.LinkedOnsiteModuleId,
  CASE
    WHEN m.LinkedTpaModuleId IS NOT NULL THEN CONCAT('Links to: ', linked_tpa.ModuleTitle)
    WHEN m.LinkedOnsiteModuleId IS NOT NULL THEN CONCAT('Has On-Site: ', linked_onsite.ModuleTitle)
    ELSE 'No links'
  END as LinkStatus
FROM Modules m
LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
LEFT JOIN Modules linked_tpa ON linked_tpa.ModuleID = m.LinkedTpaModuleId
LEFT JOIN Modules linked_onsite ON linked_onsite.ModuleID = m.LinkedOnsiteModuleId
ORDER BY m.ModuleTypeID, m.ModuleID;
```

### Find On-Site modules without TPA links (should be empty):
```sql
SELECT * FROM Modules m
LEFT JOIN ModuleTypes mt ON mt.ModuleTypeID = m.ModuleTypeID
WHERE mt.TypeName = 'On-Site Training Modules'
AND m.LinkedTpaModuleId IS NULL;
```

### Find TPA modules with On-Site counterparts:
```sql
SELECT 
  tpa.ModuleID as TPAModuleID,
  tpa.ModuleTitle as TPAModuleTitle,
  onsite.ModuleID as OnsiteModuleID,
  onsite.ModuleTitle as OnsiteModuleTitle
FROM Modules tpa
LEFT JOIN Modules onsite ON onsite.LinkedTpaModuleId = tpa.ModuleID
LEFT JOIN ModuleTypes tpaType ON tpaType.ModuleTypeID = tpa.ModuleTypeID
WHERE tpaType.TypeName = 'Total Protected Area Modules'
ORDER BY tpa.ModuleID;
```

## Related Documentation

- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Complete API reference
- [IMPLEMENTATION_MANIFEST.md](IMPLEMENTATION_MANIFEST.md) - Feature implementation checklist
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Initial project setup
- [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md) - Technical architecture
