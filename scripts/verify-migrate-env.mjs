#!/usr/bin/env node
/**
 * Preconditions for npm run db:migrate-prod — fails fast before schema changes.
 */
if (process.env.USE_DATABASE !== 'true') {
  console.error('Fatal: USE_DATABASE must be true for production migrations.')
  process.exit(1)
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error('Fatal: DATABASE_URL is required for migrations.')
  process.exit(1)
}

console.log('Migration env OK (USE_DATABASE=true, DATABASE_URL set).')
