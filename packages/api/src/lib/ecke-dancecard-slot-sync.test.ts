import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDancecardSlotRows, orphanDancecardSlotsDeletePath } from './ecke-dancecard-slot-sync.js'

describe('buildDancecardSlotRows', () => {
  it('uses externalKey as stable ECKE slot id', () => {
    const rows = buildDancecardSlotRows('event-uuid', [
      {
        externalKey: 'slot-uuid-1',
        startsAt: '2026-06-01T12:00:00.000Z',
        endsAt: '2026-06-01T13:00:00.000Z',
        title: 'Rope 101',
        track: 'Education',
        room: 'Ballroom A',
        description: null,
        sortOrder: 0,
      },
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 'slot-uuid-1')
    assert.equal(rows[0].event_id, 'event-uuid')
    assert.equal(rows[0].title, 'Rope 101')
  })
})

describe('orphanDancecardSlotsDeletePath', () => {
  it('deletes all slots when keep list empty', () => {
    assert.equal(
      orphanDancecardSlotsDeletePath('ev-1', []),
      'dancecard_program_slots?event_id=eq.ev-1',
    )
  })

  it('excludes kept slot ids from delete', () => {
    const path = orphanDancecardSlotsDeletePath('ev-1', ['a', 'b'])
    assert.match(path, /event_id=eq\.ev-1/)
    assert.match(path, /id=not\.in\.\(a,b\)/)
  })
})
