#!/usr/bin/env node
/**
 * Production-safe password reset diagnostic for a single username.
 * Usage: node scripts/verify-password-reset-account.mjs <username>
 *
 * Prints non-sensitive account state after a reset (no email, hash, or tokens).
 */
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const username = process.argv[2]?.trim()
if (!username) {
  console.error('Usage: node scripts/verify-password-reset-account.mjs <username>')
  process.exit(1)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.development') })
dotenv.config({ path: path.join(root, '.env.production') })
dotenv.config({ path: path.join(root, 'packages/api/.env') })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const BCRYPT_HASH_LENGTH = 60

const client = new pg.Client({ connectionString })
await client.connect()

try {
  const userRes = await client.query(
    `SELECT id, username, session_version, length(password_hash) AS password_hash_length
     FROM users
     WHERE username = $1
     LIMIT 1`,
    [username],
  )

  if (!userRes.rows.length) {
    console.log('USER: not found for username', username)
    process.exit(2)
  }

  const user = userRes.rows[0]
  console.log('USER_ID:', user.id)
  console.log('USERNAME:', user.username)
  console.log('SESSION_VERSION:', user.session_version ?? 0)
  console.log('PASSWORD_HASH_LENGTH:', user.password_hash_length)
  console.log('PASSWORD_HASH_LENGTH_VALID:', user.password_hash_length === BCRYPT_HASH_LENGTH)

  const tokenRes = await client.query(
    `SELECT id, created_at, expires_at, used_at
     FROM password_reset_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id],
  )

  if (!tokenRes.rows.length) {
    console.log('LATEST_RESET_TOKEN: none')
  } else {
    const token = tokenRes.rows[0]
    console.log('LATEST_RESET_TOKEN_ID:', token.id)
    console.log('LATEST_RESET_TOKEN_CREATED_AT:', token.created_at?.toISOString?.() ?? token.created_at)
    console.log('LATEST_RESET_TOKEN_EXPIRES_AT:', token.expires_at?.toISOString?.() ?? token.expires_at)
    console.log('LATEST_RESET_TOKEN_USED_AT:', token.used_at?.toISOString?.() ?? token.used_at ?? null)
    console.log('LATEST_RESET_TOKEN_USED:', Boolean(token.used_at))
  }
} finally {
  await client.end()
}
