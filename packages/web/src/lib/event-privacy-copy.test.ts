import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EVENT_RSVP_PRIVACY_TITLE,
  attendeeListVisibilitySummary,
} from './event-privacy-copy.ts'

describe('event RSVP privacy copy', () => {
  it('includes Before you RSVP title constant', () => {
    assert.equal(EVENT_RSVP_PRIVACY_TITLE, 'Before you RSVP')
  })

  it('summarizes public attendee list', () => {
    assert.equal(attendeeListVisibilitySummary('public'), 'Public attendee list')
  })

  it('summarizes count-only for hosts', () => {
    assert.equal(
      attendeeListVisibilitySummary('count_only', { viewerIsHost: true }),
      'Only hosts can see attendee names (counts are public)',
    )
  })

  it('returns null for unknown visibility', () => {
    assert.equal(attendeeListVisibilitySummary('hidden'), null)
  })
})
