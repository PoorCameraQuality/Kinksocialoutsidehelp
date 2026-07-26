import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildVerifiedTeachingCreditInsert,
  conventionProgramDetailUrl,
  formatTeachingCreditEventDate,
} from './presenter-teaching-credits.js'

describe('presenter teaching credit sync helpers', () => {
  it('formatTeachingCreditEventDate returns YYYY-MM-DD from slot start', () => {
    assert.equal(formatTeachingCreditEventDate(new Date('2026-03-15T18:30:00.000Z')), '2026-03-15')
    assert.equal(formatTeachingCreditEventDate(null), undefined)
  })

  it('conventionProgramDetailUrl links to convention schedule tab', () => {
    assert.equal(
      conventionProgramDetailUrl('preview-c2k-weekend'),
      '/conventions/preview-c2k-weekend?tab=Schedule',
    )
  })

  it('buildVerifiedTeachingCreditInsert maps assignment fields', () => {
    const row = buildVerifiedTeachingCreditInsert({
      presenterUserId: '00000000-0000-4000-8000-000000000001',
      slotTitle: 'Negotiation 101',
      conventionName: 'Preview C2K Weekend',
      conventionSlug: 'preview-c2k-weekend',
      scheduleSlotId: '00000000-0000-4000-8000-000000000002',
      startsAt: new Date('2026-03-15T14:00:00.000Z'),
    })
    assert.equal(row.title, 'Negotiation 101')
    assert.equal(row.eventName, 'Preview C2K Weekend')
    assert.equal(row.eventDate, '2026-03-15')
    assert.equal(row.detailUrl, '/conventions/preview-c2k-weekend?tab=Schedule')
    assert.equal(row.scheduleSlotId, '00000000-0000-4000-8000-000000000002')
    assert.equal(row.presenterUserId, '00000000-0000-4000-8000-000000000001')
  })
})
