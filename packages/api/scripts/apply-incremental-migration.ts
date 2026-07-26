/**
 * Idempotent SQL for columns/tables that `drizzle-kit push` may skip when expression-index Zod fails.
 * Extend this file when adding nullable columns or safe defaults — do not duplicate hub-ext tables here.
 */
import pg from 'pg'

const sql = `
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES places(id) ON DELETE SET NULL;
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS service_radius_mi integer NOT NULL DEFAULT 50;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS share_image_url text;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS share_image_url text;

ALTER TABLE convention_gallery_images
  ADD COLUMN IF NOT EXISTS moderation_status varchar(20) NOT NULL DEFAULT 'approved';

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS email_signup_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS scope_email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type varchar(16) NOT NULL,
  scope_id uuid NOT NULL,
  email varchar(320) NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name varchar(255),
  status varchar(20) NOT NULL DEFAULT 'active',
  source varchar(32) NOT NULL DEFAULT 'public_form',
  opted_in_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  CONSTRAINT scope_email_subscribers_scope_email_unique UNIQUE (scope_type, scope_id, email)
);

CREATE INDEX IF NOT EXISTS scope_email_subscribers_scope_idx
  ON scope_email_subscribers (scope_type, scope_id, status);

CREATE TABLE IF NOT EXISTS platform_email_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  event_type varchar(32) NOT NULL,
  scope_type varchar(16),
  scope_id uuid,
  scope_name varchar(255),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_email_captures_email_idx ON platform_email_captures (email);
CREATE INDEX IF NOT EXISTS platform_email_captures_created_idx ON platform_email_captures (created_at);

ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS pinned_digest_email_weekly boolean NOT NULL DEFAULT true;

ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS push_hub_announcements boolean NOT NULL DEFAULT true;

ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS push_hub_chat boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS convention_hub_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  slug varchar(64) NOT NULL,
  name varchar(255) NOT NULL,
  kind varchar(32) NOT NULL DEFAULT 'CHAT',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT convention_hub_channels_conv_slug_unique UNIQUE (convention_id, slug)
);

CREATE INDEX IF NOT EXISTS convention_hub_channels_conv_idx ON convention_hub_channels (convention_id, sort_order);

CREATE TABLE IF NOT EXISTS convention_hub_channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES convention_hub_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  parent_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS convention_hub_channel_messages_channel_idx
  ON convention_hub_channel_messages (channel_id, created_at);

CREATE TABLE IF NOT EXISTS convention_hub_channel_reads (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES convention_hub_channels(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint)
);

ALTER TABLE scope_email_subscribers
  ADD COLUMN IF NOT EXISTS confirm_token_hash varchar(64);

ALTER TABLE scope_email_subscribers
  ADD COLUMN IF NOT EXISTS confirm_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS feed_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verb varchar(64) NOT NULL,
  object_type varchar(64) NOT NULL,
  object_id varchar(256) NOT NULL,
  audience_type varchar(32) NOT NULL DEFAULT 'followers',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feed_activities_created_at_idx ON feed_activities (created_at DESC);
CREATE INDEX IF NOT EXISTS feed_activities_actor_created_idx ON feed_activities (actor_id, created_at DESC);

DO $$ BEGIN
  CREATE TYPE capability_visibility AS ENUM ('PUBLIC', 'MEMBERS', 'HIDDEN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE vendor_commission_status AS ENUM ('OPEN', 'LIMITED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS visibility capability_visibility NOT NULL DEFAULT 'PUBLIC';

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS commission_status vendor_commission_status NOT NULL DEFAULT 'OPEN';

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS commission_notes text;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS featured_until timestamptz;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS rsvp_open boolean NOT NULL DEFAULT true;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS category varchar(64);

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS tags text[];

UPDATE groups SET category = 'Play & scene' WHERE category IN ('BDSM', 'Fetish', 'Kink');
UPDATE groups SET category = 'Education' WHERE category = 'Rope';
UPDATE groups SET category = 'Social' WHERE category = 'Lifestyle';
UPDATE groups SET category = 'Affinity' WHERE category = 'LGBTQ+';

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS category varchar(64);
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS tags text[];

UPDATE vendor_profiles SET category = 'Rope & rigging' WHERE category IS NULL AND (categories && ARRAY['Rope', 'Safety', 'Aftercare']::text[] OR 'Rope' = ANY(categories) OR 'Safety' = ANY(categories) OR 'Aftercare' = ANY(categories));
UPDATE vendor_profiles SET category = 'Impact & sensation' WHERE category IS NULL AND (categories && ARRAY['Impact', 'Handmade', 'Sensation']::text[] OR 'Impact' = ANY(categories) OR 'Handmade' = ANY(categories) OR 'Sensation' = ANY(categories));
UPDATE vendor_profiles SET category = 'Leather & wear' WHERE category IS NULL AND (categories && ARRAY['Leather', 'Restraints', 'Clothing']::text[] OR 'Leather' = ANY(categories) OR 'Restraints' = ANY(categories) OR 'Clothing' = ANY(categories));
UPDATE vendor_profiles SET category = 'Gear & accessories' WHERE category IS NULL AND (categories && ARRAY['Gear', 'Toys', 'Accessories', 'Jewelry', 'Collars', 'Pup play']::text[] OR 'Gear' = ANY(categories) OR 'Toys' = ANY(categories) OR 'Accessories' = ANY(categories) OR 'Jewelry' = ANY(categories) OR 'Collars' = ANY(categories) OR 'Pup play' = ANY(categories));
UPDATE vendor_profiles SET category = 'Art & lifestyle' WHERE category IS NULL AND (categories && ARRAY['Art', 'Lifestyle']::text[] OR 'Art' = ANY(categories) OR 'Lifestyle' = ANY(categories));
UPDATE vendor_profiles SET category = 'Services' WHERE category IS NULL AND (categories && ARRAY['Services', 'Photography']::text[] OR 'Services' = ANY(categories) OR 'Photography' = ANY(categories));
UPDATE vendor_profiles SET category = 'Aftercare & wellness' WHERE category IS NULL AND ('Aftercare' = ANY(categories) OR 'Wellness' = ANY(categories));

CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_type varchar(64) NOT NULL,
  object_id varchar(256) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, object_type, object_id)
);

CREATE INDEX IF NOT EXISTS user_bookmarks_user_created_idx ON user_bookmarks (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS post_likes_post_id_idx ON post_likes (post_id);
CREATE INDEX IF NOT EXISTS post_likes_post_created_idx ON post_likes (post_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS presenter_teaching_credits_presenter_slot_uq
  ON presenter_teaching_credits (presenter_user_id, schedule_slot_id)
  WHERE schedule_slot_id IS NOT NULL;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS maker_story text;
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS shop_policies jsonb;

CREATE TABLE IF NOT EXISTS vendor_event_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_name varchar(512) NOT NULL,
  event_date date,
  convention_id uuid REFERENCES conventions(id) ON DELETE SET NULL,
  convention_slug varchar(128),
  verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_event_credits_vendor_event_uq
  ON vendor_event_credits (vendor_profile_id, event_id);
CREATE INDEX IF NOT EXISTS vendor_event_credits_vendor_idx
  ON vendor_event_credits (vendor_profile_id);

DO $$ BEGIN
  CREATE TYPE education_article_visibility AS ENUM ('PUBLIC', 'MEMBERS', 'CONNECTIONS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE education_article_publication_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS education_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  presenter_profile_user_id uuid REFERENCES presenter_profiles(user_id) ON DELETE SET NULL,
  slug varchar(160) NOT NULL,
  title varchar(512) NOT NULL,
  excerpt text,
  body_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_html text NOT NULL DEFAULT '',
  hero_image_url text,
  categories text[] NOT NULL DEFAULT '{}',
  difficulty varchar(32),
  content_warnings text[] NOT NULL DEFAULT '{}',
  reading_minutes integer,
  linked_offering_ids uuid[] NOT NULL DEFAULT '{}',
  visibility education_article_visibility NOT NULL DEFAULT 'PUBLIC',
  list_in_education boolean NOT NULL DEFAULT false,
  publication_status education_article_publication_status NOT NULL DEFAULT 'DRAFT',
  ecke_publish boolean NOT NULL DEFAULT false,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS education_articles_slug_uq ON education_articles (slug);
CREATE INDEX IF NOT EXISTS education_articles_author_updated_idx
  ON education_articles (author_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS education_articles_hub_idx
  ON education_articles (list_in_education, publication_status, published_at DESC);

CREATE TABLE IF NOT EXISTS organization_featured_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  education_article_id uuid NOT NULL REFERENCES education_articles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  label varchar(128)
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_featured_articles_org_article_idx
  ON organization_featured_articles (organization_id, education_article_id);
CREATE INDEX IF NOT EXISTS organization_featured_articles_org_idx
  ON organization_featured_articles (organization_id);

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS ecke_publish boolean NOT NULL DEFAULT false;

ALTER TABLE ecke_publish_targets
  ADD COLUMN IF NOT EXISTS education_article_id uuid REFERENCES education_articles(id) ON DELETE CASCADE;
ALTER TABLE ecke_publish_targets
  ADD COLUMN IF NOT EXISTS vendor_profile_id uuid REFERENCES vendor_profiles(id) ON DELETE CASCADE;
ALTER TABLE ecke_publish_targets
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS ecke_publish_targets_article_kind_uq
  ON ecke_publish_targets (education_article_id, target_kind)
  WHERE education_article_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ecke_publish_targets_vendor_kind_uq
  ON ecke_publish_targets (vendor_profile_id, target_kind)
  WHERE vendor_profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ecke_publish_targets_event_kind_uq
  ON ecke_publish_targets (event_id, target_kind)
  WHERE event_id IS NOT NULL;

DO $$ BEGIN
  ALTER TYPE ecke_publish_scope ADD VALUE IF NOT EXISTS 'education_article';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE ecke_publish_scope ADD VALUE IF NOT EXISTS 'vendor_profile';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE ecke_publish_scope ADD VALUE IF NOT EXISTS 'event';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE ecke_publish_target_kind ADD VALUE IF NOT EXISTS 'ecke_event';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE ecke_publish_target_kind ADD VALUE IF NOT EXISTS 'ecke_vendor';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE ecke_publish_target_kind ADD VALUE IF NOT EXISTS 'ecke_article';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE ecke_publish_target_kind ADD VALUE IF NOT EXISTS 'ecke_dungeon';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE vendor_blind_feedback
  ADD COLUMN IF NOT EXISTS purchase_proof_key text;

CREATE TABLE IF NOT EXISTS vendor_co_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_co_owners_vendor_user_unique UNIQUE (vendor_profile_id, user_id)
);

CREATE INDEX IF NOT EXISTS vendor_co_owners_vendor_idx ON vendor_co_owners (vendor_profile_id);

CREATE TABLE IF NOT EXISTS education_article_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(512) NOT NULL,
  slug varchar(160) NOT NULL,
  description text,
  list_in_education boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT education_article_series_slug_uq UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS education_article_series_author_idx
  ON education_article_series (author_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS education_article_series_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES education_article_series(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES education_articles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 1,
  CONSTRAINT education_article_series_items_series_article_uq UNIQUE (series_id, article_id),
  CONSTRAINT education_article_series_items_article_uq UNIQUE (article_id)
);

CREATE INDEX IF NOT EXISTS education_article_series_items_series_sort_idx
  ON education_article_series_items (series_id, sort_order);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS birth_date date;

ALTER TABLE profiles
  ALTER COLUMN sexuality TYPE varchar(128);

-- Multi-tier moderation (ADR-004) — drizzle-kit push may fail on expression-index Zod
DO $$ BEGIN
  CREATE TYPE platform_staff_role AS ENUM ('SITE_ADMIN', 'MODERATOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE moderation_action_status AS ENUM (
    'PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'REJECTED', 'OVERRIDDEN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE scope_ban_scope_type AS ENUM ('organization', 'group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS platform_staff (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role platform_staff_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type varchar(64) NOT NULL,
  target_type varchar(64) NOT NULL,
  target_id text NOT NULL,
  status moderation_action_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  proposed_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  required_approvals integer NOT NULL DEFAULT 2,
  payload jsonb,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  override_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  override_reason text,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_actions_status_idx ON moderation_actions (status);

CREATE TABLE IF NOT EXISTS moderation_action_approvals (
  action_id uuid NOT NULL REFERENCES moderation_actions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (action_id, user_id)
);

CREATE TABLE IF NOT EXISTS moderation_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type varchar(32) NOT NULL,
  scope_id uuid,
  verb varchar(64) NOT NULL,
  target_type varchar(64),
  target_id text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_audit_scope_idx ON moderation_audit_events (scope_type, scope_id);
CREATE INDEX IF NOT EXISTS moderation_audit_created_idx ON moderation_audit_events (created_at DESC);

CREATE TABLE IF NOT EXISTS scope_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type scope_ban_scope_type NOT NULL,
  scope_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text,
  banned_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scope_bans_scope_user_idx ON scope_bans (scope_type, scope_id, user_id);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS scope_type varchar(32);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS scope_id uuid;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS meta jsonb;
CREATE INDEX IF NOT EXISTS reports_scope_idx ON reports (scope_type, scope_id);

ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS hidden_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS locked_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE org_channel_messages ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE org_channel_messages ADD COLUMN IF NOT EXISTS hidden_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE convention_hub_channel_messages ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE convention_hub_channel_messages ADD COLUMN IF NOT EXISTS hidden_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Profile UX overhaul (identity arrays, zip cache, relationships, links, presenter skills)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS genders text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sexual_orientations text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS romantic_orientations text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pronoun_tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lifestyle_activity varchar(128);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS looking_for text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS not_looking_for text[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_zip varchar(10);

CREATE TABLE IF NOT EXISTS place_zips (
  zip varchar(5) PRIMARY KEY,
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  lat double precision,
  lng double precision
);
CREATE UNIQUE INDEX IF NOT EXISTS place_zips_zip_idx ON place_zips (zip);

DO $$ BEGIN
  CREATE TYPE profile_relationship_kind AS ENUM ('relationship', 'ds');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE profile_relationship_status AS ENUM ('pending', 'active');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE profile_relationship_visibility AS ENUM ('public', 'friends', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS profile_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  kind profile_relationship_kind NOT NULL,
  label varchar(128) NOT NULL,
  partner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  custom_text text,
  status profile_relationship_status NOT NULL DEFAULT 'active',
  visibility profile_relationship_visibility NOT NULL DEFAULT 'public'
);
CREATE INDEX IF NOT EXISTS profile_relationships_user_sort_idx ON profile_relationships (user_id, sort_order);

CREATE TABLE IF NOT EXISTS profile_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL,
  label varchar(128),
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS profile_links_user_sort_idx ON profile_links (user_id, sort_order);

DO $$ BEGIN
  CREATE TYPE presenter_skill_frequency AS ENUM ('rarely', 'monthly', 'weekly', 'daily', 'professional');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS presenter_skill_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_label varchar(128) NOT NULL,
  years_active integer,
  frequency presenter_skill_frequency,
  note text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS presenter_skill_claims_user_sort_idx ON presenter_skill_claims (user_id, sort_order);

ALTER TABLE presenter_profiles ADD COLUMN IF NOT EXISTS background_story text;
ALTER TABLE presenter_profiles ADD COLUMN IF NOT EXISTS mentorship_offered boolean NOT NULL DEFAULT false;
ALTER TABLE presenter_profiles ADD COLUMN IF NOT EXISTS mentorship_notes text;
ALTER TABLE presenter_profiles ADD COLUMN IF NOT EXISTS ecke_publish boolean NOT NULL DEFAULT false;

ALTER TABLE profile_references ADD COLUMN IF NOT EXISTS referrer_trust_at_accept integer;
ALTER TABLE profile_references ADD COLUMN IF NOT EXISTS counts_toward_level boolean NOT NULL DEFAULT true;
ALTER TABLE profile_references ADD COLUMN IF NOT EXISTS referrer_account_age_days_at_accept integer;
ALTER TABLE profile_references ADD COLUMN IF NOT EXISTS same_signup_cohort boolean NOT NULL DEFAULT false;
ALTER TABLE presenter_reviews ADD COLUMN IF NOT EXISTS attendee_checked_in boolean NOT NULL DEFAULT false;
ALTER TABLE group_reviews ADD COLUMN IF NOT EXISTS culture_rating integer;
ALTER TABLE group_reviews ADD COLUMN IF NOT EXISTS new_member_friendliness_rating integer;
ALTER TABLE group_reviews ADD COLUMN IF NOT EXISTS moderation_quality_rating integer;
ALTER TABLE group_reviews ADD COLUMN IF NOT EXISTS safety_responsiveness_rating integer;
ALTER TABLE group_reviews ADD COLUMN IF NOT EXISTS event_usefulness_rating integer;
ALTER TABLE group_reviews ADD COLUMN IF NOT EXISTS communication_clarity_rating integer;

DO $$ BEGIN
  CREATE TYPE media_format AS ENUM ('podcast', 'video', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_publication_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS media_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  presenter_profile_user_id uuid REFERENCES presenter_profiles(user_id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  slug varchar(160) NOT NULL,
  title varchar(512) NOT NULL,
  description text,
  cover_image_url text,
  media_format media_format NOT NULL DEFAULT 'podcast',
  rss_feed_url text,
  youtube_channel_url text,
  youtube_playlist_url text,
  spotify_show_url text,
  apple_podcasts_url text,
  website_url text,
  twitch_url text,
  rumble_url text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  content_warnings text[] NOT NULL DEFAULT '{}'::text[],
  list_in_media boolean NOT NULL DEFAULT false,
  publication_status media_publication_status NOT NULL DEFAULT 'DRAFT',
  submitted_at timestamptz,
  approved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  last_episode_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS media_shows_slug_uq ON media_shows (slug);
CREATE INDEX IF NOT EXISTS media_shows_hub_idx ON media_shows (list_in_media, publication_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS media_shows_owner_idx ON media_shows (owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS media_shows_presenter_idx ON media_shows (presenter_profile_user_id);

CREATE TABLE IF NOT EXISTS media_show_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES media_shows(id) ON DELETE CASCADE,
  slug varchar(160) NOT NULL,
  title varchar(512) NOT NULL,
  description text,
  published_at timestamptz,
  duration_seconds integer,
  rss_guid text,
  external_audio_url text,
  youtube_video_url text,
  spotify_episode_url text,
  apple_episode_url text,
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS media_show_episodes_show_slug_uq ON media_show_episodes (show_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS media_show_episodes_show_guid_uq ON media_show_episodes (show_id, rss_guid);
CREATE INDEX IF NOT EXISTS media_show_episodes_show_published_idx ON media_show_episodes (show_id, published_at DESC);

-- Social graph: one-way follows (DM inbox filters + profile follow)
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS user_follows_following_idx ON user_follows (following_id);

-- Messaging inbox (drizzle schema ahead of older db:push baselines)
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS last_read_at timestamptz;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- Org chat: optional Discord embed channels
ALTER TYPE org_channel_kind ADD VALUE IF NOT EXISTS 'DISCORD';
ALTER TABLE org_channels ADD COLUMN IF NOT EXISTS embed_url varchar(512);

-- T&S-1: moderation foundation (cases, reports, queues, events, snapshots)
DO $$ BEGIN CREATE TYPE policy_reason AS ENUM (
  'MINOR_SAFETY', 'CSAM_SUSPECTED', 'NCII', 'AI_DEEPFAKE_NCII', 'DOXXING_OUTING',
  'HARASSMENT_THREATS', 'IMPERSONATION', 'HIDDEN_CAMERA_LEAKED', 'TRAFFICKING_COERCION',
  'COMMERCIAL_SEX_SOLICITATION', 'ILLEGAL_GOODS_SERVICES', 'SPAM_SCAM', 'CONSENT_SAFETY',
  'EXPLICIT_VISIBILITY_VIOLATION', 'OTHER'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE policy_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE moderation_queue AS ENUM (
  'GENERAL_REVIEW', 'MEDIA_REVIEW', 'NCII_URGENT', 'MINOR_SAFETY_RESTRICTED', 'SPAM_ABUSE', 'APPEALS'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE moderation_case_status AS ENUM (
  'OPEN', 'TRIAGED', 'ACTIONED', 'ESCALATED', 'CLOSED_NO_VIOLATION', 'CLOSED_DUPLICATE'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE moderation_queue_item_status AS ENUM ('OPEN', 'CLAIMED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE preservation_status AS ENUM ('NONE', 'PENDING', 'PRESERVED', 'RELEASED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE external_escalation_status AS ENUM (
  'NONE', 'PENDING', 'SUBMITTED', 'ACKNOWLEDGED', 'CLOSED'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE moderation_appeal_status AS ENUM (
  'OPEN', 'UNDER_REVIEW', 'UPHELD', 'DENIED', 'WITHDRAWN'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_content_type varchar(64) NOT NULL,
  target_content_id text NOT NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  policy_reason policy_reason NOT NULL,
  severity policy_severity NOT NULL,
  queue moderation_queue NOT NULL,
  status moderation_case_status NOT NULL DEFAULT 'OPEN',
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  preservation_status preservation_status NOT NULL DEFAULT 'NONE',
  external_escalation_status external_escalation_status NOT NULL DEFAULT 'NONE',
  internal_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  legacy_report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_cases_queue_status_idx ON moderation_cases (queue, status);
CREATE INDEX IF NOT EXISTS moderation_cases_target_idx ON moderation_cases (target_content_type, target_content_id);
CREATE INDEX IF NOT EXISTS moderation_cases_target_user_idx ON moderation_cases (target_user_id);

CREATE TABLE IF NOT EXISTS moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_reason policy_reason NOT NULL,
  body text,
  duplicate_of_report_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS moderation_reports_reporter_case_reason_idx
  ON moderation_reports (reporter_id, case_id, policy_reason);
CREATE INDEX IF NOT EXISTS moderation_reports_case_id_idx ON moderation_reports (case_id);
CREATE INDEX IF NOT EXISTS moderation_reports_reporter_id_idx ON moderation_reports (reporter_id);

CREATE TABLE IF NOT EXISTS moderation_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  queue moderation_queue NOT NULL,
  severity policy_severity NOT NULL,
  status moderation_queue_item_status NOT NULL DEFAULT 'OPEN',
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_queue_items_queue_idx ON moderation_queue_items (queue);
CREATE INDEX IF NOT EXISTS moderation_queue_items_case_id_idx ON moderation_queue_items (case_id);
CREATE INDEX IF NOT EXISTS moderation_queue_items_status_idx ON moderation_queue_items (status);

CREATE TABLE IF NOT EXISTS moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_events_case_created_idx ON moderation_events (case_id, created_at);

CREATE TABLE IF NOT EXISTS content_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  target_content_type varchar(64) NOT NULL,
  target_content_id text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_snapshots_case_id_idx ON content_snapshots (case_id);

CREATE TABLE IF NOT EXISTS user_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag_type varchar(64) NOT NULL,
  severity policy_severity NOT NULL,
  case_id uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_risk_flags_user_id_idx ON user_risk_flags (user_id);
CREATE INDEX IF NOT EXISTS user_risk_flags_case_id_idx ON user_risk_flags (case_id);

CREATE TABLE IF NOT EXISTS moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  appellant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status moderation_appeal_status NOT NULL DEFAULT 'OPEN',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_appeals_case_id_idx ON moderation_appeals (case_id);
CREATE INDEX IF NOT EXISTS moderation_appeals_appellant_idx ON moderation_appeals (appellant_user_id);

ALTER TABLE moderation_actions ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES moderation_cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS moderation_actions_case_id_idx ON moderation_actions (case_id);

-- T&S-2: adult media metadata spine (values aligned with @c2k/shared media-types.ts)
DO $$ BEGIN CREATE TYPE media_upload_status AS ENUM (
  'PENDING_UPLOAD', 'PENDING_ATTESTATION', 'PENDING_SCAN', 'AUTO_APPROVED', 'APPROVED_BLURRED',
  'QUARANTINED', 'REJECTED', 'REMOVED', 'ESCALATED', 'PRESERVED'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE media_content_rating AS ENUM (
  'SAFE_PUBLIC', 'ADULT_NON_EXPLICIT', 'EXPLICIT_ADULT', 'EDGE_REVIEW', 'BLOCKED_ILLEGAL'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE media_visibility AS ENUM (
  'PUBLIC_PREVIEW', 'LOGGED_IN', 'FOLLOWERS', 'PRIVATE_PROFILE', 'GROUP_ONLY', 'ORG_ONLY',
  'EVENT_ATTENDEES', 'CONVENTION_ATTENDEES', 'STAFF_ONLY'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE depicted_people AS ENUM (
  'ONLY_ME', 'ME_AND_OTHER_ADULTS', 'OTHER_ADULTS', 'NO_IDENTIFIABLE_PERSON', 'UNKNOWN'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE media_scan_status AS ENUM (
  'NOT_REQUIRED', 'PENDING', 'PASSED', 'FLAGGED', 'FAILED', 'ERROR'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_type varchar(32) NOT NULL,
  owner_id uuid NOT NULL,
  source_surface varchar(64) NOT NULL,
  storage_key text NOT NULL,
  original_filename varchar(512),
  mime_type varchar(128) NOT NULL,
  size_bytes integer NOT NULL,
  sha256_hash varchar(64),
  perceptual_hash varchar(128),
  upload_status media_upload_status NOT NULL DEFAULT 'PENDING_ATTESTATION',
  content_rating media_content_rating,
  visibility media_visibility,
  depicted_people depicted_people,
  scan_status media_scan_status NOT NULL DEFAULT 'NOT_REQUIRED',
  moderation_case_id uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  reportable boolean NOT NULL DEFAULT true,
  is_blurred_by_default boolean NOT NULL DEFAULT false,
  uploader_confirmed_18 boolean NOT NULL DEFAULT false,
  uploader_confirmed_depicted_adults_18 boolean NOT NULL DEFAULT false,
  uploader_confirmed_consent boolean NOT NULL DEFAULT false,
  uploader_confirmed_right_to_upload boolean NOT NULL DEFAULT false,
  uploader_confirmed_no_ncii boolean NOT NULL DEFAULT false,
  uploader_confirmed_no_minors boolean NOT NULL DEFAULT false,
  uploader_confirmed_no_hidden_camera boolean NOT NULL DEFAULT false,
  uploader_confirmed_no_ai_deepfake_without_consent boolean NOT NULL DEFAULT false,
  attested_at timestamptz,
  attestation_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS media_assets_uploader_idx ON media_assets (uploader_user_id);
CREATE INDEX IF NOT EXISTS media_assets_owner_idx ON media_assets (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS media_assets_upload_status_idx ON media_assets (upload_status);
CREATE INDEX IF NOT EXISTS media_assets_moderation_case_idx ON media_assets (moderation_case_id);

ALTER TABLE profile_photos
  ADD COLUMN IF NOT EXISTS media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;

-- T&S-3: upload pipeline storage lifecycle + scan RUNNING
DO $$ BEGIN
  ALTER TYPE media_scan_status ADD VALUE 'RUNNING';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN CREATE TYPE media_storage_state AS ENUM (
  'PENDING_UPLOAD', 'QUARANTINED_PRIVATE', 'VALIDATED_PRIVATE', 'APPROVED_PUBLIC',
  'REJECTED_PRIVATE', 'REMOVED_PRIVATE', 'DELETED'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS original_storage_key text;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS quarantine_storage_key text;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS public_storage_key text;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS storage_state media_storage_state NOT NULL DEFAULT 'QUARANTINED_PRIVATE';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS storage_provider varchar(32) NOT NULL DEFAULT 's3';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS storage_bucket varchar(128);
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS image_width integer;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS image_height integer;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS perceptual_hash_algorithm varchar(64);
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS promoted_at timestamptz;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS promoted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS media_assets_storage_state_idx ON media_assets (storage_state);

-- T&S-4A: scanner results + internal hash deny/review registry
DO $$ BEGIN CREATE TYPE media_hash_kind AS ENUM ('SHA256', 'PERCEPTUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE media_hash_list_action AS ENUM ('DENY', 'REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE scanner_result_status AS ENUM ('PASSED', 'FLAGGED', 'BLOCKED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS media_hash_list_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash_kind media_hash_kind NOT NULL,
  hash_value varchar(128) NOT NULL,
  hash_algorithm varchar(64),
  list_action media_hash_list_action NOT NULL,
  policy_reason policy_reason NOT NULL,
  source varchar(64) NOT NULL DEFAULT 'internal',
  active boolean NOT NULL DEFAULT true,
  added_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  moderation_case_id uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS media_hash_list_entries_hash_uq
  ON media_hash_list_entries (hash_kind, hash_value, COALESCE(hash_algorithm, ''));
CREATE INDEX IF NOT EXISTS media_hash_list_entries_lookup_idx
  ON media_hash_list_entries (hash_kind, hash_value) WHERE active;

CREATE TABLE IF NOT EXISTS media_scanner_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  scanner_name varchar(64) NOT NULL,
  scanner_version varchar(32) NOT NULL,
  status scanner_result_status NOT NULL,
  confidence real,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_reason policy_reason,
  severity policy_severity,
  queue moderation_queue,
  user_facing_summary text NOT NULL DEFAULT '',
  raw_result_private jsonb NOT NULL DEFAULT '{}'::jsonb,
  simulated boolean NOT NULL DEFAULT false,
  matched_hash_entry_id uuid REFERENCES media_hash_list_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_scanner_results_asset_created_idx
  ON media_scanner_results (media_asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_scanner_results_name_status_idx
  ON media_scanner_results (scanner_name, status);

-- T&S-4B: hash list governance fields (NOT a CSAM database — internal deny/review only)
DO $$ BEGIN CREATE TYPE media_hash_list_source AS ENUM (
  'INTERNAL', 'MODERATOR_REPORT', 'LEGAL_HOLD', 'PARTNER_FEED'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE media_hash_list_entries ADD COLUMN IF NOT EXISTS reason_code varchar(64);
ALTER TABLE media_hash_list_entries ADD COLUMN IF NOT EXISTS created_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE media_hash_list_entries ADD COLUMN IF NOT EXISTS notes_private text;
ALTER TABLE media_hash_list_entries ADD COLUMN IF NOT EXISTS expires_at timestamptz;

DO $$ BEGIN
  ALTER TABLE media_hash_list_entries
    ALTER COLUMN source TYPE media_hash_list_source
    USING (
      CASE upper(coalesce(source::text, 'INTERNAL'))
        WHEN 'MODERATOR_REPORT' THEN 'MODERATOR_REPORT'::media_hash_list_source
        WHEN 'LEGAL_HOLD' THEN 'LEGAL_HOLD'::media_hash_list_source
        WHEN 'PARTNER_FEED' THEN 'PARTNER_FEED'::media_hash_list_source
        ELSE 'INTERNAL'::media_hash_list_source
      END
    );
EXCEPTION WHEN others THEN NULL;
END $$;

-- Legal-profile minimization: 18+ signup fields + legal hold stub (Epic 2 / 4)
DO $$ BEGIN CREATE TYPE age_verification_status AS ENUM (
  'UNVERIFIED', 'SELF_ATTESTED', 'VERIFIED', 'REJECTED'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS age_affirmed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS policy_version_accepted varchar(64);
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS age_verification_status age_verification_status NOT NULL DEFAULT 'UNVERIFIED';

DO $$ BEGIN CREATE TYPE legal_request_status AS ENUM (
  'RECEIVED', 'IN_REVIEW', 'FULFILLED', 'REJECTED', 'CLOSED'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS legal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type varchar(64) NOT NULL,
  status legal_request_status NOT NULL DEFAULT 'RECEIVED',
  subject_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  notes text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_requests_status_idx ON legal_requests (status, received_at DESC);

CREATE TABLE IF NOT EXISTS legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_request_id uuid REFERENCES legal_requests(id) ON DELETE SET NULL,
  target_type varchar(32) NOT NULL,
  target_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  reason text,
  placed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_holds_target_active_idx
  ON legal_holds (target_type, target_id, active);

-- LEGAL-ALPHA-1: platform staff roles, DMCA, legal request extensions, privacy requests
DO $$ BEGIN
  ALTER TYPE platform_staff_role ADD VALUE IF NOT EXISTS 'TRUST_SAFETY_ADMIN';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE platform_staff_role ADD VALUE IF NOT EXISTS 'LEGAL_ADMIN';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE platform_staff ADD COLUMN IF NOT EXISTS last_step_up_at timestamptz;
ALTER TABLE platform_staff ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;

DO $$ BEGIN CREATE TYPE dmca_case_status AS ENUM (
  'RECEIVED', 'DISABLED', 'COUNTER_NOTICE_RECEIVED', 'RESTORED', 'REJECTED', 'CLOSED'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS dmca_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status dmca_case_status NOT NULL DEFAULT 'RECEIVED',
  claimant_name varchar(255) NOT NULL,
  claimant_email varchar(320) NOT NULL,
  work_identified text NOT NULL,
  infringing_url text NOT NULL,
  target_content_type varchar(64),
  target_content_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  notes_private text,
  repeat_infringer_flag boolean NOT NULL DEFAULT false,
  created_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dmca_cases_status_idx ON dmca_cases (status, received_at DESC);
CREATE INDEX IF NOT EXISTS dmca_cases_target_idx ON dmca_cases (target_content_type, target_content_id);

ALTER TABLE legal_requests ADD COLUMN IF NOT EXISTS received_via varchar(64);
ALTER TABLE legal_requests ADD COLUMN IF NOT EXISTS requester_name varchar(255);
ALTER TABLE legal_requests ADD COLUMN IF NOT EXISTS requester_agency varchar(255);
ALTER TABLE legal_requests ADD COLUMN IF NOT EXISTS jurisdiction varchar(128);
ALTER TABLE legal_requests ADD COLUMN IF NOT EXISTS scope_summary text;
ALTER TABLE legal_requests ADD COLUMN IF NOT EXISTS gag_order boolean NOT NULL DEFAULT false;
ALTER TABLE legal_requests ADD COLUMN IF NOT EXISTS user_notice_allowed boolean NOT NULL DEFAULT true;
ALTER TABLE legal_requests ADD COLUMN IF NOT EXISTS notes_private text;

ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS created_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL;

DO $$ BEGIN CREATE TYPE user_privacy_request_type AS ENUM ('EXPORT_JSON', 'DEACTIVATE', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE user_privacy_request_status AS ENUM (
  'PENDING', 'PROCESSING', 'READY', 'COMPLETED', 'BLOCKED_LEGAL_HOLD', 'CANCELLED'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type user_privacy_request_type NOT NULL,
  status user_privacy_request_status NOT NULL DEFAULT 'PENDING',
  export_payload jsonb,
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_privacy_requests_user_idx ON user_privacy_requests (user_id, status);
CREATE INDEX IF NOT EXISTS user_privacy_requests_status_idx ON user_privacy_requests (status, requested_at DESC);

-- Contact inquiries (public intake)
DO $$ BEGIN CREATE TYPE contact_inquiry_status AS ENUM ('RECEIVED', 'IN_REVIEW', 'REPLIED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status contact_inquiry_status NOT NULL DEFAULT 'RECEIVED',
  category varchar(64) NOT NULL,
  subject varchar(255) NOT NULL,
  sender_name varchar(255) NOT NULL,
  sender_email varchar(320) NOT NULL,
  message text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes_private text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_inquiries_status_idx ON contact_inquiries (status, received_at DESC);
CREATE INDEX IF NOT EXISTS contact_inquiries_category_idx ON contact_inquiries (category, received_at DESC);

-- Trust & accountability alpha schema
DO $$ BEGIN CREATE TYPE trust_scope_type AS ENUM ('organization', 'group', 'event', 'convention');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trust_signal_visibility AS ENUM ('PUBLIC_POSITIVE', 'SELF_ONLY', 'SCOPED_MOD', 'PLATFORM_MOD', 'SITE_ADMIN_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trust_signal_status AS ENUM ('ACTIVE', 'EXPIRED', 'OVERTURNED', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE community_trust_level AS ENUM ('NEW_MEMBER', 'BUILDING_TRUST', 'ESTABLISHED_MEMBER', 'COMMUNITY_KNOWN', 'VERIFIED_CONTRIBUTOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE scoped_standing AS ENUM ('GOOD_STANDING', 'NEEDS_ATTENTION', 'LIMITED', 'TIMED_OUT', 'BANNED', 'ESCALATED_TO_PLATFORM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE moderation_incident_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED', 'CLOSED_NO_VIOLATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE incident_finding AS ENUM ('NO_VIOLATION', 'INSUFFICIENT_INFO', 'CONCERNING_PATTERN', 'LOCAL_RULE_VIOLATION', 'SPAM_OR_DISRUPTION', 'BOUNDARY_WARNING', 'CONFIRMED_SPAM', 'CONFIRMED_HARASSMENT', 'CONFIRMED_CONSENT_VIOLATION', 'CONFIRMED_SEVERE_SAFETY_VIOLATION', 'RETALIATION_OR_BAD_FAITH_REPORT', 'ESCALATED_TO_PLATFORM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE incident_participant_role AS ENUM ('REPORTED_USER', 'REPORTER', 'AFFECTED_USER', 'WITNESS', 'MODERATOR', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE messaging_health_state AS ENUM ('HEALTHY', 'NEW_LIMITED_HISTORY', 'HIGH_OUTREACH_VOLUME', 'NEEDS_COOLDOWN', 'MOD_REVIEW_RECOMMENDED', 'RESTRICTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE messaging_restriction_type AS ENUM ('NEW_CONVERSATION_RATE_LIMIT', 'DM_COOLDOWN', 'PROFILE_COMPLETION_REQUIRED', 'SCOPED_MESSAGING_TIMEOUT', 'PLATFORM_MESSAGING_TIMEOUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE messaging_restriction_status AS ENUM ('ACTIVE', 'EXPIRED', 'OVERTURNED', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE scoped_appeal_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'WITHDRAWN', 'ESCALATED_TO_PLATFORM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS trust_signal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type trust_scope_type,
  scope_id uuid,
  signal_type varchar(64) NOT NULL,
  source_type varchar(64) NOT NULL,
  source_id uuid,
  severity policy_severity,
  confidence double precision,
  visibility trust_signal_visibility NOT NULL DEFAULT 'PLATFORM_MOD',
  status trust_signal_status NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  appeal_status varchar(32),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trust_signal_events_user_idx ON trust_signal_events (user_id);
CREATE INDEX IF NOT EXISTS trust_signal_events_scope_idx ON trust_signal_events (scope_type, scope_id);

CREATE TABLE IF NOT EXISTS trust_signal_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type trust_scope_type,
  scope_id uuid,
  account_level community_trust_level,
  community_level community_trust_level,
  scoped_standing scoped_standing NOT NULL DEFAULT 'GOOD_STANDING',
  positive_badge_count integer NOT NULL DEFAULT 0,
  caution_signal_count integer NOT NULL DEFAULT 0,
  active_restriction_count integer NOT NULL DEFAULT 0,
  last_recomputed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS trust_signal_rollups_user_idx ON trust_signal_rollups (user_id);

CREATE TABLE IF NOT EXISTS moderation_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type trust_scope_type,
  scope_id uuid,
  primary_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_reason policy_reason,
  severity policy_severity NOT NULL DEFAULT 'MEDIUM',
  status moderation_incident_status NOT NULL DEFAULT 'OPEN',
  finding incident_finding,
  platform_case_id uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  platform_escalated_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  appeal_status varchar(32),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_incidents_primary_user_idx ON moderation_incidents (primary_user_id);

CREATE TABLE IF NOT EXISTS incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES moderation_incidents(id) ON DELETE CASCADE,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  moderation_report_id uuid REFERENCES moderation_reports(id) ON DELETE SET NULL,
  reporter_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  relationship_context varchar(64),
  is_primary boolean NOT NULL DEFAULT false,
  is_duplicate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incident_reports_incident_idx ON incident_reports (incident_id);

CREATE TABLE IF NOT EXISTS incident_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES moderation_incidents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role incident_participant_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES moderation_incidents(id) ON DELETE CASCADE,
  action_type varchar(64) NOT NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  scope_type trust_scope_type,
  scope_id uuid,
  moderation_action_id uuid,
  scope_ban_id uuid REFERENCES scope_bans(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messaging_health_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  outbound_message_count integer NOT NULL DEFAULT 0,
  unique_recipient_count integer NOT NULL DEFAULT 0,
  new_conversation_count integer NOT NULL DEFAULT 0,
  repeated_message_score double precision,
  reply_ratio double precision,
  block_after_contact_count integer NOT NULL DEFAULT 0,
  mute_after_contact_count integer NOT NULL DEFAULT 0,
  report_after_contact_count integer NOT NULL DEFAULT 0,
  independent_reporter_count integer NOT NULL DEFAULT 0,
  state messaging_health_state NOT NULL DEFAULT 'HEALTHY',
  last_recomputed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS messaging_health_rollups_user_idx ON messaging_health_rollups (user_id);

CREATE TABLE IF NOT EXISTS messaging_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restriction_type messaging_restriction_type NOT NULL,
  reason_category varchar(64) NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES moderation_incidents(id) ON DELETE SET NULL,
  status messaging_restriction_status NOT NULL DEFAULT 'ACTIVE',
  appeal_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS messaging_restrictions_user_idx ON messaging_restrictions (user_id);

CREATE TABLE IF NOT EXISTS scoped_standing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type trust_scope_type NOT NULL,
  scope_id uuid NOT NULL,
  standing_before scoped_standing NOT NULL,
  standing_after scoped_standing NOT NULL,
  reason_category varchar(64) NOT NULL,
  source_type varchar(64) NOT NULL,
  source_id uuid,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz,
  appeal_status varchar(32),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scoped_moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type trust_scope_type NOT NULL,
  scope_id uuid NOT NULL,
  source_type varchar(64) NOT NULL,
  source_id uuid NOT NULL,
  reason text NOT NULL,
  status scoped_appeal_status NOT NULL DEFAULT 'OPEN',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS scoped_moderation_appeals_user_idx ON scoped_moderation_appeals (user_id);

-- Feed post reactions (kind on post_likes) + comments
ALTER TABLE post_likes
  ADD COLUMN IF NOT EXISTS kind varchar(16) NOT NULL DEFAULT 'love';

CREATE INDEX IF NOT EXISTS post_likes_post_kind_idx ON post_likes (post_id, kind);

CREATE TABLE IF NOT EXISTS feed_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feed_post_comments_post_created_idx ON feed_post_comments (post_id, created_at);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_ip varchar(64)
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_hash_idx ON password_reset_tokens (token_hash);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_ciphertext text,
  ADD COLUMN IF NOT EXISTS email_lookup_hash varchar(64),
  ADD COLUMN IF NOT EXISTS email_key_version integer NOT NULL DEFAULT 1;

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lookup_hash_idx ON users (email_lookup_hash)
  WHERE email_lookup_hash IS NOT NULL;

ALTER TYPE platform_staff_role ADD VALUE IF NOT EXISTS 'OWNER_ADMIN';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS dormant_notice_sent_at timestamptz;

ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$ BEGIN
  CREATE TYPE presenter_profile_focus AS ENUM (
    'EDUCATOR',
    'PRESENTER',
    'SPEAKER',
    'PANELIST',
    'AUTHOR',
    'PHOTOGRAPHER',
    'MEDIA_CREATOR',
    'DEMO_PARTNER',
    'FACILITATOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS presenter_profile_focuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES presenter_profiles(user_id) ON DELETE CASCADE,
  focus presenter_profile_focus NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, focus)
);
CREATE INDEX IF NOT EXISTS presenter_profile_focuses_user_idx ON presenter_profile_focuses (user_id);

ALTER TABLE profile_photos ADD COLUMN IF NOT EXISTS display_settings jsonb;

CREATE TABLE IF NOT EXISTS alpha_seed_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key varchar(128) NOT NULL UNIQUE,
  source_name varchar(255) NOT NULL,
  source_url text,
  source_repo text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alpha_seed_batches_created_idx ON alpha_seed_batches (created_at);

CREATE TABLE IF NOT EXISTS alpha_seed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES alpha_seed_batches(id) ON DELETE CASCADE,
  target_type varchar(64) NOT NULL,
  target_id text NOT NULL,
  source_type varchar(64),
  source_slug varchar(255),
  label_text varchar(64) NOT NULL DEFAULT 'ALPHA TEST',
  is_synthetic boolean NOT NULL DEFAULT false,
  is_public_source boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alpha_seed_items_batch_target_uq UNIQUE (batch_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS alpha_seed_items_target_idx ON alpha_seed_items (target_type, target_id);
CREATE INDEX IF NOT EXISTS alpha_seed_items_batch_idx ON alpha_seed_items (batch_id);

ALTER TABLE community_places
  ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE community_places
  ADD COLUMN IF NOT EXISTS linked_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS community_places_linked_org_idx ON community_places (linked_organization_id);

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS member_list_visibility varchar(16) NOT NULL DEFAULT 'visible';
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS show_group_on_profile boolean NOT NULL DEFAULT true;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS announce_group_join_in_feed boolean NOT NULL DEFAULT true;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS visibility_updated_at timestamptz;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS visibility_updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Media social layer (photos/videos as first-class objects)
DO $$ BEGIN
  CREATE TYPE media_kind AS ENUM ('image', 'video', 'audio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_comment_policy AS ENUM ('everyone_allowed_by_visibility', 'connections', 'no_one');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_people_tag_status AS ENUM ('pending', 'approved', 'declined', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_album_kind AS ENUM ('default_all', 'profile_pictures', 'uploaded_pictures', 'tagged_pictures', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS video_width integer;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS video_height integer;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS poster_storage_key text;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS transcoding_status varchar(32);

CREATE TABLE IF NOT EXISTS media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  media_kind media_kind NOT NULL,
  caption text,
  visibility media_visibility NOT NULL,
  comment_policy media_comment_policy NOT NULL DEFAULT 'connections',
  show_in_feed boolean NOT NULL DEFAULT true,
  pinned_to_profile boolean NOT NULL DEFAULT false,
  use_as_avatar boolean NOT NULL DEFAULT false,
  content_rating media_content_rating,
  is_blurred_by_default boolean NOT NULL DEFAULT false,
  source_surface varchar(64) NOT NULL,
  source_group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  source_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  source_convention_id uuid REFERENCES conventions(id) ON DELETE SET NULL,
  original_feed_post_id uuid REFERENCES feed_posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS media_items_owner_created_idx ON media_items (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_items_asset_idx ON media_items (media_asset_id);
CREATE INDEX IF NOT EXISTS media_items_source_group_idx ON media_items (source_group_id);
CREATE INDEX IF NOT EXISTS media_items_source_event_idx ON media_items (source_event_id);
CREATE INDEX IF NOT EXISTS media_items_source_convention_idx ON media_items (source_convention_id);
CREATE INDEX IF NOT EXISTS media_items_visibility_idx ON media_items (visibility);
CREATE INDEX IF NOT EXISTS media_items_deleted_at_idx ON media_items (deleted_at);

CREATE TABLE IF NOT EXISTS media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption text,
  visibility media_visibility NOT NULL,
  comment_policy media_comment_policy NOT NULL DEFAULT 'connections',
  show_in_feed boolean NOT NULL DEFAULT true,
  feed_post_id uuid REFERENCES feed_posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS media_posts_owner_created_idx ON media_posts (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_posts_feed_post_idx ON media_posts (feed_post_id);
CREATE INDEX IF NOT EXISTS media_posts_deleted_at_idx ON media_posts (deleted_at);

CREATE TABLE IF NOT EXISTS media_post_items (
  media_post_id uuid NOT NULL REFERENCES media_posts(id) ON DELETE CASCADE,
  media_item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (media_post_id, media_item_id)
);

CREATE TABLE IF NOT EXISTS media_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  slug varchar(128) NOT NULL,
  description text,
  visibility media_visibility NOT NULL DEFAULT 'LOGGED_IN',
  cover_media_item_id uuid REFERENCES media_items(id) ON DELETE SET NULL,
  album_kind media_album_kind NOT NULL DEFAULT 'custom',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS media_albums_owner_slug_uq ON media_albums (owner_user_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS media_albums_owner_sort_idx ON media_albums (owner_user_id, sort_order);
CREATE INDEX IF NOT EXISTS media_albums_visibility_idx ON media_albums (visibility);
CREATE INDEX IF NOT EXISTS media_albums_deleted_at_idx ON media_albums (deleted_at);

CREATE TABLE IF NOT EXISTS media_album_items (
  album_id uuid NOT NULL REFERENCES media_albums(id) ON DELETE CASCADE,
  media_item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, media_item_id)
);

CREATE TABLE IF NOT EXISTS media_item_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  tag varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS media_item_tags_item_tag_uq ON media_item_tags (media_item_id, lower(tag));
CREATE INDEX IF NOT EXISTS media_item_tags_item_idx ON media_item_tags (media_item_id);

CREATE TABLE IF NOT EXISTS media_people_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  tagged_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tagged_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status media_people_tag_status NOT NULL DEFAULT 'pending',
  x double precision,
  y double precision,
  label varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_people_tags_item_idx ON media_people_tags (media_item_id);
CREATE INDEX IF NOT EXISTS media_people_tags_tagged_user_idx ON media_people_tags (tagged_user_id);
CREATE INDEX IF NOT EXISTS media_people_tags_status_idx ON media_people_tags (status);

CREATE TABLE IF NOT EXISTS media_reactions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL DEFAULT 'love',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, media_item_id)
);
CREATE INDEX IF NOT EXISTS media_reactions_item_idx ON media_reactions (media_item_id);

CREATE TABLE IF NOT EXISTS media_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS media_comments_item_created_idx ON media_comments (media_item_id, created_at);
CREATE INDEX IF NOT EXISTS media_comments_author_idx ON media_comments (author_id);

DO $$ BEGIN
  CREATE TYPE mail_intake_status AS ENUM ('new', 'triaged', 'assigned', 'waiting', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE mail_intake_priority AS ENUM ('normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE mail_intake_visibility AS ENUM ('owner_only', 'admin_only', 'trust_safety', 'support', 'business');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS mail_intake_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox varchar(320) NOT NULL,
  message_id varchar(512) NOT NULL,
  thread_key varchar(512),
  from_name varchar(255),
  from_email varchar(320) NOT NULL,
  to_email varchar(320) NOT NULL,
  subject varchar(512) NOT NULL,
  received_at timestamptz NOT NULL,
  plain_text_body text,
  sanitized_html_body text,
  attachment_metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
  status mail_intake_status NOT NULL DEFAULT 'new',
  priority mail_intake_priority NOT NULL DEFAULT 'normal',
  visibility mail_intake_visibility NOT NULL DEFAULT 'support',
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  linked_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  linked_moderation_case_id uuid REFERENCES moderation_cases(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mail_intake_items_mailbox_message_uq ON mail_intake_items (mailbox, message_id);
CREATE INDEX IF NOT EXISTS mail_intake_items_mailbox_status_idx ON mail_intake_items (mailbox, status, received_at);
CREATE INDEX IF NOT EXISTS mail_intake_items_visibility_idx ON mail_intake_items (visibility, status, received_at);

ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE user_notification_preferences
  ALTER COLUMN push_hub_announcements SET DEFAULT false;

ALTER TABLE user_notification_preferences
  ALTER COLUMN push_hub_chat SET DEFAULT false;

CREATE TABLE IF NOT EXISTS organization_claim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  token varchar(128) NOT NULL UNIQUE,
  created_by_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  redeemed_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_claim_tokens_org_idx ON organization_claim_tokens (organization_id);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_place_id uuid REFERENCES community_places (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_venue_place_id_idx ON events (venue_place_id);

-- Convention trusted roles: application window columns (Drizzle schema ahead of db:push on some baselines)
ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS apply_opens_at timestamptz;
ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS apply_closes_at timestamptz;

-- ECKE publish targets: Pass 3 group_listing lifecycle columns
ALTER TABLE ecke_publish_targets
  ADD COLUMN IF NOT EXISTS ecke_public_url text;
ALTER TABLE ecke_publish_targets
  ADD COLUMN IF NOT EXISTS ecke_record_id uuid;
ALTER TABLE ecke_publish_targets
  ADD COLUMN IF NOT EXISTS unpublished_at timestamptz;

DO $$ BEGIN
  ALTER TYPE ecke_publish_status ADD VALUE IF NOT EXISTS 'unpublished';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Vendor curated native products (outbound listing URLs)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS listing_url text;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE products p
SET listing_url = COALESCE(
  NULLIF(TRIM(p.listing_url), ''),
  NULLIF(TRIM(v.website), ''),
  '#'
)
FROM vendor_profiles v
WHERE p.vendor_id = v.id
  AND (p.listing_url IS NULL OR TRIM(p.listing_url) = '');

UPDATE products
SET listing_url = '#'
WHERE listing_url IS NULL OR TRIM(listing_url) = '';

ALTER TABLE products
  ALTER COLUMN listing_url SET DEFAULT '#';
ALTER TABLE products
  ALTER COLUMN listing_url SET NOT NULL;

-- Soft email verification (member onboarding)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  code_hash varchar(64),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx
  ON email_verification_tokens (user_id);
CREATE INDEX IF NOT EXISTS email_verification_tokens_token_hash_idx
  ON email_verification_tokens (token_hash);

-- Per-org Stripe Connect (ADR 006)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted boolean NOT NULL DEFAULT false;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_connect_updated_at timestamptz;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_membership_config jsonb NOT NULL DEFAULT '{"plans":[]}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_stripe_connect_account_id_uq
  ON organizations (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS membership_billing jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  convention_id uuid REFERENCES conventions (id) ON DELETE SET NULL,
  category_id uuid,
  stripe_session_id text NOT NULL,
  stripe_account_id text NOT NULL,
  mode varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'open',
  amount_cents integer,
  currency varchar(8) NOT NULL DEFAULT 'usd',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_checkout_sessions_session_id_uq
  ON stripe_checkout_sessions (stripe_session_id);
CREATE INDEX IF NOT EXISTS stripe_checkout_sessions_org_idx
  ON stripe_checkout_sessions (org_id);
CREATE INDEX IF NOT EXISTS stripe_checkout_sessions_user_idx
  ON stripe_checkout_sessions (user_id);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL,
  type varchar(128) NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_webhook_events_event_id_uq
  ON stripe_webhook_events (stripe_event_id);

-- Org payment processor preference + OWNER-delegated payments managers (ADR 006)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS payment_processor varchar(32) NOT NULL DEFAULT 'stripe';
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS external_payment_url text;
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS can_manage_payments boolean NOT NULL DEFAULT false;

-- Secondary payments vault password (per user; gates Connect / processor UI)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payments_vault_password_hash text;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payments_vault_unlocked_at timestamptz;

-- Event ticket Checkout (org Connect) + vendor-owned Connect (ADR 006)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS price_cents integer;
ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS paid_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS payment_processor varchar(32) NOT NULL DEFAULT 'external';
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS external_payment_url text;
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted boolean NOT NULL DEFAULT false;
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_updated_at timestamptz;

ALTER TABLE stripe_checkout_sessions
  ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE stripe_checkout_sessions
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events (id) ON DELETE SET NULL;
ALTER TABLE stripe_checkout_sessions
  ADD COLUMN IF NOT EXISTS vendor_profile_id uuid REFERENCES vendor_profiles (id) ON DELETE SET NULL;
ALTER TABLE stripe_checkout_sessions
  ADD COLUMN IF NOT EXISTS product_id uuid;

CREATE INDEX IF NOT EXISTS stripe_checkout_sessions_event_idx
  ON stripe_checkout_sessions (event_id);
CREATE INDEX IF NOT EXISTS stripe_checkout_sessions_vendor_idx
  ON stripe_checkout_sessions (vendor_profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_profiles_stripe_connect_account_id_uq
  ON vendor_profiles (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;
`

async function main() {
  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://c2k:c2k_dev@127.0.0.1:6432/c2k_dev?sslmode=disable',
    ssl: process.env.DATABASE_SSL === 'true' ? undefined : false,
  })
  try {
    await pool.query(sql)
    console.log('Incremental schema migration applied.')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
