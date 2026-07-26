/**
 * Load repo-root `.env.development` before `db/index` builds the pool (seed, one-off scripts).
 * Server entrypoints load env themselves; keep this import first in `seed.ts` only.
 */
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnv = resolve(__dirname, '../../../../.env.development')
if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv })
}
