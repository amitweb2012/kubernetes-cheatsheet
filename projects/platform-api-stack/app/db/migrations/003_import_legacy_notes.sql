-- Example legacy schema retained as a migration exercise.
CREATE TABLE IF NOT EXISTS legacy_notes (
  legacy_id BIGINT PRIMARY KEY,
  heading VARCHAR(120) NOT NULL,
  body TEXT,
  created_on TIMESTAMPTZ NOT NULL
);

INSERT INTO legacy_notes (legacy_id, heading, body, created_on)
VALUES
  (101, 'Kubernetes basics', 'A Pod is the smallest deployable unit in Kubernetes.', '2025-01-12T09:00:00Z'),
  (102, 'API reliability', 'Use timeouts, retries with backoff, and circuit breakers carefully.', '2025-01-13T10:30:00Z'),
  (103, 'PostgreSQL notes', 'Indexes speed up reads but add write and storage overhead.', '2025-01-14T11:15:00Z')
ON CONFLICT (legacy_id) DO NOTHING;

INSERT INTO notes (title, content, created_at, updated_at, seed_key)
SELECT heading, COALESCE(body, ''), created_on, created_on, 'legacy:' || legacy_id::text
FROM legacy_notes
ON CONFLICT (seed_key) WHERE seed_key IS NOT NULL DO NOTHING;
