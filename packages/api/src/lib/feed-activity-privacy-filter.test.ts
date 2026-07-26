import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultFeedActivityPrivacy } from '@c2k/shared'
import {
  actorFeedActivityAllowed,
  mapFeedVerbToPrivacyKey,
} from './feed-activity-privacy-filter.js'

describe('feed-activity-privacy-filter', () => {
  it('maps DB verbs to privacy keys', () => {
    assert.equal(mapFeedVerbToPrivacyKey('group_join', 'activity'), 'group_join')
    assert.equal(mapFeedVerbToPrivacyKey('event_rsvp', 'activity'), 'event_rsvp')
    assert.equal(mapFeedVerbToPrivacyKey('post', 'post'), 'posted')
  })

  it('blocks stranger reactions when connections_only', () => {
    const privacyByActor = new Map([['actor-1', defaultFeedActivityPrivacy]])
    assert.equal(
      actorFeedActivityAllowed({
        actorId: 'actor-1',
        verb: 'loved',
        source: 'activity',
        viewerId: 'viewer-1',
        viewerConnectionIds: new Set(['viewer-1']),
        privacyByActor,
      }),
      false,
    )
  })

  it('allows connected actor reactions', () => {
    const privacyByActor = new Map([['actor-1', defaultFeedActivityPrivacy]])
    assert.equal(
      actorFeedActivityAllowed({
        actorId: 'actor-1',
        verb: 'loved',
        source: 'activity',
        viewerId: 'viewer-1',
        viewerConnectionIds: new Set(['viewer-1', 'actor-1']),
        privacyByActor,
      }),
      true,
    )
  })
})
