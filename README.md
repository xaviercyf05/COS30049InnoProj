# Digital Park Guide Training Platform

Digital Park Guide Training Platform is a Node.js + Express application for training park guides, tracking qualification progress, managing assessments, handling announcements and notifications, and supporting admin workflows. The repository also includes an Expo-based React Native client and a separate rich-content module for authenticated content publishing with file attachments.

For the endpoint-by-endpoint API reference, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md). For a compact system summary, see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

## What’s Included

- JWT login, refresh, password reset, email verification, MFA, and passkey flows
- Qualification, module, material, assessment, badge, and notification APIs
- Rich content creation and retrieval with attachment uploads
- Sensor log ingestion and evidence clip uploads for device workflows
- Admin dashboards and management routes for users, registrations, modules, assessments, badges, evidence, and analytics
- Backend automated tests using `node --test`
- Expo React Native frontend under `frontend/`

## Tech Stack

- Node.js + Express 5
- MariaDB / MySQL via `mysql2`
- JWT auth with `jsonwebtoken`
- Password hashing with `bcryptjs`
- Request validation with `express-validator`
- Security middleware with `helmet` and `cors`
- Upload handling with `multer`
- HTML sanitization with `sanitize-html`
- Email delivery with `nodemailer`
- MFA / passkey support with `speakeasy`, `qrcode`, and `@simplewebauthn/server`
- Expo / React Native frontend

## Project Layout

- `src/` - backend API, middleware, controllers, services, and utilities
- `feature_modules/rich-content/` - standalone rich-content feature module
- `frontend/` - Expo React Native frontend and its tests
- `database/` - schema and database creation scripts
- `scripts/` - backup and restore helpers
- `systemd/` - service and timer units for Linux deployments

## Quick Start

1. Install dependencies at the repository root.

```bash
npm install
```

2. Create a `.env` file in the project root and configure the backend values you need.

Common variables used by the current codebase include:
- `PORT`
- `NODE_ENV`
- `TRUST_PROXY`
- `SERVE_STATIC_CLIENT`
- `CORS_ORIGIN`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REMEMBER_EXPIRES_IN`
- `JWT_SESSION_REFRESH_EXPIRES_IN`
- `REQUEST_BODY_LIMIT`
- `RICH_CONTENT_STORAGE_DIR`
- `RICH_CONTENT_MAX_FILE_SIZE_MB`
- `SENSOR_DEVICE_KEYS`
- `DB_ENCRYPTION_KEY`

3. Create the database schema.

```sql
SOURCE database/create_database.sql;
```

4. Start the backend in development mode.

```bash
npm run dev
```

5. Open the health endpoint to confirm the API is running.

```text
http://localhost:3000/health
```

## Testing

- Run backend tests from the repository root:

```bash
npm test
```

- Run frontend tests separately:

```bash
npm --prefix frontend test
```

## Mobile Frontend

The Expo client lives in `frontend/`.

To run it locally:

```bash
cd frontend
npm install
npm run start
```

Root-level shortcuts are also available:
- `npm run mobile:start`
- `npm run mobile:android`
- `npm run mobile:ios`
- `npm run mobile:web`

## Deployment Notes

The backend supports API-only deployments and reverse-proxy deployments.

- Set `SERVE_STATIC_CLIENT=0` for API-only deployments.
- Use `TRUST_PROXY=1` when running behind Apache2 or Cloudflare Tunnel.
- Configure `CORS_ORIGIN` with the public frontend origin when browser clients call the API.

The repository includes deployment references in [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) and [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md).

## API Groups

The current backend exposes these route groups:

- `/auth`
- `/user`
- `/qualifications`
- `/modules`
- `/assessments`
- `/notifications`
- `/badges`
- `/sensors`
- `/evidence`
- `/rich-content`
- `/admin`

## Notes

- The current codebase is no longer centered on the older posts demo described in earlier documentation.
- There is no root `seed:admin` script in the current `package.json`; initial admin setup should be handled through your chosen database/bootstrap process.