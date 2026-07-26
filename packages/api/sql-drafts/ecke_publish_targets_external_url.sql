-- Draft: store ECKE public URL on publish targets (Pass 3B — not applied to production)
-- Prerequisite: operator sign-off before drizzle push / production apply

ALTER TABLE ecke_publish_targets
  ADD COLUMN IF NOT EXISTS external_url text;

COMMENT ON COLUMN ecke_publish_targets.external_url IS
  'Last known ECKE public URL from ingest API response (e.g. https://www.eastcoastkinkevents.com/education/slug).';
