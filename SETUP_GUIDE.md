# Setup & Troubleshooting Guide

## Prerequisites

- **Node.js**: v14 or higher (check with `node -v`)
- **MySQL**: v5.7 or higher running locally (check with `mysql --version`)
- **npm**: comes with Node.js (check with `npm -v`)
- **Terminal/Command Prompt**: For running commands

---

## Part 1: Database Setup

### Step 1: Start MySQL Service

**Windows (Command Prompt as Administrator):**
```bash
net start MySQL80
```

**macOS (if installed via Homebrew):**
```bash
brew services start mysql
```

**Linux (Ubuntu/Debian):**
```bash
sudo systemctl start mysql
```

### Step 2: Connect to MySQL

```bash
mysql -u root -p
```

When prompted, enter your MySQL root password (default is often blank for fresh installs).

### Step 3: Create Database

Run this command in MySQL shell:

```sql
CREATE DATABASE IF NOT EXISTS digital_park_guide DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Verify creation:
```sql
SHOW DATABASES;
```

You should see `digital_park_guide` in the list.

### Step 4: Exit MySQL

```sql
exit
```

### Step 5: Load Schema

From your project root directory:

```bash
mysql -u root -p digital_park_guide < database/schema.sql
```

Password prompt will appear. Enter your MySQL root password.

**Verify schema was loaded:**
```bash
mysql -u root -p digital_park_guide -e "SHOW TABLES;"
```

You should see 15+ tables including: Users, Roles, Qualifications, Modules, etc.

### Step 6: Create Database User (Optional but Recommended)

For security, create a dedicated database user instead of using root:

```bash
mysql -u root -p
```

Then in MySQL:
```sql
CREATE USER 'park_guide_app'@'localhost' IDENTIFIED BY 'SecurePassword123!';
GRANT ALL PRIVILEGES ON digital_park_guide.* TO 'park_guide_app'@'localhost';
FLUSH PRIVILEGES;
exit
```

Update `src/config/env.js` to use these credentials:
```javascript
DB_USER=park_guide_app
DB_PASSWORD=SecurePassword123!
```

---

## Part 2: Environment Configuration

### Step 1: Create .env File

In the project root (same level as package.json), create a file named `.env`:

**Windows:**
```bash
type nul > .env
```

**macOS/Linux:**
```bash
touch .env
```

### Step 2: Add Environment Variables

Open `.env` and add:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=digital_park_guide

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=12h
JWT_REMEMBER_EXPIRES_IN=7d
JWT_SESSION_REFRESH_EXPIRES_IN=12h

# Optional: increase payload limit for large rich-content module saves
REQUEST_BODY_LIMIT=15mb
```

Replace:
- `your_mysql_password` with your actual MySQL root password (or the database user password if you created one)
- `your_super_secret_jwt_key_change_this_in_production` with a secure random string
- `JWT_REMEMBER_EXPIRES_IN` to change the persistent login duration
- `JWT_SESSION_REFRESH_EXPIRES_IN` to change the non-persistent session refresh window

### Step 3: Verify File Was Created

### Step 4: Create the refresh-token table

Run the refresh-token migration after the base schema is installed:

```bash
node scripts/runAuthTokenMigration.js
```

```bash
ls -la .env    # Linux/macOS
dir .env       # Windows
```

You should see the `.env` file listed.

---

## Part 3: Install Dependencies

### Step 1: Install Node Modules

```bash
npm install
```

This reads `package.json` and installs all dependencies. Should take 30-60 seconds.

### Step 2: Verify Installation

```bash
npm list
```

Should show the dependency tree without errors. Key packages:
- express
- mysql2
- jsonwebtoken
- bcryptjs
- express-validator

---

## Part 4: Seed Sample Data

### Step 1: Run Seed Script

```bash
node scripts/seedSampleData.js
```

