# Rich Content Module (Portable)

This module adds:
- Rich text storage (bold, italic, lists, links, etc.)
- File/image attachments
- Server-side folder storage ("local cloud")
- Database persistence for text and file metadata

## Folder Layout

- `backend/`: Express routes/controllers/services for rich content APIs
- `db/`: SQL schema for module tables
- `frontend/demo.html`: Quill-based demo input page

## API Endpoints

- `GET /api/v1/rich-content`
- `GET /api/v1/rich-content/:contentId`
- `POST /api/v1/rich-content` (`multipart/form-data`, file field name: `files`)

## Required NPM Packages

- `multer`
- `sanitize-html`

Install:

```bash
npm install multer sanitize-html
```

## Database Setup

Run:

```sql
source feature_modules/rich-content/db/rich_content_schema.sql;
```

Or copy SQL statements into your migration workflow.

## Server Storage Setup

By default, files are saved in:

- `storage/rich-content/`

Optional environment variables:

- `RICH_CONTENT_STORAGE_DIR` (absolute/relative custom folder path)
- `RICH_CONTENT_MAX_FILE_SIZE_MB` (default: 10)

Upload defaults:

- Maximum files per request: `10`
- Allowed MIME types: images, PDF, txt, Word, Excel, PowerPoint, zip

## Demo Page

Accessible at:

- `/rich-content-demo`

Requirements:
- Use a valid JWT in demo input (User/Admin role)
- Enter title + rich content + optional files

## Porting To Other Branches

1. Copy `feature_modules/rich-content/`
2. Ensure `multer` and `sanitize-html` are installed
3. Add env config keys in your config loader
4. Mount router + static routes in your app entry
5. Run the SQL schema file

