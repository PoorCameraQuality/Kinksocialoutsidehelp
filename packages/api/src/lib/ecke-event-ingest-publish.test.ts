import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import type { EckeEventRow } from './ecke-directory-sync.js'
import { __testMergeEventPublishResult } from './ecke-event-ingest-publish.js'

const SAMPLE_ROW: EckeEventRow = {
  title: 'Crucible Con',
  slug: 'crucible-con',
  start_date: '2026-07-01',
  end_date: '2026-07-03',
  display_date: '2026-07-01',
  city: 'DC',
  state: 'MD',
  short_description: 'A convention',
  long_description: 'Long copy',
  category: 'Convention',
  logo: '',
  website: 'https://example.com',
  organizer_name: 'CPI',
  status: 'published',
  c2k_source_type: 'convention',
  c2k_source_id: '11111111-1111-4111-8111-111111111111',
  tags: ['convention'],
}

describe('ecke-event-ingest-publish merge', () => {
  it('prefers ingest URL when ingest primary and ingest succeeds', () => {
    const merged = __testMergeEventPublishResult(
      SAMPLE_ROW,
      {
        ok: true,
        targetKind: 'ecke_event',
        eckeSlug: 'crucible-con',
        eckePublicUrl: 'https://www.eastcoastkinkevents.com/events/crucible-con',
      },
      { ok: true, targetKind: 'ecke_event' },
      true,
    )
    assert.equal(merged.ok, true)
    if (merged.ok) {
      assert.equal(merged.eckePublicUrl, 'https://www.eastcoastkinkevents.com/events/crucible-con')
    }
  })

  it('falls back to legacy when ingest fails but legacy succeeds during dual-write', () => {
    const merged = __testMergeEventPublishResult(
      SAMPLE_ROW,
      { ok: false, targetKind: 'ecke_event', error: 'unsupported_entity_type' },
      { ok: true, targetKind: 'ecke_event', eckeSlug: 'crucible-con' },
      true,
    )
    assert.equal(merged.ok, true)
    if (merged.ok) {
      assert.match(merged.eckePublicUrl ?? '', /\/events\/crucible-con/)
    }
  })

  it('uses legacy result when ingest is disabled', () => {
    const merged = __testMergeEventPublishResult(
      SAMPLE_ROW,
      null,
      { ok: true, targetKind: 'ecke_event', eckeSlug: 'crucible-con' },
      false,
    )
    assert.equal(merged.ok, true)
  })
})
