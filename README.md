# Innopapp Basic App (Node.js + Express + MariaDB)

This project is a basic full-stack starter for innopappserver.xyz with role-based admin accounts.

It includes:
- Public API endpoints for mobile users to read published data
- Admin login with JWT authentication
- Role-based users table (multiple admin accounts)
- Admin-only create/update/delete endpoints for posts
- Admin endpoint to create additional admin accounts
- MariaDB integration using mysql2
- Apache2 reverse proxy support
- Cloudflare Tunnel deployment support for environments without public IPv4
- React Native frontend scaffold in frontend/
- Optional web demo in public/

## Tech Stack

- Node.js + Express
- MariaDB (via mysql2)
- JWT auth (jsonwebtoken)
- Password hashing (bcryptjs)

## Project Structure

- src/server.js: app startup and graceful shutdown
- src/app.js: middleware + route wiring
- src/config/: environment and database config
- src/routes/: API route definitions
- src/controllers/: API handler logic
- src/middleware/: auth, validation, error handlers
- frontend/: React Native (Expo) frontend client
- public/: responsive frontend demo
- database/schema.sql: roles, users, and posts tables
- database/create_database.sql: create database + load schema
 - scripts/: backup and restore helpers (no seed script provided)

## Quick Start

1. Install dependencies:

~~~bash
npm install
~~~

2. Create environment file:

Create a file named .env in the project root.

3. Update .env values:

- DB_HOST
- DB_PORT
- DB_USER
- DB_PASSWORD
- DB_NAME
- JWT_SECRET
- TRUST_PROXY
- REQUEST_BODY_LIMIT (optional, default 15mb)

4. Initialize database (MariaDB):

From the database folder:

~~~sql
SOURCE create_database.sql;
~~~

Or run directly against your chosen DB:

~~~sql
SOURCE schema.sql;
~~~

5. Seed first admin account:

There is no automatic seed script included. Create the first admin by inserting a user
row directly into the database or via an admin creation endpoint if available.

Example SQL (adjust column names to match your schema):

~~~sql
INSERT INTO Users (Username, PasswordHash, RoleID, Status)
VALUES ('admin', '<bcrypt-hash>', 1, 'Active');
~~~

6. Start server:

~~~bash
npm run dev
~~~

7. Open:

~~~text
http://localhost:3000/api/health
~~~

## Minimal Steps If Apache2 + Cloudflare Tunnel Already Work

If your Apache2 reverse proxy and Cloudflare Tunnel are already running correctly, you only need to do this on top:

1. Update backend env values:
- TRUST_PROXY=1
- SERVE_STATIC_CLIENT=0
- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
- JWT_SECRET

2. Ensure Apache still proxies to your Node API process on localhost:3000.

3. Initialize MariaDB schema:

~~~sql
SOURCE database/create_database.sql;
~~~

4. Create the first admin account:

~~~bash
npm run seed:admin -- admin StrongPassword123!
~~~

5. Start or restart API process:

~~~bash
pm2 restart innopapp-api
~~~

6. Confirm API through your tunnel domain:

~~~text
https://innopappserver.xyz/api/health
~~~

7. Build and run the React Native app from frontend/ (see section below).

## React Native Frontend (frontend/)

This repository now includes an Expo-based React Native client at frontend/.

1. Prepare frontend env:

~~~bash
cd frontend
~~~

Create a file named .env in frontend/ with:

~~~text
EXPO_PUBLIC_API_BASE_URL=https://api.innopappserver.xyz
~~~

2. Set API base URL in frontend/.env:
- EXPO_PUBLIC_API_BASE_URL=https://api.innopappserver.xyz

3. Install and run mobile app:

~~~bash
npm install
npm run start
~~~

From repo root, you can also run:

~~~bash
npm run mobile:start
~~~

The mobile app supports:
- Public post read
- Admin login
- Admin post create/update/delete
- Admin account create/list

## Raspberry Pi OS (64-bit) Deployment (Apache2 + Cloudflare Tunnel)

This deployment path assumes:
- Apache2 hosts the app locally on your Raspberry Pi
- Cloudflare Tunnel publishes your domain(s) securely
- You do not need a public IPv4 address

### 1. Install required services

~~~bash
sudo apt update
sudo apt install -y nodejs npm apache2
~~~

Install cloudflared (official package):

~~~bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install -y cloudflared
~~~

### 2. Run app with PM2 and systemd

~~~bash
sudo npm install -g pm2
cd /home/xavier/COS30049InnoProj
npm install
sudo install -Dm644 systemd/innopapp-api.service /etc/systemd/system/innopapp-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now innopapp-api.service
~~~

This service runs PM2 in the foreground with `pm2-runtime`, so systemd keeps the API alive across reboots and restarts it if the process exits.

### 3. Configure .env for proxy/tunnel mode

Set these important values:
- TRUST_PROXY=1
- CORS_ORIGIN includes your public app domain(s)
- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
- JWT_SECRET

Then restart app:

~~~bash
pm2 restart innopapp-api
~~~

### 4. Configure Apache2 reverse proxy

Enable needed modules:

~~~bash
sudo a2enmod proxy proxy_http headers rewrite
~~~

Create Apache site config:

~~~bash
sudo tee /etc/apache2/sites-available/innopapp.conf >/dev/null <<'EOF'
<VirtualHost *:80>
    ServerName api.innopappserver.xyz

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"
</VirtualHost>
EOF

sudo a2ensite innopapp.conf
sudo systemctl reload apache2
~~~

### 5. Configure Cloudflare Tunnel

1. Authenticate cloudflared:

~~~bash
cloudflared tunnel login
~~~

2. Create tunnel:

~~~bash
cloudflared tunnel create innopapp-tunnel
~~~

3. Create DNS routes:

~~~bash
cloudflared tunnel route dns innopapp-tunnel innopappserver.xyz
# Optional dedicated API subdomain
cloudflared tunnel route dns innopapp-tunnel api.innopappserver.xyz
~~~

4. Create /etc/cloudflared/config.yml:

~~~bash
sudo tee /etc/cloudflared/config.yml >/dev/null <<'EOF'
tunnel: your-tunnel-uuid
credentials-file: /etc/cloudflared/your-tunnel-uuid.json

ingress:
  - hostname: innopappserver.xyz
    service: http://localhost:80
  - hostname: api.innopappserver.xyz
    service: http://localhost:80
  - service: http_status:404
EOF
~~~

5. Install tunnel as service:

~~~bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
~~~

### 6. Domain options

Option A (simplest):
- Use innopappserver.xyz for both frontend and API routes (/api/...)

Option B (clean separation):
- Keep frontend on innopappserver.xyz
- Use api.innopappserver.xyz for API
- Add api.innopappserver.xyz to CORS_ORIGIN

With Cloudflare Tunnel, DNS can point through the tunnel route and does not require a public IPv4 on your Raspberry Pi.

## Important Security Notes

- Keep projdb.innopappserver.xyz private to DB access only. Do not expose MariaDB publicly unless firewall-restricted.
- Keep JWT_SECRET long and random.
- Use strong admin passwords.
- Restrict MariaDB user permissions to only the appdb database.
- Restrict Apache to local reverse proxy use only; do not expose MariaDB ports through tunnel ingress.
- In Cloudflare SSL/TLS settings, use Full (strict) when you later add an origin certificate.

## Notes for Mobile Clients

- For browser-based mobile apps, add client origins in CORS_ORIGIN.
- Native React Native apps can call HTTPS API directly.
- If you use api.innopappserver.xyz, set CORS_ORIGIN accordingly.