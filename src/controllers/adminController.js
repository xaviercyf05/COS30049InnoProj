const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const env = require("../config/env");

const ADMIN_ROLE = "admin";

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
    `SELECT u.id,
            u.username,
            u.password_hash AS passwordHash,
            r.role_name AS role
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.username = ?
       AND u.is_active = 1
       AND r.role_name = ?
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
    `SELECT u.id,
            u.username,
            r.role_name AS role,
            u.is_active AS isActive,
            u.created_at AS createdAt
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE r.role_name = ?
     ORDER BY u.created_at DESC`,
    [ADMIN_ROLE]
  );

  return res.json(rows);
}

async function createAdminUser(req, res) {
  const { username, password, role = ADMIN_ROLE } = req.body;

  if (role !== ADMIN_ROLE) {
    return res.status(400).json({ message: "Only the admin role is currently supported." });
  }

  const [roleRows] = await query("SELECT id FROM roles WHERE role_name = ? LIMIT 1", [role]);

  if (roleRows.length === 0) {
    return res.status(400).json({ message: "Role not found." });
  }

  const roleId = roleRows[0].id;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [result] = await query(
      "INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)",
      [username, passwordHash, roleId]
    );

    const [rows] = await query(
      `SELECT u.id,
              u.username,
              r.role_name AS role,
              u.is_active AS isActive,
              u.created_at AS createdAt
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
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