**Expected Output:**
```
========================================
Starting Sample Data Seeding
========================================

Seeping roles and users...
✓ Created user: guide_john (John Park Guide)
✓ Created user: guide_sarah (Sarah Nature Ranger)
✓ Created user: guide_mike (Mike Conservation Expert)

Seeding qualifications...
✓ Created qualification: Sarawak National Park Guide Certification
✓ Created qualification: Forest Biodiversity Specialist
✓ Created qualification: Eco-Tourism Management

Seeding modules...
✓ Created module: Module 1: Conservation Fundamentals
✓ Created module: Module 2: Biodiversity Deep Dive
✓ Created module: Module 3: Advanced Park Management

Seeding learning materials...
✓ Created 15 learning materials (5 per module section)

Seeding assessments...
✓ Created assessment for Module 1
✓ Created assessment for Module 2
✓ Created assessment for Module 3

Seeding sample schedules...
✓ Created schedule for user 3: Module 1 Theory Session
✓ Created schedule for user 3: Field Trip - Forest Walk
...

========================================
✓ Sample Data Seeding Complete!
========================================

Test User Credentials:
  - Username: guide_john | Password: guide_john123
  - Username: guide_sarah | Password: guide_sarah123
  - Username: guide_mike | Password: guide_mike123

You can now test the API using these credentials.
```

### Step 2: If Errors Occur

**Error: "Database not found"**
- Ensure `digital_park_guide` database exists (see Part 1, Step 5)
- Check DB credentials in `.env` file

**Error: "Access denied for user 'root'@'localhost'"**
- .env password doesn't match your actual MySQL password
- Either update `.env` or reset your MySQL password

**Error: "Table doesn't exist"**
- Schema wasn't loaded properly
- Re-run: `mysql -u root -p digital_park_guide < database/schema.sql`

---

## Part 5: Start the Server

### Step 1: Run in Development Mode

```bash
npm run dev
```

**Expected Output:**
```
[nodemon] 3.0.2
[nodemon] to restart at any time, type `rs`
[nodemon] watching path(s): src/**/*
[nodemon] watching extensions: js,json
Server running on port 5000
Database connection successful
```

The server is now running on `http://localhost:5000`

### Step 2: Verify Server is Running

Open a new terminal window and run:

```bash
curl http://localhost:5000/health
```

Response should be:
```json
{
  "status": "Server is running"
}
```

### Step 3: Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

---

## Part 6: Quick Test

### Test 1: Login

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "guide_john",
    "password": "guide_john123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "userId": 3,
      "username": "guide_john",
      "role": "User"
    }
  },
  "message": "Login successful"
}
```

### Test 2: Browse Qualifications (No Auth Required)

```bash
curl http://localhost:5000/api/v1/qualifications
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "qualificationId": 1,
      "qualificationName": "Sarawak National Park Guide Certification",
      "moduleCount": 3,
      "status": "Active"
    }
  ],
  "message": "Qualifications retrieved successfully"
}
```

If both tests pass, your API is working!

---

## Troubleshooting

### Issue 1: "Cannot find module 'express'"

**Cause:** npm dependencies not installed

**Solution:**
```bash
npm install
```

### Issue 2: "ECONNREFUSED: Connection refused on 127.0.0.1:3306"

**Cause:** MySQL is not running

**Solution:**
- **Windows:** Open Services and ensure MySQL80 is running
- **macOS:** Run `brew services start mysql`
- **Linux:** Run `sudo systemctl start mysql`

### Issue 3: "ER_ACCESS_DENIED_ERROR: Access denied for user 'root'@'localhost'"

**Cause:** Wrong database password in `.env`

**Solution:**
1. Check your actual MySQL password
2. Update `.env` with correct password
3. Restart the server

### Issue 4: "ER_UNKNOWN_CHARACTER_SET: Unknown character set 'utf8mb4charset'"

**Cause:** Old MySQL version

**Solution:** Upgrade MySQL to v5.7+ or modify schema.sql charset to 'utf8'

### Issue 5: "Tables already exist" error when seeding

**Cause:** Reran schema setup on existing database

**Solution:**
```bash
mysql -u root -p digital_park_guide -e "DROP TABLE IF EXISTS Announcements, AssessmentOptions, AssessmentQuestions, Assessments, AssessmentAttempts, Certificates, LearningMaterials, MaterialProgress, Modules, Qualifications, Notifications, ScheduleEvents, Schedules, Users, Roles;"
mysql -u root -p digital_park_guide < database/schema.sql
```

### Issue 6: Port 5000 already in use

**Cause:** Another application is using port 5000

**Solution Option 1:** Change the port in `.env`
```env
PORT=5001
```

**Solution Option 2:** Find and kill the process using port 5000
- **Windows:** `netstat -ano | findstr :5000` then `taskkill /PID <PID>`
- **macOS/Linux:** `lsof -i :5000` then `kill -9 <PID>`

### Issue 7: "TypeError: Cannot read property 'end' of undefined"

**Cause:** Database connection not established

**Solution:**
1. Verify .env has correct DB credentials
2. Verify MySQL is running
3. Verify database exists: `mysql -u root -p -e "SHOW DATABASES;"`

### Issue 8: JWT token errors when calling protected endpoints

**Cause:** Missing or malformed token header

**Solution:** Include header exactly as shown:
```bash
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Make sure there's a space between "Bearer" and the token.

