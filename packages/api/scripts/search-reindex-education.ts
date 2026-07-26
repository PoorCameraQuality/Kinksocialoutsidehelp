#!/usr/bin/env tsx
/**
 * Operator reindex for education articles → Typesense.
 * Requires SEARCH_ADMIN_REINDEX_ENABLED=true and indexing flags.
 */
import '../src/load-dev-env.js'
import { readSearchConfig } from '../src/lib/search/config.js'
import { reindexAllEducationArticles } from '../src/lib/search/education/education-sync.js'

async function main() {
  const cfg = readSearchConfig()
  if (cfg.provider !== 'typesense') {
    console.error('SEARCH_PROVIDER must be typesense')
    process.exit(1)
  }
  if (!cfg.adminReindexEnabled) {
    console.error('Set SEARCH_ADMIN_REINDEX_ENABLED=true')
    process.exit(1)
  }
  if (!cfg.indexingEnabled) {
    console.error('Set SEARCH_INDEXING_ENABLED=true')
    process.exit(1)
  }
  const result = await reindexAllEducationArticles()
  console.log('[search-reindex-education]', result)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
