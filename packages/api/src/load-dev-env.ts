import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// Tracked templates first; gitignored *.local overrides (secrets never in .env.development).
for (const file of ['.env.development', '.env.development.local', '.env.local'] as const) {
  const path = resolve(repoRoot, file)
  if (existsSync(path)) {
    loadEnv({ path, override: file !== '.env.development' })
  }
}
