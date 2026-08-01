/**
 * Load repo-root local env before `db/index` builds the pool (seed, one-off scripts).
 * Prefers gitignored `.env.development`, falls back to tracked `.env.development.example`.
 */
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../../../..')
const primary = resolve(root, '.env.development')
const example = resolve(root, '.env.development.example')
if (existsSync(primary)) {
  loadEnv({ path: primary })
} else if (existsSync(example)) {
  loadEnv({ path: example })
}
