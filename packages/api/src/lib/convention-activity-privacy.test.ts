import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canViewerSeeConventionPinActivity,
  canViewerSeePresenterAssignedActivity,
  sanitizeConventionActivityObjectForViewer,
} from './convention-activity.js'

const viewerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const actorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('canViewerSeeConventionPinActivity', () => {
  it('allows actor and fellow attendees', () => {
    assert.equal(canViewerSeeConventionPinActivity(actorId, actorId, { canView: false, canManage: false, isStaff: false }), true)
    assert.equal(
      canViewerSeeConventionPinActivity(viewerId, actorId, { canView: true, canManage: false, isStaff: false }),
      true,
    )
  })

  it('hides pin from connections without hub access', () => {
    assert.equal(
      canViewerSeeConventionPinActivity(viewerId, actorId, { canView: false, canManage: false, isStaff: false }),
      false,
    )
  })
})

describe('canViewerSeePresenterAssignedActivity', () => {
  const publicSlot = { isPublished: true, visibility: 'ATTENDEE' }

  it('allows public program slots when listing is public', () => {
    assert.equal(
      canViewerSeePresenterAssignedActivity(viewerId, actorId, publicSlot, {
        listingPublic: true,
        access: { canView: false, canManage: false, isStaff: false },
      }),
      true,
    )
  })

  it('requires hub access when program listing is private', () => {
    assert.equal(
      canViewerSeePresenterAssignedActivity(viewerId, actorId, publicSlot, {
        listingPublic: false,
        access: { canView: false, canManage: false, isStaff: false },
      }),
      false,
    )
    assert.equal(
      canViewerSeePresenterAssignedActivity(viewerId, actorId, publicSlot, {
        listingPublic: false,
        access: { canView: true, canManage: false, isStaff: false },
      }),
      true,
    )
  })

  it('hides staff-only slots from attendees', () => {
    assert.equal(
      canViewerSeePresenterAssignedActivity(viewerId, actorId, { isPublished: true, visibility: 'STAFF' }, {
        listingPublic: true,
        access: { canView: true, canManage: false, isStaff: false },
      }),
      false,
    )
  })
})

describe('sanitizeConventionActivityObjectForViewer', () => {
  it('strips raw location from feed objects', () => {
    const out = sanitizeConventionActivityObjectForViewer({
      type: 'schedule_slot',
      id: 's1',
      slotTitle: 'Rope 101',
      location: 'Secret room',
      conventionSlug: 'midwest-leather',
    })
    assert.equal(out.slotTitle, 'Rope 101')
    assert.equal(out.location, undefined)
  })
})
