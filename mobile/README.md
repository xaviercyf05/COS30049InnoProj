# Innopapp Mobile (React Native)

This is an Expo-based React Native client for the Innopapp backend API.

## 1. Configure API base URL

Create .env in this folder with:

```text
EXPO_PUBLIC_API_BASE_URL=https://api.innopappserver.xyz
```

Set EXPO_PUBLIC_API_BASE_URL to your public API URL.

Example:
- EXPO_PUBLIC_API_BASE_URL=https://api.innopappserver.xyz

## 2. Install and run

```bash
npm install
npm run start
```

From repo root, you can also run:

```bash
npm run mobile:start
```

## 3. What this app supports

- Health check via /health
- Public qualification list via /api/v1/qualifications
- Admin login via /api/v1/auth/login
- Admin qualification creation via /api/v1/admin/qualifications
- Admin announcement creation via /api/v1/admin/announcements
- Admin user list and status updates via /api/v1/admin/users and /api/v1/admin/users/:id/status

## 4. Important notes

- Native mobile requests are not blocked by browser CORS rules.
- Keep your backend HTTPS endpoint reachable through your Cloudflare Tunnel domain.
