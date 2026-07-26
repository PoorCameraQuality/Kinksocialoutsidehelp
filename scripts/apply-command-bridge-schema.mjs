import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.development') })
dotenv.config({ path: path.join(root, 'packages/api/.env') })

const sql = `
ALTER TABLE convention_registration_categories
  ADD COLUMN IF NOT EXISTS expected_hours double precision;

ALTER TABLE convention_registrants
  ADD COLUMN IF NOT EXISTS checked_in_timing varchar(32);

CREATE TABLE IF NOT EXISTS convention_registrant_inbound_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  label varchar(128) NOT NULL DEFAULT 'default',
  secret_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS convention_registrant_inbound_secrets_conv_label_idx
  ON convention_registrant_inbound_secrets (convention_id, label);
CREATE INDEX IF NOT EXISTS convention_registrant_inbound_secrets_conv_idx
  ON convention_registrant_inbound_secrets (convention_id);

CREATE TABLE IF NOT EXISTS convention_iso_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES convention_kit_iso_posts(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  moderated_at timestamptz
);
CREATE INDEX IF NOT EXISTS convention_iso_comments_post_idx
  ON convention_iso_comments (post_id, created_at);
`

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
await client.query(sql)
console.log('Command bridge schema patches applied')
await client.end()
