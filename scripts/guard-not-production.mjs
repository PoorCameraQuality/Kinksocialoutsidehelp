#!/usr/bin/env node
/**
 * Exit non-zero when NODE_ENV or C2K_ENV is production.
 * Used by db:prepare and other dev-only root scripts.
 */
const label = process.argv[2] ?? 'this command'

if (process.env.NODE_ENV === 'production' || process.env.C2K_ENV === 'production') {
  console.error(`Fatal: ${label} must not run with NODE_ENV=production or C2K_ENV=production.`)
  console.error('Use npm run db:migrate-prod for production schema updates (no seed).')
  process.exit(1)
}