### Issue 9: "Validation error: 'X' is not allowed to be empty"

**Cause:** Required field is missing from request body

**Solution:** Check endpoint documentation in TESTING_GUIDE.md and include all required fields

### Issue 10: "Qualification not found" when enrolling

**Cause:** Seed data wasn't loaded properly

**Solution:**
```bash
node scripts/seedSampleData.js
```

---

## Environment Checklist

Before starting development, verify:

- [ ] MySQL is installed and running
  ```bash
  mysql -u root -p -e "SELECT VERSION();"
  ```

- [ ] Database exists
  ```bash
  mysql -u root -p -e "SHOW DATABASES;" | grep digital_park_guide
  ```

- [ ] Schema is loaded (15+ tables)
  ```bash
  mysql -u root -p digital_park_guide -e "SHOW TABLES;" | wc -l
  ```

- [ ] Node.js is installed
  ```bash
  node -v
  ```

- [ ] npm dependencies are installed
  ```bash
  npm list | head -5
  ```

- [ ] .env file exists with correct values
  ```bash
  cat .env
  ```

- [ ] Sample data is seeded
  ```bash
  mysql -u root -p digital_park_guide -e "SELECT COUNT(*) as user_count FROM Users;"
  ```
  Should show 4+ (1 admin + 3 test users)

---

## Development Workflow

### Daily Startup

1. Ensure MySQL is running
2. Start the server: `npm run dev`
3. Test with: `curl http://localhost:5000/health`

### Making Changes

1. Edit code in `src/` directory
2. Server auto-reloads (nodemon watches files)
3. Test with curl or TESTING_GUIDE.md examples

### Debugging

Check these logs:
- **Server logs:** Terminal where `npm run dev` is running
- **Database logs:** MySQL error log (location depends on OS)
- **Browser console:** If using web client

### Database Inspection

```bash
# Connect to database
mysql -u root -p digital_park_guide

# View user data
SELECT UserID, Username, FullName, Status FROM Users;

# View qualifications
SELECT * FROM Qualifications;

# View enrollments
SELECT * FROM Certificates;

# Exit
exit
```

### Reset to Fresh State

If you mess up the database and want to start over:

```bash
mysql -u root -p
DROP DATABASE digital_park_guide;
exit
mysql -u root -p digital_park_guide < database/schema.sql
node scripts/seedSampleData.js
npm run dev
```

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a cryptographically secure value
- [ ] Change DB password to a strong password
- [ ] Set NODE_ENV=production in .env
- [ ] Use environment-specific database (separate from development)
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable logging and monitoring
- [ ] Run security audit (check for SQL injection, XSS, etc.)
- [ ] Load test with production-like data volume
- [ ] Document deployment procedures

---

## Getting Help

If you encounter issues:

1. **Check logs:** Look at terminal output and server startup messages
2. **Verify prerequisites:** MySQL running, .env correct, dependencies installed
3. **Test connectivity:** `mysql -u root -p` and `curl http://localhost:5000/health`
4. **Reset and retry:** If all else fails, see "Reset to Fresh State" above
5. **Check documentation:** Review TESTING_GUIDE.md and API_DOCUMENTATION.md
