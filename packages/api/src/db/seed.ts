/**
 * Full database reseed (wipes all public tables, then seeds).
 * Run: USE_DATABASE=true npm run db:seed -w @c2k/api
 * Locations: npm run db:seed:locations -w @c2k/api (once per empty DB, or after wipe)
 */
import './load-dev-env.js'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { db, schema } from './index.js'
import { wipeDatabase } from './wipe-database.js'
import { runFullSeed } from './seed-legacy.js'
import { assertDestructiveDbAllowed, warnIfProductionDatabaseUrl } from '../lib/production-guard.js'

const apiPackageRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

async function ensureLocationsAfterWipe() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.places)
  if (count > 0) return
  console.log('Places empty. Seeding US locations (db:seed:locations)…')
  execSync('npm run db:seed:locations -w @c2k/api', {
    stdio: 'inherit',
    env: process.env,
    cwd: apiPackageRoot,
  })
}

async function main() {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true to seed.')
    process.exit(1)
  }

  warnIfProductionDatabaseUrl()

  const skipWipe = process.env.C2K_DB_WIPE === 'false'
  if (!skipWipe) {
    assertDestructiveDbAllowed('seed')
    assertDestructiveDbAllowed('wipe')
    console.log('C2K seed: wiping public tables (set C2K_DB_WIPE=false to skip)…')
    await wipeDatabase()
    await ensureLocationsAfterWipe()
  } else {
    console.log('C2K seed: C2K_DB_WIPE=false. Appending/idempotent legacy seed paths only.')
  }

  await runFullSeed()
  console.log('Seed complete.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
