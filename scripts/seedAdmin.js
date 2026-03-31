const bcrypt = require("bcryptjs");
const { query, pool } = require("../src/config/db");

const ADMIN_ROLE = "admin";

async function run() {
  const username = process.argv[2] || process.env.ADMIN_USERNAME;
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Missing credentials. Usage: npm run seed:admin -- <username> <password>"
    );
  }

  if (password.length < 8) {
    throw new Error("Admin password must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await query(
    `INSERT INTO roles (role_name, description)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE description = VALUES(description)`,
    [ADMIN_ROLE, "Administrator with read and write access"]
  );

  const [roleRows] = await query("SELECT id FROM roles WHERE role_name = ? LIMIT 1", [ADMIN_ROLE]);

  if (roleRows.length === 0) {
    throw new Error("Admin role does not exist and could not be created.");
  }

  const roleId = roleRows[0].id;

  await query(
    `INSERT INTO users (username, password_hash, role_id, is_active)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       role_id = VALUES(role_id),
       is_active = 1`,
    [username, passwordHash, roleId]
  );

  console.log(`Admin account upserted for username: ${username}`);
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
