/**
 * Idempotent: sync KINK_TAG_CATALOG into kink_tags. Safe for production.
 */
import { seedKinkTagsOnly } from '../src/db/seed-reference.js'

await seedKinkTagsOnly()
console.log('Kink tag catalog synced.')
