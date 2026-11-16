-- Repeatable demo data. Existing seeded rows are updated, not duplicated.
INSERT INTO notes (title, content, seed_key)
VALUES
  ('Welcome to Platform Notes', 'This note is stored in PostgreSQL and served by the Express API.', 'demo:welcome'),
  ('Kubernetes deployment checklist', 'Build the image, load it into the cluster, apply Helm values, and verify Pod readiness.', 'demo:kubernetes-checklist'),
  ('Redis caching', 'Cache frequently requested data with a short TTL and invalidate it after writes.', 'demo:redis-cache'),
  ('Database migrations', 'Apply schema changes in version order and keep a migration history table.', 'demo:database-migrations'),
  ('API security', 'Use input validation, least-privilege credentials, TLS, and Kubernetes NetworkPolicies.', 'demo:api-security')
ON CONFLICT (seed_key) WHERE seed_key IS NOT NULL
DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();
