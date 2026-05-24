const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const env = require("../config/env");

const ADMIN_ROLE = "Admin";

function toPublishedFlag(value, fallback = 1) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value === 1 || value === "1" || value === "true") {
    return 1;
  }

  return 0;
}

async function loginAdmin(req, res) {
  const { username, password } = req.body;

  const [rows] = await query(
    `SELECT u.UserID AS id,
            u.Username AS username,
            u.PasswordHash AS passwordHash,
            r.RoleTitle AS role
     FROM Users u
     INNER JOIN Roles r ON r.RoleID = u.RoleID
     WHERE u.Username = ?
       AND u.IsActive = 1
       AND r.RoleTitle = ?
     LIMIT 1`,
    [username, ADMIN_ROLE]
  );

  if (rows.length === 0) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const adminUser = rows[0];
  const isMatch = await bcrypt.compare(password, adminUser.passwordHash);

  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const token = jwt.sign(
    {
      sub: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return res.json({
    token,
    tokenType: "Bearer",
    expiresIn: env.jwtExpiresIn,
  });
}

async function listAdminPosts(req, res) {
  const [rows] = await query(
    `SELECT id,
            title,
            content,
            is_published AS isPublished,
            created_by AS createdBy,
            updated_by AS updatedBy,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM posts
     ORDER BY updated_at DESC
     LIMIT 500`
  );

  return res.json(rows);
}

async function createPost(req, res) {
  const { title, content, isPublished } = req.body;
  const publishedFlag = toPublishedFlag(isPublished, 1);
  const adminId = req.admin.id;

  const [result] = await query(
    "INSERT INTO posts (title, content, is_published, created_by, updated_by) VALUES (?, ?, ?, ?, ?)",
    [title, content, publishedFlag, adminId, adminId]
  );

  const [rows] = await query(
    `SELECT id,
            title,
            content,
            is_published AS isPublished,
            created_by AS createdBy,
            updated_by AS updatedBy,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM posts
     WHERE id = ?`,
    [result.insertId]
  );

  return res.status(201).json(rows[0]);
}

async function updatePost(req, res) {
  const postId = Number(req.params.id);
  const { title, content, isPublished } = req.body;
  const publishedFlag = toPublishedFlag(isPublished, 1);
  const adminId = req.admin.id;

  const [result] = await query(
    "UPDATE posts SET title = ?, content = ?, is_published = ?, updated_by = ? WHERE id = ?",
    [title, content, publishedFlag, adminId, postId]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Post not found." });
  }

  const [rows] = await query(
    `SELECT id,
            title,
            content,
            is_published AS isPublished,
            created_by AS createdBy,
            updated_by AS updatedBy,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM posts
     WHERE id = ?`,
    [postId]
  );

  return res.json(rows[0]);
}

async function deletePost(req, res) {
  const postId = Number(req.params.id);
  const [result] = await query("DELETE FROM posts WHERE id = ?", [postId]);

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Post not found." });
  }

  return res.status(204).send();
}

async function listAdminUsers(req, res) {
  const [rows] = await query(
    `SELECT u.UserID AS id,
            u.Username AS username,
            r.RoleTitle AS role,
            u.IsActive AS isActive,
            u.CreatedAt AS createdAt
     FROM Users u
     INNER JOIN Roles r ON r.RoleID = u.RoleID
     WHERE r.RoleTitle = ?
     ORDER BY u.CreatedAt DESC`,
    [ADMIN_ROLE]
  );

  return res.json(rows);
}

async function createAdminUser(req, res) {
  const { username, password, fullName, email, role = ADMIN_ROLE } = req.body;
  const normalizedRole = String(role || "").trim().toLowerCase() === "admin" ? ADMIN_ROLE : role;

  if (normalizedRole !== ADMIN_ROLE) {
    return res.status(400).json({ message: "Only the admin role is currently supported." });
  }

  const [roleRows] = await query("SELECT RoleID FROM Roles WHERE RoleTitle = ? LIMIT 1", [normalizedRole]);

  if (roleRows.length === 0) {
    return res.status(400).json({ message: "Role not found." });
  }

  const roleId = roleRows[0].RoleID;
  const passwordHash = await bcrypt.hash(password, 12);
  const resolvedFullName = String(fullName || username).trim();
  const resolvedEmail = String(email || `${username}@local.invalid`).trim().toLowerCase();

  try {
    const [result] = await query(
      "INSERT INTO Users (Username, PasswordHash, FullName, Email, RoleID, IsActive, Status, Progress) VALUES (?, ?, ?, ?, ?, 1, 'Active', 0)",
      [username, passwordHash, resolvedFullName, resolvedEmail, roleId]
    );

    const [rows] = await query(
      `SELECT u.UserID AS id,
              u.Username AS username,
              r.RoleTitle AS role,
              u.IsActive AS isActive,
              u.CreatedAt AS createdAt
       FROM Users u
       INNER JOIN Roles r ON r.RoleID = u.RoleID
       WHERE u.UserID = ?
       LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Username already exists." });
    }

    throw error;
  }
}

module.exports = {
  loginAdmin,
  listAdminPosts,
  createPost,
  updatePost,
  deletePost,
  listAdminUsers,
  createAdminUser,
};
