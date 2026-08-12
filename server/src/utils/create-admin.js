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

async function createAdmin() {
  try {
    const username = (await ask("Admin username: ")).trim();
    const fullName = (await ask("Admin full name: ")).trim();
    const password = await ask("Admin password: ");

    if (!username || !fullName || !password) {
      throw new Error("All fields are required.");
    }

    if (password.length < 12) {
      throw new Error(
        "Admin password must be at least 12 characters."
      );
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM users
      WHERE username = $1
      `,
      [username]
    );

    if (existing.rowCount > 0) {
      throw new Error("Username already exists.");
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    await pool.query(
      `
      INSERT INTO users (
        username,
        password_hash,
        full_name,
        role
      )
      VALUES ($1, $2, $3, 'ADMIN')
      `,
      [
        username,
        passwordHash,
        fullName,
      ]
    );

    console.log("");
    console.log("Admin account created successfully.");
  } catch (error) {
    console.error("");
    console.error("Failed to create admin:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

createAdmin();