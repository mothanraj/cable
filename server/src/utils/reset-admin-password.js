require("dotenv").config();

const readline = require("readline");
const argon2 = require("argon2");

const pool = require("../config/database");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function resetAdminPassword() {
  try {
    const username = (
      await ask("Admin username: ")
    ).trim();

    const newPassword = await ask(
      "New Admin password: "
    );

    if (!username || !newPassword) {
      throw new Error(
        "Username and password are required."
      );
    }

    if (newPassword.length < 12) {
      throw new Error(
        "Password must be at least 12 characters."
      );
    }

    const passwordHash = await argon2.hash(
      newPassword,
      {
        type: argon2.argon2id,
      }
    );

    const result = await pool.query(
      `
      UPDATE users
      SET
        password_hash = $1,
        updated_at = NOW()
      WHERE username = $2
        AND role = 'ADMIN'
      RETURNING username
      `,
      [
        passwordHash,
        username,
      ]
    );

    if (result.rowCount === 0) {
      throw new Error(
        "Admin account not found."
      );
    }

    // Revoke all existing sessions for this admin.
    await pool.query(
      `
      UPDATE user_sessions
      SET revoked_at = NOW()
      WHERE user_id = (
        SELECT id
        FROM users
        WHERE username = $1
          AND role = 'ADMIN'
      )
      AND revoked_at IS NULL
      `,
      [username]
    );

    console.log("");
    console.log(
      "Admin password reset successfully."
    );
    console.log(
      "Existing Admin sessions have been revoked."
    );
  } catch (error) {
    console.error("");
    console.error(
      "Password reset failed:"
    );
    console.error(error.message);

    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

resetAdminPassword();