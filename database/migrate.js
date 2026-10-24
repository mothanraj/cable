const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const { createClientConfig } = require("./db");

const client = new Client(createClientConfig());

const migrationsDir = path.join(__dirname, "migrations");

async function migrate() {
  try {
    await client.connect();

    console.log("\n========================================");
    console.log(" Customer Management Database Migration");
    console.log("========================================\n");

    // Make sure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    for (const file of files) {
      const result = await client.query(
        `
        SELECT 1
        FROM schema_migrations
        WHERE migration_name = $1
        `,
        [file]
      );

      if (result.rowCount > 0) {
        console.log(`SKIP     ${file}`);
        continue;
      }

      console.log(`RUN      ${file}`);

      const sql = fs.readFileSync(
        path.join(migrationsDir, file),
        "utf8"
      );

      try {
        await client.query("BEGIN");

        await client.query(sql);

        await client.query(
          `
          INSERT INTO schema_migrations (migration_name)
          VALUES ($1)
          `,
          [file]
        );

        await client.query("COMMIT");

        console.log(`SUCCESS  ${file}\n`);
      } catch (error) {
        await client.query("ROLLBACK");

        console.error(`FAILED   ${file}`);
        console.error(error.message);

        throw error;
      }
    }

    console.log("========================================");
    console.log(" All migrations completed successfully");
    console.log("========================================\n");
  } catch (error) {
    console.error("\nMigration process failed.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate();