import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { NOTIFICATION_TYPES } from '@c2k/shared'
import {
  NOTIFICATION_PRIVACY_REGISTRY,
  notificationActorKey,
  notificationVisibleToViewer,
} from './notification-privacy.js'

describe('notificationActorKey', () => {
  it('resolves dm_request actor by user id', () => {
    const actor = notificationActorKey('dm_request', { fromUserId: 'u1' })
    assert.deepEqual(actor, { kind: 'userId', userId: 'u1' })
  })

  it('resolves connection request actor by username', () => {
    const actor = notificationActorKey('connection_request', { requesterUsername: 'alex' })
    assert.deepEqual(actor, { kind: 'username', username: 'alex' })
  })

  it('resolves profile relationship and dancecard actors (PR 3 P4)', () => {
    assert.deepEqual(
      notificationActorKey('profile_relationship_request', { requesterUsername: 'alex' }),
      { kind: 'username', username: 'alex' },
    )
    assert.deepEqual(
      notificationActorKey('profile_relationship_accepted', { partnerUsername: 'brie' }),
      { kind: 'username', username: 'brie' },
    )
    assert.deepEqual(notificationActorKey('dancecard_booking_requested', { guestUserId: 'u9' }), {
      kind: 'userId',
      userId: 'u9',
    })
    assert.deepEqual(notificationActorKey('dancecard_scene_cancelled', { cancelledByUserId: 'u9' }), {
      kind: 'userId',
      userId: 'u9',
    })
  })

  it('returns null for system types', () => {
    assert.equal(notificationActorKey('event_rsvp_confirmed_virtual', { eventId: 'e1' }), null)
  })
})

describe('notification privacy registry (PR 3 P4)', () => {
  it('classifies every registered notification type — add new types here before shipping', () => {
    for (const type of Object.values(NOTIFICATION_TYPES)) {
      assert.ok(
        NOTIFICATION_PRIVACY_REGISTRY[type],
        `NOTIFICATION_TYPES.${type} is missing from NOTIFICATION_PRIVACY_REGISTRY — classify it as social (with actor resolver) or system`,
      )
    }
  })

  it('has no stale registry entries for removed types', () => {
    const known = new Set<string>(Object.values(NOTIFICATION_TYPES))
    for (const type of Object.keys(NOTIFICATION_PRIVACY_REGISTRY)) {
      assert.ok(known.has(type), `registry entry ${type} is not in NOTIFICATION_TYPES`)
    }
  })

  const ctx = { blocked: new Set(['blocked-user']), usernameToId: new Map([['mallory', 'blocked-user']]) }

  it('drops social notifications from blocked actors (both key kinds)', () => {
    assert.equal(
      notificationVisibleToViewer(
        { id: 'n1', type: 'dm_request', payload: { fromUserId: 'blocked-user' } },
        ctx,
      ),
      false,
    )
    assert.equal(
      notificationVisibleToViewer(
        { id: 'n2', type: 'connection_request', payload: { requesterUsername: 'mallory' } },
        ctx,
      ),
      false,
    )
    assert.equal(
      notificationVisibleToViewer(
        { id: 'n3', type: 'dm_request', payload: { fromUserId: 'friendly-user' } },
        ctx,
      ),
      true,
    )
  })

  it('drops social notifications with unresolvable actors (fail closed)', () => {
    assert.equal(
      notificationVisibleToViewer({ id: 'n4', type: 'dm_request', payload: {} }, ctx),
      false,
    )
    assert.equal(
      notificationVisibleToViewer(
        { id: 'n5', type: 'new_message', payload: { conversationId: 'c1' } },
        ctx,
      ),
      false,
    )
  })

  it('drops unregistered types for viewers with blocks (fail closed)', () => {
    assert.equal(
      notificationVisibleToViewer(
        { id: 'n6', type: 'future_social_type', payload: { fromUserId: 'x' } },
        ctx,
      ),
      false,
    )
  })

  it('always delivers system notifications', () => {
    assert.equal(
      notificationVisibleToViewer(
        { id: 'n7', type: 'org_announcement', payload: { orgId: 'o1' } },
        ctx,
      ),
      true,
    )
  })
})
