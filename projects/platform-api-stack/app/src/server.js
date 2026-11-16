const express = require("express");
const { Pool } = require("pg");
const { createClient } = require("redis");

const app = express();
app.use(express.json({ limit: "32kb" }));

const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000
});

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: { connectTimeout: 3000, reconnectStrategy: (retries) => Math.min(retries * 250, 3000) }
});
redis.on("error", (error) => console.error("Redis client error:", error.message));

let redisReady = false;
redis.connect().then(() => { redisReady = true; }).catch((error) => {
  console.error("Redis initial connection failed:", error.message);
});

app.get("/health/live", (_req, res) => res.status(200).json({ status: "alive" }));

app.get("/health/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ready", database: "up", redis: redisReady ? "up" : "degraded" });
  } catch {
    res.status(503).json({ status: "not-ready", database: "down" });
  }
});

app.get("/api/v1/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ service: "platform-api", status: "ok", redis: redisReady ? "connected" : "disconnected" });
  } catch {
    res.status(503).json({ service: "platform-api", status: "degraded" });
  }
});

app.get("/api/v1/notes", async (_req, res, next) => {
  try {
    if (redisReady) {
      const cached = await redis.get("notes:list");
      if (cached) return res.json({ source: "redis-cache", data: JSON.parse(cached) });
    }
    const { rows } = await pool.query(
      "SELECT id, title, content, created_at FROM notes ORDER BY id DESC LIMIT 100"
    );
    if (redisReady) await redis.set("notes:list", JSON.stringify(rows), { EX: 30 });
    res.json({ source: "postgresql", data: rows });
  } catch (error) { next(error); }
});

app.post("/api/v1/notes", async (req, res, next) => {
  try {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const content = typeof req.body.content === "string" ? req.body.content : "";
    if (!title || title.length > 120 || content.length > 10000) {
      return res.status(400).json({ error: "title is required (max 120 chars); content max is 10000 chars" });
    }
    const { rows } = await pool.query(
      "INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING id, title, content, created_at",
      [title, content]
    );
    if (redisReady) await redis.del("notes:list");
    res.status(201).json({ data: rows[0] });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error.message);
  res.status(500).json({ error: "Internal server error" });
});

async function shutdown() {
  console.log("Shutting down gracefully...");
  server.close(async () => {
    try { if (redis.isOpen) await redis.quit(); } catch {}
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

let server = app.listen(port, "0.0.0.0", () => console.log(`platform-api listening on ${port}`));

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
