const argon2 = require("argon2");
const pool = require("../../config/database");

async function createUser({
  username,
  fullName,
  password,
}) {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const result = await pool.query(
    `
    INSERT INTO users (
      username,
      password_hash,
      full_name,
      role
    )
    VALUES ($1, $2, $3, 'USER')
    RETURNING
      id,
      username,
      full_name,
      role,
      is_active,
      created_at
    `,
    [
      username,
      passwordHash,
      fullName,
    ]
  );

  return result.rows[0];
}

async function getUsers() {
  const result = await pool.query(
    `
    SELECT
      id,
      username,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
    FROM users
    ORDER BY
      CASE
        WHEN role = 'ADMIN' THEN 0
        ELSE 1
      END,
      full_name
    `
  );

  return result.rows;
}

async function setUserStatus(userId, isActive) {
  const result = await pool.query(
    `
    UPDATE users
    SET
      is_active = $1,
      updated_at = NOW()
    WHERE id = $2
      AND role = 'USER'
    RETURNING
      id,
      username,
      full_name,
      role,
      is_active
    `,
    [isActive, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createUser,
  getUsers,
  setUserStatus,
};