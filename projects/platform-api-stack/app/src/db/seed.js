const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = fs.readFileSync(path.join(__dirname, "../../db/seed.sql"), "utf8");
  await pool.query(sql);
  console.log("Sample notes inserted/updated successfully.");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
