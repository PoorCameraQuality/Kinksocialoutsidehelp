/**
 * Smoke test Etsy Open API v3 read-only integration (no DB).
 * Usage:
 *   ETSY_X_API_KEY='keystring:shared_secret' node scripts/smoke-etsy-api.mjs
 *   ETSY_X_API_KEY='...' node scripts/smoke-etsy-api.mjs --shop FlogginFarmers
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const shopArg = process.argv.find((a, i) => process.argv[i - 1] === '--shop') ?? 'FlogginFarmers'

const etsyKey = process.env.ETSY_X_API_KEY?.trim() || process.env.ETSY_KEYSTRING?.trim()
if (!etsyKey) {
  console.error('Set ETSY_X_API_KEY=keystring:shared_secret (or deprecated ETSY_KEYSTRING)')
  process.exit(1)
}

const snippet = `
import { resolveEtsyShop, fetchActiveListingsPage } from './packages/api/src/lib/etsy-client.js'

const shopInput = ${JSON.stringify(shopArg)}
const resolved = await resolveEtsyShop(shopInput)
if ('error' in resolved) {
  console.error('resolve_failed:', resolved.error)
  process.exit(1)
}
const shop = resolved.shop
console.log('shop_ok:', shop.shop_id, shop.shop_name ?? shop.title ?? '')
const { listings, count } = await fetchActiveListingsPage(String(shop.shop_id), 0, 5)
console.log('listings_ok:', listings.length, 'sample_of', count)
if (listings[0]) {
  console.log('sample_listing:', listings[0].listing_id, (listings[0].title ?? '').slice(0, 60))
}
console.log('ETSY_SMOKE_OK')
`

const r = spawnSync('npx', ['tsx', '-e', snippet], {
  cwd: root,
  env: { ...process.env, ETSY_X_API_KEY: etsyKey, ETSY_KEYSTRING: etsyKey },
  stdio: 'inherit',
  shell: true,
})
process.exit(r.status ?? 1)
