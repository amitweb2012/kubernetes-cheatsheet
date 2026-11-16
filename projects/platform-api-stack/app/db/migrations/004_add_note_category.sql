ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'General';

UPDATE notes
SET category = CASE
  WHEN title ILIKE '%helm%' THEN 'Helm'
  WHEN title ILIKE '%ingress%' OR title ILIKE '%routing%' THEN 'Ingress'
  WHEN title ILIKE '%prometheus%' OR title ILIKE '%monitor%' THEN 'Observability'
  WHEN title ILIKE '%security%' OR title ILIKE '%oauth%' THEN 'Security'
  WHEN title ILIKE '%database%' OR title ILIKE '%postgres%' OR title ILIKE '%redis%' THEN 'Database'
  WHEN title ILIKE '%kubernetes%' OR title ILIKE '%pod%' OR title ILIKE '%deployment%' THEN 'Kubernetes'
  ELSE category
END;
