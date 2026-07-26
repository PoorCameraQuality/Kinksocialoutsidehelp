import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ORGANIZER_EXPORT_DOWNLOAD_PATHS,
  ORGANIZER_EXPORT_REMOVED_PATHS,
} from './organizer-export-paths.js'

test('active export paths use csv or known endpoints', () => {
  for (const p of ORGANIZER_EXPORT_DOWNLOAD_PATHS) {
    assert.ok(!ORGANIZER_EXPORT_REMOVED_PATHS.includes(p as (typeof ORGANIZER_EXPORT_REMOVED_PATHS)[number]))
    if (p.includes('sessions') || p.includes('conflict-report')) {
      assert.ok(p.includes('format=csv'), `${p} should request CSV`)
    }
  }
})

test('removed export paths are not in active list', () => {
  for (const removed of ORGANIZER_EXPORT_REMOVED_PATHS) {
    assert.equal(
      ORGANIZER_EXPORT_DOWNLOAD_PATHS.some((active) => active.startsWith(removed.split('?')[0]!)),
      false,
      removed,
    )
  }
})
