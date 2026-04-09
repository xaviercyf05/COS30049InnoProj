const bcrypt = require("bcryptjs");
const { query, pool } = require("../src/config/db");

const ADMIN_ID = 1;
const USER_ID = 2;
const ADMIN_ROLE = "Admin";
const USER_ROLE = "User";

async function createRoleIfNotExists(roleID, roleTitle, description) {
  const [existingRoles] = await query(
    "SELECT RoleId FROM Roles WHERE RoleTitle = ? LIMIT 1",
    [roleTitle]
  );

  if (existingRoles.length === 0) {
    await query(
      "INSERT INTO Roles (RoleID, RoleTitle, Description) VALUES (?, ?, ?)",
      [roleID, roleTitle, description]
    );
  }
}

async function createUser(username, password, fullName, email, roleTitle) {
  if (password.length < 8) {
    throw new Error(`Password for ${username} must be at least 8 characters.`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [roleRows] = await query(
    "SELECT RoleId FROM Roles WHERE RoleTitle = ? LIMIT 1",
    [roleTitle]
  );

  if (roleRows.length === 0) {
    throw new Error(`Role "${roleTitle}" does not exist.`);
  }

  const roleId = roleRows[0].RoleId;

  await query(
    `INSERT INTO Users (Username, PasswordHash, FullName, Email, RoleId, Role, IsActive, Status, Progress)
     VALUES (?, ?, ?, ?, ?, ?, 1, 'Active', 0)
     ON DUPLICATE KEY UPDATE
       PasswordHash = VALUES(PasswordHash),
       FullName = VALUES(FullName),
       Email = VALUES(Email),
       RoleId = VALUES(RoleId),
       Role = VALUES(Role),
       IsActive = 1`,
    [username, passwordHash, fullName, email, roleId, roleTitle]
  );

  console.log(`User account upserted for username: ${username} (Role: ${roleTitle})`);
}

async function run() {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminFullName = process.env.ADMIN_FULLNAME;
  const adminEmail = process.env.ADMIN_EMAIL;

  const userUsername = process.env.USER_USERNAME;
  const userPassword = process.env.USER_PASSWORD;
  const userFullName = process.env.USER_FULLNAME;
  const userEmail = process.env.USER_EMAIL;

  // Validate admin credentials
  if (!adminUsername || !adminPassword || !adminFullName || !adminEmail) {
    throw new Error(
      "Missing admin credentials. Please set: ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_FULLNAME, ADMIN_EMAIL"
    );
  }

  // Validate user credentials
  if (!userUsername || !userPassword || !userFullName || !userEmail) {
    throw new Error(
      "Missing user credentials. Please set: USER_USERNAME, USER_PASSWORD, USER_FULLNAME, USER_EMAIL"
    );
  }

  // Create roles if they don't exist
  await createRoleIfNotExists(ADMIN_ID, ADMIN_ROLE, "Administrator with read and write access");
  await createRoleIfNotExists(USER_ID, USER_ROLE, "Normal user with limited access");

  // Create admin user
  await createUser(adminUsername, adminPassword, adminFullName, adminEmail, ADMIN_ROLE);

  // Create normal user
  await createUser(userUsername, userPassword, userFullName, userEmail, USER_ROLE);
}

run()
  .catch((error) => {
    console.error("Error:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
