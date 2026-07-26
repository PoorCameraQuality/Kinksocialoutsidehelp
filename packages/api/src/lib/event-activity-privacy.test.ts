import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canViewerSeeEventRsvpActivity,
  sanitizeEventActivityObjectForViewer,
  summarizeAttendeeListVisibility,
} from './event-activity.js'

const hostId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const viewerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const actorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('summarizeAttendeeListVisibility', () => {
  it('describes count-only for general viewers', () => {
    assert.equal(summarizeAttendeeListVisibility('count_only'), 'Only hosts can see attendees')
  })

  it('describes public list', () => {
    assert.equal(summarizeAttendeeListVisibility('public'), 'Public attendee list')
  })

  it('returns null for unknown values', () => {
    assert.equal(summarizeAttendeeListVisibility('secret'), null)
  })
})

describe('canViewerSeeEventRsvpActivity', () => {
  const event = { hostId, attendeeListVisibility: 'count_only' }

  it('allows host and actor', () => {
    assert.equal(
      canViewerSeeEventRsvpActivity(hostId, event, actorId, { viewerHasGoingRsvp: false }),
      true,
    )
    assert.equal(
      canViewerSeeEventRsvpActivity(actorId, event, actorId, { viewerHasGoingRsvp: false }),
      true,
    )
  })

  it('allows fellow attendees', () => {
    assert.equal(
      canViewerSeeEventRsvpActivity(viewerId, event, actorId, { viewerHasGoingRsvp: true }),
      true,
    )
  })

  it('hides RSVP activity from connections when list is count-only', () => {
    assert.equal(
      canViewerSeeEventRsvpActivity(viewerId, event, actorId, { viewerHasGoingRsvp: false }),
      false,
    )
  })

  it('allows public attendee list', () => {
    assert.equal(
      canViewerSeeEventRsvpActivity(viewerId, { hostId, attendeeListVisibility: 'public' }, actorId, {
        viewerHasGoingRsvp: false,
      }),
      true,
    )
  })
})

describe('sanitizeEventActivityObjectForViewer', () => {
  it('strips raw location from feed objects', () => {
    const out = sanitizeEventActivityObjectForViewer({
      type: 'event',
      id: 'e1',
      title: 'Munch',
      location: '123 Secret St',
      publicLocationSummary: 'Downtown',
    })
    assert.equal(out.title, 'Munch')
    assert.equal(out.publicLocationSummary, 'Downtown')
    assert.equal(out.location, undefined)
  })
})
