/**
 * Remove all alpha-ecke-demo seeded content in dependency-safe order.
 * Run: USE_DATABASE=true npm run db:clear:alpha:ecke -w @c2k/api
 */
import './load-dev-env.js'
import { ALPHA_ECKE_BATCH_KEY } from '../lib/alpha-seed-labels.js'
import { assertAlphaSeedAllowed } from '../lib/alpha-seed-guard.js'
import { clearAlphaSeedBatch } from './clear-alpha-prod-test-data.js'

async function main() {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true to clear alpha seed.')
    process.exit(1)
  }
  assertAlphaSeedAllowed()
  await clearAlphaSeedBatch(process.env.ALPHA_SEED_BATCH_KEY ?? ALPHA_ECKE_BATCH_KEY)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
