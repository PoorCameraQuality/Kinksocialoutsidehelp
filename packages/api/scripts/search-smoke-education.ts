#!/usr/bin/env tsx
/** Live smoke: education Typesense query + DB fallback. Requires Postgres + optional Typesense. */
import '../src/load-dev-env.js'
import { listEducationArticlesForHub } from '../src/lib/search/education/education-query.js'
import { searchHealthDiagnostic } from '../src/lib/search/health.js'
import { resetTypesenseClientsForTests } from '../src/lib/search/typesense-client.js'

async function main() {
  const health = await searchHealthDiagnostic()
  console.log('[search-smoke] health', JSON.stringify(health, null, 2))

  const ts = await listEducationArticlesForHub({ q: 'consent', limit: 5 })
  console.log('[search-smoke] typesense path', {
    backend: ts.searchBackend,
    count: ts.rows.length,
    titles: ts.rows.map((r) => r.title),
  })

  process.env.SEARCH_QUERY_ENABLED = 'false'
  resetTypesenseClientsForTests()
  const db = await listEducationArticlesForHub({ q: 'consent', limit: 5 })
  console.log('[search-smoke] db fallback path', {
    backend: db.searchBackend,
    count: db.rows.length,
    titles: db.rows.map((r) => r.title),
  })

  if (health.provider === 'typesense' && health.queryEnabled && ts.searchBackend !== 'typesense') {
    console.error('[search-smoke] FAIL: expected typesense backend when enabled')
    process.exit(1)
  }
  if (db.searchBackend !== 'database') {
    console.error('[search-smoke] FAIL: expected database backend when query disabled')
    process.exit(1)
  }
  console.log('[search-smoke] OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
