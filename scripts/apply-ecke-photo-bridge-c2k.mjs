#!/usr/bin/env node
/**
 * Apply C2K ecke_publish_target_media schema via local Docker Postgres or DATABASE_URL.
 *
 *   node scripts/apply-ecke-photo-bridge-c2k.mjs
 *   DATABASE_URL=postgres://... node scripts/apply-ecke-photo-bridge-c2k.mjs
 */

import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sqlPath = join(root, 'packages/api/sql-drafts/ecke_publish_target_media.sql')
const sql = readFileSync(sqlPath, 'utf8')

function applyViaPsql(connectionUrl) {
  const res = spawnSync('psql', [connectionUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (res.stdout) process.stdout.write(res.stdout)
  if (res.stderr) process.stderr.write(res.stderr)
  if (res.status !== 0) {
    console.error('[apply-ecke-photo-bridge-c2k] psql failed')
    process.exit(res.status ?? 1)
  }
  console.log('[OK] ecke_publish_target_media applied via psql')
}

function applyViaDocker() {
  const compose = join(root, 'docker-compose.dev.yml')
  const res = spawnSync(
    'docker',
    ['compose', '-f', compose, 'exec', '-T', 'postgres', 'psql', '-U', 'c2k', '-d', 'c2k_dev', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', shell: process.platform === 'win32' },
  )
  if (res.stdout) process.stdout.write(res.stdout)
  if (res.stderr) process.stderr.write(res.stderr)
  if (res.status !== 0) {
    console.error('[apply-ecke-photo-bridge-c2k] docker compose exec failed — is postgres running?')
    process.exit(res.status ?? 1)
  }
  console.log('[OK] ecke_publish_target_media applied via docker postgres')
}

const dbUrl = process.env.DATABASE_URL?.trim()
if (dbUrl) {
  applyViaPsql(dbUrl)
} else {
  applyViaDocker()
}
