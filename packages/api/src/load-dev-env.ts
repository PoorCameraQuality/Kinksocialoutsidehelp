import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Load order:
 * 1. `.env.development` (gitignored local copy)
 * 2. else `.env.development.example` (tracked public local Docker defaults)
 * then gitignored overrides (secrets belong only in *.local).
 */
const primary = resolve(repoRoot, '.env.development')
const example = resolve(repoRoot, '.env.development.example')
if (existsSync(primary)) {
  loadEnv({ path: primary })
} else if (existsSync(example)) {
  loadEnv({ path: example })
}

for (const file of ['.env.development.local', '.env.local'] as const) {
  const path = resolve(repoRoot, file)
  if (existsSync(path)) {
    loadEnv({ path, override: true })
  }
}
