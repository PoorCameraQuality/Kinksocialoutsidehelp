import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatVendorEventDate } from './vendor-event-credits.js'

describe('vendor event credit sync helpers', () => {
  it('formatVendorEventDate returns YYYY-MM-DD from event start', () => {
    assert.equal(formatVendorEventDate(new Date('2026-03-15T18:30:00.000Z')), '2026-03-15')
    assert.equal(formatVendorEventDate(null), undefined)
  })
})
