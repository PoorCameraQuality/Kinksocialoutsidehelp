-- Presenter + venue ECKE publish targets (apply before enabling presenter/venue unified publish)
ALTER TYPE ecke_publish_scope ADD VALUE IF NOT EXISTS 'presenter_profile';
ALTER TYPE ecke_publish_scope ADD VALUE IF NOT EXISTS 'venue_profile';

ALTER TABLE presenter_profiles
  ADD COLUMN IF NOT EXISTS ecke_publish boolean NOT NULL DEFAULT false;

ALTER TABLE community_places
  ADD COLUMN IF NOT EXISTS ecke_publish boolean NOT NULL DEFAULT false;

ALTER TABLE ecke_publish_targets
  ADD COLUMN IF NOT EXISTS presenter_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS community_place_id uuid REFERENCES community_places(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS ecke_publish_targets_presenter_kind_uq
  ON ecke_publish_targets (presenter_user_id, target_kind)
  WHERE presenter_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ecke_publish_targets_place_kind_uq
  ON ecke_publish_targets (community_place_id, target_kind)
  WHERE community_place_id IS NOT NULL;
