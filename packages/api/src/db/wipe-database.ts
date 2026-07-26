/**
 * Truncate all public tables - destructive; use only for local dev reseed.
 */
import './load-dev-env.js'
import pg from 'pg'
import { assertDestructiveDbAllowed, warnIfProductionDatabaseUrl } from '../lib/production-guard.js'
const defaultUrl = 'postgresql://c2k:c2k_dev@127.0.0.1:6432/c2k_dev?sslmode=disable'

export async function wipeDatabase(): Promise<void> {
  if (process.env.USE_DATABASE !== 'true') {
    throw new Error('Set USE_DATABASE=true before wiping the database.')
  }
  assertDestructiveDbAllowed('wipe')
  warnIfProductionDatabaseUrl()
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL ?? defaultUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? undefined : false,
  })
  try {
    const tables = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'drizzle_%' ORDER BY tablename`,
    )
    if (tables.rows.length === 0) {
      console.log('No public tables to wipe.')
      return
    }
    const names = tables.rows.map((r) => `"${r.tablename}"`).join(', ')
    await pool.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`)
    console.log(`Wiped ${tables.rows.length} public tables (full reseed).`)
  } finally {
    await pool.end()
  }
}

async function main() {
  await wipeDatabase()
  process.exit(0)
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('/wipe-database.ts')
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
