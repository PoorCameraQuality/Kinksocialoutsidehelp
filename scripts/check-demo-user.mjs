import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.development') })
dotenv.config({ path: path.join(root, 'packages/api/.env') })

const demo = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const r = await client.query(
  `SELECT id, username, email, password_hash, last_seen_at FROM users WHERE username ILIKE 'ropedreamer' LIMIT 1`,
)
if (!r.rows.length) {
  console.log('USER: NOT FOUND — run npm run db:seed -w @c2k/api')
} else {
  const u = r.rows[0]
  const p = await client.query('SELECT updated_at FROM profiles WHERE user_id = $1', [u.id])
  const ok = await bcrypt.compare(demo, u.password_hash)
  const updated = p.rows[0]?.updated_at
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
  console.log('USER:', u.username, '|', u.email)
  console.log('LAST_SEEN:', u.last_seen_at)
  console.log('PROFILE_UPDATED:', updated ?? 'none')
  console.log('WOULD_EXPIRE_ON_LOGIN:', updated && new Date(updated) <= twoYearsAgo)
  console.log('PASSWORD_MATCHES_DEMO:', ok)
  if (!ok) console.log('Hint: password may differ from DEMO_LOGIN_PASSWORD; re-seed or reset hash')
}

await client.end()
