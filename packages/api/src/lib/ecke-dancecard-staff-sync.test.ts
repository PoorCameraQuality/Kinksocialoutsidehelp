import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDancecardStaffShiftRows,
  orphanDancecardStaffShiftsDeletePath,
  parseVolunteerShiftTitle,
} from './ecke-dancecard-staff-sync.js'

describe('parseVolunteerShiftTitle', () => {
  it('splits person and role on separator', () => {
    assert.deepEqual(parseVolunteerShiftTitle('Alex | Door'), {
      personName: 'Alex',
      role: 'Door',
    })
  })

  it('uses Volunteer role when no separator', () => {
    assert.deepEqual(parseVolunteerShiftTitle('Setup crew'), {
      personName: 'Setup crew',
      role: 'Volunteer',
    })
  })
})

describe('buildDancecardStaffShiftRows', () => {
  it('uses externalKey as stable ECKE staff shift id', () => {
    const rows = buildDancecardStaffShiftRows('event-uuid', [
      {
        externalKey: 'shift-uuid-1',
        personName: 'Sam',
        role: 'Medic',
        startsAt: '2026-05-01T14:00:00.000Z',
        endsAt: '2026-05-01T18:00:00.000Z',
        sortOrder: 0,
      },
    ])
    assert.equal(rows[0].id, 'shift-uuid-1')
    assert.equal(rows[0].event_id, 'event-uuid')
    assert.equal(rows[0].person_name, 'Sam')
  })
})

describe('orphanDancecardStaffShiftsDeletePath', () => {
  it('deletes all staff shifts when keep list empty', () => {
    assert.equal(
      orphanDancecardStaffShiftsDeletePath('ev-1', []),
      'dancecard_staff_shifts?event_id=eq.ev-1',
    )
  })

  it('excludes kept shift ids from delete', () => {
    assert.equal(
      orphanDancecardStaffShiftsDeletePath('ev-1', ['a', 'b']),
      'dancecard_staff_shifts?event_id=eq.ev-1&id=not.in.(a,b)',
    )
  })
})
