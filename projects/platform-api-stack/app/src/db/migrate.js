const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5000
});

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Prevent two application instances from applying migrations simultaneously.
  const lock = await pool.query("SELECT pg_try_advisory_lock(742019)");
  if (!lock.rows[0].pg_try_advisory_lock) {
    throw new Error("Another migration process is running");
  }

  try {
    const directory = path.join(__dirname, "../../db/migrations");
    const files = fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();

    for (const file of files) {
      const alreadyApplied = await pool.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [file]
      );
      if (alreadyApplied.rowCount) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(directory, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.query("SELECT pg_advisory_unlock(742019)");
  }
}

main()
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
