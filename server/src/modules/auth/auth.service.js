const crypto = require("crypto");
const pool = require("../../config/database");
const argon2 = require("argon2");

const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../../utils/jwt");

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

async function login(username, password, metadata = {}) {
  const result = await pool.query(
    `
    SELECT
      id,
      username,
      password_hash,
      full_name,
      role,
      is_active
    FROM users
    WHERE username = $1
    LIMIT 1
    `,
    [username]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const user = result.rows[0];

  if (!user.is_active) {
    return null;
  }

  const passwordValid = await argon2.verify(
    user.password_hash,
    password
  );

  if (!passwordValid) {
    return null;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const refreshTokenHash = hashToken(refreshToken);

  await pool.query(
    `
    INSERT INTO user_sessions (
      user_id,
      refresh_token_hash,
      expires_at,
      user_agent,
      ip_address
    )
    VALUES (
      $1,
      $2,
      NOW() + INTERVAL '7 days',
      $3,
      $4
    )
    `,
    [
      user.id,
      refreshTokenHash,
      metadata.userAgent || null,
      metadata.ipAddress || null,
    ]
  );

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

async function refreshSession(refreshToken, metadata = {}) {
  if (!refreshToken) {
    return null;
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }

  const tokenHash = hashToken(refreshToken);

  const result = await pool.query(
    `
    SELECT
      s.id AS session_id,
      s.user_id,
      s.expires_at,
      s.revoked_at,
      u.username,
      u.full_name,
      u.role,
      u.is_active
    FROM user_sessions s
    INNER JOIN users u
      ON u.id = s.user_id
    WHERE s.refresh_token_hash = $1
      AND s.user_id = $2
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND u.is_active = TRUE
    LIMIT 1
    `,
    [tokenHash, payload.sub]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const session = result.rows[0];

  const user = {
    id: session.user_id,
    username: session.username,
    fullName: session.full_name,
    role: session.role,
  };

  const accessToken = generateAccessToken(user);

  // Refresh-token rotation
  const newRefreshToken = generateRefreshToken(user);
  const newRefreshTokenHash = hashToken(newRefreshToken);

  await pool.query(
    `
    UPDATE user_sessions
    SET
      refresh_token_hash = $1,
      last_activity_at = NOW(),
      user_agent = COALESCE($2, user_agent),
      ip_address = COALESCE($3, ip_address)
    WHERE id = $4
    `,
    [
      newRefreshTokenHash,
      metadata.userAgent || null,
      metadata.ipAddress || null,
      session.session_id,
    ]
  );

  return {
    user,
    accessToken,
    refreshToken: newRefreshToken,
  };
}

async function logout(refreshToken) {
  if (!refreshToken) {
    return;
  }

  const tokenHash = hashToken(refreshToken);

  await pool.query(
    `
    UPDATE user_sessions
    SET revoked_at = NOW()
    WHERE refresh_token_hash = $1
      AND revoked_at IS NULL
    `,
    [tokenHash]
  );
}

module.exports = {
  login,
  refreshSession,
  logout,
};