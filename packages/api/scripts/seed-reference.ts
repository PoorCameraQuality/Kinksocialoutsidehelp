/**
 * Production-safe reference data: US locations + kink tag catalog.
 * Idempotent. Does NOT wipe or seed demo orgs/events/users.
 */
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedKinkTagsOnly } from '../src/db/seed-reference.js'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

if (process.env.USE_DATABASE !== 'true') {
  console.error('Set USE_DATABASE=true')
  process.exit(1)
}

execSync('npm run db:seed:locations -w @c2k/api', {
  stdio: 'inherit',
  env: process.env,
  cwd: join(apiRoot, '../..'),
})

await seedKinkTagsOnly()
console.log('Reference seed complete.')
