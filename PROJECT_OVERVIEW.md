# Digital Park Guide Training Platform - Project Overview

## Executive Summary

The Digital Park Guide Training Platform is a role-based learning and operations system for park guide training, assessment, and administrative management. The current codebase centers on a Node.js + Express API with a MariaDB backend, a React Native frontend, and a separate rich-content feature module for authenticated content publishing with file attachments.

The platform supports public qualification browsing, authenticated learning workflows, assessment submission and grading, JWT-based login flows, MFA and passkey support, notifications, badge management, sensor log ingestion, evidence uploads, and admin management screens.

## Current Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express.js 5 |
| Database | MariaDB / MySQL via mysql2 |
| Authentication | JWT, bcryptjs |
| Validation | express-validator |
| Security | helmet, cors |
| Logging | morgan |
| File Uploads | multer |
| Rich Content Sanitization | sanitize-html |
| Email | nodemailer |
| MFA / Passkeys | speakeasy, @simplewebauthn/server, qrcode |
| Frontend | Expo / React Native |

## Architecture

The backend follows a route → controller → service → database structure:

Request → Route → Validation / Middleware → Controller → Service → Database

The main application entry points are:
- [src/app.js](src/app.js) for middleware, static assets, route registration, and health checks
- [src/server.js](src/server.js) for server startup and graceful shutdown

## Core Backend Capabilities

### Authentication and Account Access

The backend supports login with username/password, recovery-code login, passwordless email login, passkey authentication, password reset, email verification, JWT refresh, MFA setup and verification, and role-aware route protection for `User` and `Admin` accounts.

### Learning and Progression

Users can browse qualifications, enroll, view module details, read learning materials, mark materials complete, track module progress, and submit assessments. The learning flow is driven by the qualification, module, material, and assessment services.

### Notifications and Badges

Notification routes expose the authenticated user’s notifications and announcement feed. Badge routes expose the current user’s earned badges, while the admin side can create, update, delete, and issue badges, and link them to modules or assessments.

### Rich Content Module

The `feature_modules/rich-content` package adds authenticated content creation with attachment uploads, HTML sanitization, content retrieval, and list views. This is a separate feature module rather than a standard route file under `src/routes`.

### Sensor and Evidence Handling

The codebase includes public device ingestion routes for ESP32 sensor logs and evidence clips, plus admin dashboards and status management for sensor alerts and evidence review.

### Admin Management

Admin routes cover qualifications, announcements, users, enrollments, evidence, sensor logs, payments, registrations, modules, badges, and assessments. The admin controller and related feature controllers also support operational workflows such as CSV uploads, module cover uploads, and dashboard summaries.

## API Surface

The API is mounted under `/api/v1` and is documented in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

Major route groups:
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

Health checks are available at `/health` and `/api/health`.

## Testing

The repository now includes a backend-focused automated test suite using Node’s built-in test runner.

- Root backend tests: `npm test`
- Frontend tests: `npm --prefix frontend test`

The backend suite covers configuration parsing, middleware behavior, authentication middleware, sensor key validation, rich-content storage and service logic, route-level health behavior, and JWT refresh-token flows.

## Deployment Notes

The project supports multiple deployment modes:
- Local API development with `npm run dev`
- API-only mode for mobile deployments using `SERVE_STATIC_CLIENT=0`
- Apache2 reverse proxy deployments
- Cloudflare Tunnel deployments for environments without public IPv4

The current documentation set also includes [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) and [TECHNICAL_REFERENCE.md](TECHNICAL_REFERENCE.md).

## Project Structure

```text
src/
├── app.js
├── server.js
├── config/
├── controllers/
├── middleware/
├── routes/
├── services/
└── utils/

feature_modules/
└── rich-content/

frontend/
├── App.js
├── index.js
├── Admin/
├── auth/
└── ...

database/
├── schema.sql
└── create_database.sql

scripts/
└── backup / restore helpers

systemd/
└── service and timer units
```

## Notes

- The current codebase no longer uses the older posts-centric demo described in earlier documentation.
- The backend now focuses on training, assessments, rich content, notifications, badges, and operational admin workflows.