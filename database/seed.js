require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  password: process.env.DB_PASSWORD,
});

const seedsDir = path.join(__dirname, "seeds");

async function seed() {
  try {
    await client.connect();

    console.log("\n========================================");
    console.log(" Customer Management Database Seeding");
    console.log("========================================\n");

    const files = fs
      .readdirSync(seedsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No seed files found.");
      return;
    }

    for (const file of files) {
      console.log(`RUN      ${file}`);

      const sql = fs.readFileSync(
        path.join(seedsDir, file),
        "utf8"
      );

      try {
        await client.query("BEGIN");

        await client.query(sql);

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
    console.log(" All seeds completed successfully");
    console.log("========================================\n");
  } catch (error) {
    console.error("\nSeed process failed.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

seed();