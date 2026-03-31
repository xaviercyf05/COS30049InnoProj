const { query } = require("../config/db");

async function listPublicPosts(req, res) {
  const [rows] = await query(
    `SELECT id,
            title,
            content,
            is_published AS isPublished,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM posts
     WHERE is_published = 1
     ORDER BY updated_at DESC
     LIMIT 200`
  );

  return res.json(rows);
}

async function getPublicPostById(req, res) {
  const postId = Number(req.params.id);

  const [rows] = await query(
    `SELECT id,
            title,
            content,
            is_published AS isPublished,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM posts
     WHERE id = ?
       AND is_published = 1
     LIMIT 1`,
    [postId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: "Post not found." });
  }

  return res.json(rows[0]);
}

module.exports = {
  listPublicPosts,
  getPublicPostById,
};
