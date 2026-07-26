import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildEventIcsCalendar } from './ics-event.js'

describe('buildEventIcsCalendar', () => {
  test('includes location when provided (ADR 003: caller redacts before invoke)', () => {
    const startsAt = new Date('2026-06-15T18:00:00.000Z')
    const endsAt = new Date('2026-06-15T20:00:00.000Z')
    const ics = buildEventIcsCalendar({
      uid: 'evt-1@c2k',
      title: 'Munch Night',
      description: 'Public summary only',
      startsAt,
      endsAt,
      eventPageUrl: 'https://example.com/events/evt-1',
      location: '123 Main St',
    })
    assert.match(ics, /SUMMARY:Munch Night/)
    assert.match(ics, /LOCATION:123 Main St/)
    assert.match(ics, /DESCRIPTION:Public summary only/)
    assert.match(ics, /URL:https:\/\/example\.com\/events\/evt-1/)
    assert.doesNotMatch(ics, /LOCATION:Details after RSVP/)
  })

  test('omits LOCATION when not passed (redacted tier)', () => {
    const ics = buildEventIcsCalendar({
      uid: 'evt-2@c2k',
      title: 'Private Social',
      description: 'Full address is shared only to approved guests.',
      startsAt: new Date('2026-07-01T19:00:00.000Z'),
      eventPageUrl: 'https://example.com/events/evt-2',
    })
    assert.doesNotMatch(ics, /^LOCATION:/m)
    assert.match(ics, /DESCRIPTION:Full address is shared only to approved guests/)
  })
})
