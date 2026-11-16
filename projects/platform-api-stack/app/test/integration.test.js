const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { Pool } = require("pg");
const { createClient } = require("redis");

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const pool = new Pool({ connectionString: databaseUrl });
const redis = createClient({ url: redisUrl });
const cacheKey = "integration-test:notes:list";

before(async () => {
  assert.ok(databaseUrl, "DATABASE_URL must be set");
  assert.ok(redisUrl, "REDIS_URL must be set");
  await redis.connect();

  // Exercise the same migration command used by developers and deployments.
  const migration = spawnSync(process.execPath, ["src/db/migrate.js"], {
    cwd: __dirname + "/..",
    env: process.env,
    encoding: "utf8"
  });
  assert.equal(migration.status, 0, `Migration failed:\n${migration.stdout}\n${migration.stderr}`);
});

after(async () => {
  try { await redis.del(cacheKey); } finally {
    await redis.quit();
    await pool.end();
  }
});

test("PostgreSQL migrations create notes and migration history", async () => {
  const schema = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notes'"
  );
  const columns = schema.rows.map((row) => row.column_name);
  for (const column of ["id", "title", "content", "category", "created_at", "updated_at", "seed_key"]) {
    assert.ok(columns.includes(column), `Expected notes.${column} column`);
  }

  const migrations = await pool.query("SELECT version FROM schema_migrations ORDER BY version");
  assert.ok(migrations.rows.length >= 4, "Expected all four SQL migrations to be recorded");
});

test("PostgreSQL persists a note and Redis stores, reads and invalidates its cache", async () => {
  const marker = `integration-${Date.now()}`;
  const inserted = await pool.query(
    "INSERT INTO notes (title, content, category) VALUES ($1, $2, $3) RETURNING id, title, content, category",
    [marker, "PostgreSQL integration test", "Database"]
  );
  const note = inserted.rows[0];
  assert.equal(note.title, marker);
  assert.equal(note.category, "Database");

  const payload = JSON.stringify([note]);
  await redis.set(cacheKey, payload, { EX: 30 });
  assert.equal(await redis.get(cacheKey), payload);

  // Match the API's cache invalidation behavior after a write.
  await redis.del(cacheKey);
  assert.equal(await redis.get(cacheKey), null);

  await pool.query("DELETE FROM notes WHERE id = $1", [note.id]);
});
