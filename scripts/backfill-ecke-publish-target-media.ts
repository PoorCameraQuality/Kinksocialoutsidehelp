#!/usr/bin/env node
/**
 * Backfill ecke_publish_target_media for published ECKE targets (dry-run by default).
 *
 *   DATABASE_URL=postgres://... node --import tsx/esm scripts/backfill-ecke-publish-target-media.ts
 *   ECKE_PUBLISH_PHOTOS_ENABLED=true DATABASE_URL=... node --import tsx/esm scripts/backfill-ecke-publish-target-media.ts --apply
 */
import { runEckePublishTargetMediaBackfill } from '../packages/api/src/lib/ecke-publish-target-media-backfill.js'

async function main() {
  const apply = process.argv.includes('--apply')
  if (!process.env.DATABASE_URL?.trim()) {
    console.warn('[backfill-ecke-publish-target-media] DATABASE_URL not set — using local dev default from @c2k/api db pool')
  }

  const summary = await runEckePublishTargetMediaBackfill({ apply })

  console.log('')
  console.log('ECKE publish target media backfill summary:')
  console.log(`  mode:    ${summary.dryRun ? 'dry-run (--apply to mutate)' : 'apply'}`)
  console.log(`  scanned: ${summary.scanned}`)
  console.log(`  updated: ${summary.updated}`)
  console.log(`  skipped: ${summary.skipped}`)
  console.log(`  errors:  ${summary.errors}`)

  if (summary.errors > 0) process.exit(1)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
