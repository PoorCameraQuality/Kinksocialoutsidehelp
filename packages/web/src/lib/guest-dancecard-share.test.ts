import { describe, expect, it } from 'vitest'
import { isGuestDancecardSharePath, slotsFromFreeGaps } from './guest-dancecard-share'

describe('isGuestDancecardSharePath', () => {
  it('matches play share URLs', () => {
    expect(isGuestDancecardSharePath('/play/dark-odyssey/s/abc123')).toBe(true)
    expect(isGuestDancecardSharePath('/play/dark-odyssey')).toBe(false)
  })
})

describe('slotsFromFreeGaps', () => {
  it('generates exact duration slots on a 30-minute grid', () => {
    const slots = slotsFromFreeGaps(
      [{ startsAt: '2026-09-02T13:30:00.000Z', endsAt: '2026-09-02T16:00:00.000Z' }],
      60,
      30,
    )
    expect(slots.length).toBeGreaterThanOrEqual(3)
    for (const s of slots) {
      const mins = (Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 60_000
      expect(mins).toBe(60)
    }
    // First start should not precede the gap
    expect(Date.parse(slots[0].startsAt)).toBeGreaterThanOrEqual(Date.parse('2026-09-02T13:30:00.000Z'))
    // Last end must fit inside the gap
    expect(Date.parse(slots[slots.length - 1].endsAt)).toBeLessThanOrEqual(
      Date.parse('2026-09-02T16:00:00.000Z') + 1,
    )
  })

  it('returns empty when duration exceeds gap', () => {
    const slots = slotsFromFreeGaps(
      [{ startsAt: '2026-09-02T13:30:00.000Z', endsAt: '2026-09-02T14:00:00.000Z' }],
      90,
    )
    expect(slots).toEqual([])
  })
})
