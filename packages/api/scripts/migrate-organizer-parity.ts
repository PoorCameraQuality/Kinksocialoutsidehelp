/**
 * Idempotent migration script for ECKE 007–059 parity additions to the
 * convention organizer schema. Safe to run multiple times: every statement
 * uses ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / CREATE TABLE
 * IF NOT EXISTS. Designed to apply on a database that already has the older
 * convention_* tables created by `npm run db:push -w @c2k/api` and to bring
 * them up to the full kit-shape so the Convention Command Bridge can save
 * every menu without errors.
 *
 * Usage:
 *   npx tsx packages/api/scripts/migrate-organizer-parity.ts
 */
import '../src/db/load-dev-env.js'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? undefined : false,
})

const SQL = `
-- Enums (CREATE TYPE IF NOT EXISTS not supported in PG; use DO blocks).
DO $$ BEGIN
  CREATE TYPE convention_policy_kind AS ENUM ('coc', 'waiver', 'photo', 'marketing', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE convention_trusted_role_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE convention_registration_form_status AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE convention_message_campaign_status AS ENUM (
    'draft', 'queued', 'sending', 'sent', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE convention_calendar_feed_scope AS ENUM ('full', 'track', 'location', 'person');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Registration categories: ECKE 033 + 034 + 036.
ALTER TABLE convention_registration_categories
  ADD COLUMN IF NOT EXISTS access_code varchar(64);
ALTER TABLE convention_registration_categories
  ADD COLUMN IF NOT EXISTS grants_staff_access boolean NOT NULL DEFAULT false;
ALTER TABLE convention_registration_categories
  ADD COLUMN IF NOT EXISTS role_kind varchar(32) NOT NULL DEFAULT 'attendee';
ALTER TABLE convention_registration_categories
  ADD COLUMN IF NOT EXISTS check_in_valid_from timestamptz;
ALTER TABLE convention_registration_categories
  ADD COLUMN IF NOT EXISTS check_in_valid_through timestamptz;
ALTER TABLE convention_registration_categories
  ADD COLUMN IF NOT EXISTS external_source_ref text;
ALTER TABLE convention_registration_categories
  ADD COLUMN IF NOT EXISTS imported_payment_status varchar(64);

-- Registration forms + questions: ECKE 012 + 044.
ALTER TABLE convention_registration_forms
  ADD COLUMN IF NOT EXISTS status convention_registration_form_status NOT NULL DEFAULT 'draft';
ALTER TABLE convention_registration_forms
  ADD COLUMN IF NOT EXISTS intro_text text NOT NULL DEFAULT '';
ALTER TABLE convention_registration_forms
  ADD COLUMN IF NOT EXISTS confirmation_text text NOT NULL DEFAULT '';
ALTER TABLE convention_registration_questions
  ADD COLUMN IF NOT EXISTS options_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE convention_registration_questions
  ADD COLUMN IF NOT EXISTS visibility_rules_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE convention_registration_questions
  ADD COLUMN IF NOT EXISTS required_for_category_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE convention_registration_questions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Registrants: ECKE 012 (legal/phone/consent) + 024 (external sync) + 031 (rabbitsign).
ALTER TABLE convention_registrants
  ADD COLUMN IF NOT EXISTS legal_name varchar(255);
ALTER TABLE convention_registrants
  ADD COLUMN IF NOT EXISTS phone varchar(64);
ALTER TABLE convention_registrants
  ADD COLUMN IF NOT EXISTS external_source varchar(64);
ALTER TABLE convention_registrants
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE convention_registrants
  ADD COLUMN IF NOT EXISTS consent_waiver_ack_at timestamptz;
ALTER TABLE convention_registrants
  ADD COLUMN IF NOT EXISTS consent_photo_ack_at timestamptz;
ALTER TABLE convention_registrants
  ADD COLUMN IF NOT EXISTS rabbitsign_folder_id varchar(128);
ALTER TABLE convention_registrants
  ADD COLUMN IF NOT EXISTS rabbitsign_status varchar(64);
CREATE INDEX IF NOT EXISTS convention_registrants_conv_status_idx
  ON convention_registrants (convention_id, registration_status);
CREATE INDEX IF NOT EXISTS convention_registrants_conv_external_idx
  ON convention_registrants (convention_id, external_source, external_id);

-- Registrant tag assignments: ECKE 012.
CREATE TABLE IF NOT EXISTS convention_registrant_tag_assignments (
  registrant_id uuid NOT NULL REFERENCES convention_registrants(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES convention_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registrant_id, tag_id)
);
CREATE INDEX IF NOT EXISTS convention_registrant_tags_tag_idx
  ON convention_registrant_tag_assignments (tag_id);

-- Policy documents + acceptances: ECKE 018 + 031.
ALTER TABLE convention_policy_documents
  ADD COLUMN IF NOT EXISTS kind convention_policy_kind NOT NULL DEFAULT 'other';
ALTER TABLE convention_policy_documents
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE convention_policy_documents
  ADD COLUMN IF NOT EXISTS body_markdown text;
ALTER TABLE convention_policy_documents
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
CREATE INDEX IF NOT EXISTS convention_policy_docs_conv_kind_idx
  ON convention_policy_documents (convention_id, kind);
ALTER TABLE convention_registrant_policy_acceptances
  ADD COLUMN IF NOT EXISTS signer_name varchar(255);
ALTER TABLE convention_registrant_policy_acceptances
  ADD COLUMN IF NOT EXISTS signer_email varchar(255);
ALTER TABLE convention_registrant_policy_acceptances
  ADD COLUMN IF NOT EXISTS signature_method varchar(64);
ALTER TABLE convention_registrant_policy_acceptances
  ADD COLUMN IF NOT EXISTS provider_ref varchar(255);
ALTER TABLE convention_registrant_policy_acceptances
  ADD COLUMN IF NOT EXISTS ip_hash varchar(128);

-- Trusted roles + questions: ECKE 038.
ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS apply_slug varchar(64);
ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS status convention_trusted_role_status NOT NULL DEFAULT 'draft';
ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS intro_text text NOT NULL DEFAULT '';
ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS confirmation_text text NOT NULL DEFAULT '';
ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS convention_trusted_role_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES convention_trusted_roles(id) ON DELETE CASCADE,
  type varchar(32) NOT NULL DEFAULT 'text',
  label varchar(512) NOT NULL,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  options_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility_rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_trusted_role_questions_role_sort_idx
  ON convention_trusted_role_questions (role_id, sort_order);

-- Vetting applications: ECKE 038 + organizer_notes top-level.
ALTER TABLE convention_vetting_applications
  ADD COLUMN IF NOT EXISTS applicant_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE convention_vetting_applications
  ADD COLUMN IF NOT EXISTS trusted_role_id uuid REFERENCES convention_trusted_roles(id) ON DELETE SET NULL;
ALTER TABLE convention_vetting_applications
  ADD COLUMN IF NOT EXISTS organizer_notes text;
CREATE INDEX IF NOT EXISTS convention_vetting_role_idx
  ON convention_vetting_applications (convention_id, trusted_role_id);

-- Messaging: ECKE 022.
ALTER TABLE convention_message_templates
  ADD COLUMN IF NOT EXISTS body_text text;
ALTER TABLE convention_message_campaigns
  ADD COLUMN IF NOT EXISTS status convention_message_campaign_status NOT NULL DEFAULT 'draft';
ALTER TABLE convention_message_campaigns
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE convention_message_campaigns
  ADD COLUMN IF NOT EXISTS send_error text;
ALTER TABLE convention_message_deliveries
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(128);
ALTER TABLE convention_message_deliveries
  ADD COLUMN IF NOT EXISTS provider_message_id varchar(255);
ALTER TABLE convention_message_deliveries
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS convention_message_deliveries_idempotency_idx
  ON convention_message_deliveries (campaign_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Calendar feed tokens: ECKE 021.
ALTER TABLE convention_calendar_feed_tokens
  ADD COLUMN IF NOT EXISTS scope convention_calendar_feed_scope NOT NULL DEFAULT 'full';
ALTER TABLE convention_calendar_feed_tokens
  ADD COLUMN IF NOT EXISTS filter_track_id uuid REFERENCES convention_tracks(id) ON DELETE SET NULL;
ALTER TABLE convention_calendar_feed_tokens
  ADD COLUMN IF NOT EXISTS filter_location_id uuid REFERENCES convention_locations(id) ON DELETE SET NULL;
ALTER TABLE convention_calendar_feed_tokens
  ADD COLUMN IF NOT EXISTS filter_person_id uuid REFERENCES convention_persons(id) ON DELETE SET NULL;

-- Webhook delivery log + audit log: ECKE 026.
CREATE TABLE IF NOT EXISTS convention_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES convention_webhook_subscriptions(id) ON DELETE CASCADE,
  event_type varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'pending',
  status_code integer,
  error text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_webhook_deliveries_sub_idx
  ON convention_webhook_deliveries (subscription_id, created_at);
CREATE INDEX IF NOT EXISTS convention_webhook_deliveries_status_idx
  ON convention_webhook_deliveries (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS convention_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(128) NOT NULL,
  entity_type varchar(64),
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_audit_log_conv_idx
  ON convention_audit_log (convention_id, created_at);
CREATE INDEX IF NOT EXISTS convention_audit_log_entity_idx
  ON convention_audit_log (convention_id, entity_type, entity_id);

-- Schedule change notifications: ECKE 007.
CREATE TABLE IF NOT EXISTS convention_schedule_change_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  slot_id uuid,
  notified_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  summary text,
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  organizer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_schedule_change_notif_conv_idx
  ON convention_schedule_change_notifications (convention_id, created_at);

-- Session feedback responses: ECKE 050.
CREATE TABLE IF NOT EXISTS convention_session_feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL,
  registrant_id uuid REFERENCES convention_registrants(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  rating integer,
  comment text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_session_feedback_responses_conv_slot_idx
  ON convention_session_feedback_responses (convention_id, slot_id);
CREATE UNIQUE INDEX IF NOT EXISTS convention_session_feedback_responses_slot_user_idx
  ON convention_session_feedback_responses (slot_id, user_id) WHERE user_id IS NOT NULL;

-- Persons extras: ECKE 011.
ALTER TABLE convention_persons
  ADD COLUMN IF NOT EXISTS legal_name varchar(255);
ALTER TABLE convention_persons
  ADD COLUMN IF NOT EXISTS show_legal_name_on_public boolean NOT NULL DEFAULT false;
ALTER TABLE convention_persons
  ADD COLUMN IF NOT EXISTS phone varchar(64);
ALTER TABLE convention_persons
  ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE convention_persons
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Exhibitors extras: ECKE 059.
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS hours text;
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS logo_path text;
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS specials text;
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Meal signups extras: ECKE 058.
ALTER TABLE convention_meal_signups
  ADD COLUMN IF NOT EXISTS meal_choice varchar(128);
ALTER TABLE convention_meal_signups
  ADD COLUMN IF NOT EXISTS dietary_notes text;
ALTER TABLE convention_meal_signups
  ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'confirmed';

-- Attendee groups: ECKE 054 (subtables).
ALTER TABLE convention_attendee_groups
  ADD COLUMN IF NOT EXISTS visibility varchar(32) NOT NULL DEFAULT 'public';
ALTER TABLE convention_attendee_groups
  ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'open';
ALTER TABLE convention_attendee_groups
  ADD COLUMN IF NOT EXISTS capacity integer;
ALTER TABLE convention_attendee_groups
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS convention_attendee_group_members (
  group_id uuid NOT NULL REFERENCES convention_attendee_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(32) NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS convention_attendee_group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES convention_attendee_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text,
  status varchar(32) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS convention_attendee_group_join_req_group_user_idx
  ON convention_attendee_group_join_requests (group_id, user_id);

CREATE TABLE IF NOT EXISTS convention_attendee_group_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES convention_attendee_groups(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_attendee_group_announcements_group_idx
  ON convention_attendee_group_announcements (group_id, created_at);

CREATE TABLE IF NOT EXISTS convention_attendee_group_chores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES convention_attendee_groups(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(32) NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_attendee_group_chores_group_idx
  ON convention_attendee_group_chores (group_id);

CREATE TABLE IF NOT EXISTS convention_attendee_group_bring_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES convention_attendee_groups(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  bringer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_attendee_group_bring_items_group_idx
  ON convention_attendee_group_bring_items (group_id);

CREATE TABLE IF NOT EXISTS convention_attendee_group_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES convention_attendee_groups(id) ON DELETE CASCADE,
  reporter_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  status varchar(32) NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_attendee_group_reports_group_idx
  ON convention_attendee_group_reports (group_id, created_at);

-- Door check-in token uniqueness: ECKE 041.
CREATE UNIQUE INDEX IF NOT EXISTS convention_registrants_check_in_token_idx
  ON convention_registrants (convention_id, check_in_token) WHERE check_in_token IS NOT NULL;

-- Participation apply + offer letters.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'convention_vetting_status' AND e.enumlabel = 'offered'
  ) THEN ALTER TYPE convention_vetting_status ADD VALUE 'offered'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'convention_vetting_status' AND e.enumlabel = 'offer_accepted'
  ) THEN ALTER TYPE convention_vetting_status ADD VALUE 'offer_accepted'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'convention_vetting_status' AND e.enumlabel = 'offer_declined'
  ) THEN ALTER TYPE convention_vetting_status ADD VALUE 'offer_declined'; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'convention_presenter_request_status' AND e.enumlabel = 'OFFERED'
  ) THEN ALTER TYPE convention_presenter_request_status ADD VALUE 'OFFERED'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'convention_presenter_request_status' AND e.enumlabel = 'OFFER_ACCEPTED'
  ) THEN ALTER TYPE convention_presenter_request_status ADD VALUE 'OFFER_ACCEPTED'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'convention_presenter_request_status' AND e.enumlabel = 'OFFER_DECLINED'
  ) THEN ALTER TYPE convention_presenter_request_status ADD VALUE 'OFFER_DECLINED'; END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE convention_participation_offer_source AS ENUM (
    'presenter_request', 'vetting_application', 'vendor_application'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE convention_participation_offer_status AS ENUM (
    'draft', 'sent', 'accepted', 'declined', 'expired', 'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE convention_exhibitor_application_status AS ENUM (
    'pending', 'offered', 'accepted', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS role_kind varchar(32) NOT NULL DEFAULT 'custom';

-- Per-role application windows (open/close dates within a published role).
ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS apply_opens_at timestamptz;
ALTER TABLE convention_trusted_roles
  ADD COLUMN IF NOT EXISTS apply_closes_at timestamptz;

ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS vendor_profile_id uuid;
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS applicant_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS application_status convention_exhibitor_application_status;
ALTER TABLE convention_exhibitors
  ADD COLUMN IF NOT EXISTS application_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS convention_participation_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  applicant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source_type convention_participation_offer_source NOT NULL,
  source_id uuid NOT NULL,
  status convention_participation_offer_status NOT NULL DEFAULT 'draft',
  letter_html text,
  letter_text text,
  registration_category_id uuid,
  access_code varchar(128),
  booth_label varchar(128),
  fee_cents integer,
  fee_instructions text,
  expected_hours double precision,
  grants_staff_access boolean NOT NULL DEFAULT false,
  approved_offering_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_participation_offers_conv_status_idx
  ON convention_participation_offers (convention_id, status);
CREATE INDEX IF NOT EXISTS convention_participation_offers_applicant_idx
  ON convention_participation_offers (convention_id, applicant_user_id);
CREATE INDEX IF NOT EXISTS convention_participation_offers_source_idx
  ON convention_participation_offers (source_type, source_id);
`

async function main() {
  console.log('Applying organizer parity migration…')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('OK — all parity columns/tables present.')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', e)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
