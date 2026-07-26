import { describe, expect, it } from 'vitest'
import { buildDancecardSelectionsOnlyIcs, icsValarmTriggerMinutes } from './dancecardIcs'

describe('dancecardIcs', () => {
  it('formats VALARM trigger', () => {
    expect(icsValarmTriggerMinutes(15)).toBe('-PT15M')
    expect(icsValarmTriggerMinutes(0)).toBeNull()
  })

  it('includes VALARM on program selections when remind minutes set', () => {
    const body = buildDancecardSelectionsOnlyIcs({
      calendarName: 'Test',
      attendeeDisplayName: 'Scene',
      selections: [
        {
          id: 'sel-1',
          kind: 'program',
          startsAt: '2026-06-01T18:00:00.000Z',
          endsAt: '2026-06-01T19:00:00.000Z',
          programTitle: 'Rope 101',
        },
      ],
      programRemindBeforeMinutes: 15,
    })
    expect(body).toContain('BEGIN:VALARM')
    expect(body).toContain('TRIGGER:-PT15M')
    expect(body).toContain('Rope 101')
  })

  it('omits VALARM on manual busy blocks', () => {
    const body = buildDancecardSelectionsOnlyIcs({
      calendarName: 'Test',
      attendeeDisplayName: 'Scene',
      selections: [
        {
          id: 'sel-2',
          kind: 'manual',
          startsAt: '2026-06-01T18:00:00.000Z',
          endsAt: '2026-06-01T19:00:00.000Z',
        },
      ],
      programRemindBeforeMinutes: 15,
    })
    expect(body).not.toContain('BEGIN:VALARM')
  })
})
