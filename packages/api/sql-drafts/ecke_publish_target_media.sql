-- Milestone alpha: ECKE publish target photo manifest (publisher side)
-- Apply via drizzle push or operator migration on staging before ECKE_PUBLISH_PHOTOS_ENABLED=true

DO $$ BEGIN
  CREATE TYPE ecke_publish_target_media_role AS ENUM ('hero', 'gallery', 'logo', 'thumbnail');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ecke_publish_targets
  ADD COLUMN IF NOT EXISTS media_hash varchar(64),
  ADD COLUMN IF NOT EXISTS media_manifest_version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS ecke_publish_target_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES ecke_publish_targets(id) ON DELETE CASCADE,
  source_media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  role ecke_publish_target_media_role NOT NULL,
  ordinal integer NOT NULL DEFAULT 0,
  width integer,
  height integer,
  sha256_hash varchar(128),
  source_url text,
  alt_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_id, source_media_asset_id),
  UNIQUE (target_id, role, ordinal)
);
