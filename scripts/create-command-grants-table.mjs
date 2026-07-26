import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.development') })
dotenv.config({ path: path.join(root, 'packages/api/.env') })

const sql = `
CREATE TABLE IF NOT EXISTS convention_command_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id uuid NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_registration boolean NOT NULL DEFAULT false,
  can_staff_ops boolean NOT NULL DEFAULT false,
  can_scheduler boolean NOT NULL DEFAULT false,
  granted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE UNIQUE INDEX IF NOT EXISTS convention_command_grants_conv_user_idx
  ON convention_command_grants (convention_id, user_id);
CREATE INDEX IF NOT EXISTS convention_command_grants_convention_idx
  ON convention_command_grants (convention_id);
`

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
await client.query(sql)
console.log('convention_command_grants table ready')
await client.end()
