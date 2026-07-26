import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canActorActivityAppearInFeed, defaultFeedActivityPrivacy } from './feed-activity-privacy.js'

describe('feed-activity-privacy', () => {
  const connected = { viewerFollowsActor: true }
  const stranger = { viewerFollowsActor: false }

  it('reaction activity respects connections_only default', () => {
    assert.equal(canActorActivityAppearInFeed(defaultFeedActivityPrivacy, 'loved', connected), true)
    assert.equal(canActorActivityAppearInFeed(defaultFeedActivityPrivacy, 'loved', stranger), false)
  })

  it('follow activity respects connections_only default', () => {
    assert.equal(canActorActivityAppearInFeed(defaultFeedActivityPrivacy, 'followed', connected), true)
    assert.equal(canActorActivityAppearInFeed(defaultFeedActivityPrivacy, 'connection_accepted', stranger), false)
  })

  it('RSVP activity is off by default', () => {
    assert.equal(canActorActivityAppearInFeed(defaultFeedActivityPrivacy, 'event_rsvp', connected), false)
    assert.equal(canActorActivityAppearInFeed(defaultFeedActivityPrivacy, 'event_rsvp', stranger), false)
  })

  it('group join feed activity is off when showGroupJoins is ask', () => {
    assert.equal(canActorActivityAppearInFeed(defaultFeedActivityPrivacy, 'group_join', connected), false)
  })

  it('group join feed activity appears when explicitly on', () => {
    const privacy = { ...defaultFeedActivityPrivacy, showGroupJoins: 'on' as const }
    assert.equal(canActorActivityAppearInFeed(privacy, 'group_join', stranger), true)
  })

  it('vendor activity follows vendor toggle', () => {
    const off = { ...defaultFeedActivityPrivacy, showVendorActivity: 'off' as const }
    assert.equal(canActorActivityAppearInFeed(defaultFeedActivityPrivacy, 'vendor_shop_live', stranger), true)
    assert.equal(canActorActivityAppearInFeed(off, 'vendor_shop_live', stranger), false)
  })
})
