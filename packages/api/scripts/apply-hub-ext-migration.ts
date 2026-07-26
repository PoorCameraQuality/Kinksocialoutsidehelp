/**
 * Idempotent SQL for Public Page Refactor v2 hub tables/columns.
 * Use when `npm run db:push` fails on drizzle-kit expression indexes.
 */
import pg from 'pg'

const sql = `
ALTER TABLE org_channels
  ADD COLUMN IF NOT EXISTS requires_convention_id uuid REFERENCES conventions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS org_channels_requires_conv_idx ON org_channels(requires_convention_id);

CREATE TABLE IF NOT EXISTS convention_gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  image_url text NOT NULL,
  caption varchar(500),
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convention_gallery_images_conv_idx
  ON convention_gallery_images(convention_id, sort_order);

CREATE TABLE IF NOT EXISTS convention_pins (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, convention_id)
);
CREATE INDEX IF NOT EXISTS convention_pins_user_idx ON convention_pins(user_id, pinned_at DESC);

CREATE TABLE IF NOT EXISTS convention_channel_reads (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES org_channels(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);
`

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://c2k:c2k_dev@127.0.0.1:6432/c2k_dev?sslmode=disable',
    ssl: process.env.DATABASE_SSL === 'true' ? undefined : false,
  })
  try {
    await pool.query(sql)
    console.log('Hub extension migration applied.')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
