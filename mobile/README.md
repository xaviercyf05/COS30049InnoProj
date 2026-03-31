# Innopapp Mobile (React Native)

This is an Expo-based React Native client for the Innopapp backend API.

## 1. Configure API base URL

Create .env in this folder:

```bash
copy .env.example .env
```

Set:
- EXPO_PUBLIC_API_BASE_URL=https://innopappserver.xyz

If you decide to expose API on api.innopappserver.xyz later, use that URL instead.

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

- Public feed read from /api/posts
- Admin login via /api/admin/login
- Admin post create/update/delete
- Admin account create and list

## 4. Important notes

- Native mobile requests are not blocked by browser CORS rules.
- Keep your backend HTTPS endpoint reachable through your Cloudflare Tunnel domain.
