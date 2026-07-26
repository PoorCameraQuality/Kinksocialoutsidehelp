import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDancecardLocationRows,
  orphanDancecardLocationsDeletePath,
} from './ecke-dancecard-location-sync.js'

describe('buildDancecardLocationRows', () => {
  it('uses externalKey as stable ECKE location id', () => {
    const rows = buildDancecardLocationRows('event-uuid', [
      {
        externalKey: 'loc-uuid-1',
        name: 'Ballroom A',
        shortName: 'A',
        capacity: 120,
        sortOrder: 0,
        parentId: null,
      },
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 'loc-uuid-1')
    assert.equal(rows[0].event_id, 'event-uuid')
    assert.equal(rows[0].name, 'Ballroom A')
    assert.equal(rows[0].parent_id, null)
  })
})

describe('orphanDancecardLocationsDeletePath', () => {
  it('deletes all locations when keep list empty', () => {
    assert.equal(
      orphanDancecardLocationsDeletePath('ev-1', []),
      'dancecard_locations?event_id=eq.ev-1',
    )
  })

  it('excludes kept location ids from delete', () => {
    const path = orphanDancecardLocationsDeletePath('ev-1', ['a', 'b'])
    assert.match(path, /event_id=eq\.ev-1/)
    assert.match(path, /id=not\.in\.\(a,b\)/)
  })
})
