import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { aggregateFollowingFeedItems, aggregationWindowMs } from './feed-activity-aggregate.js'
import type { FollowingFeedItem } from './feed-following.js'

function activity(
  id: string,
  verb: string,
  actorId: string,
  username: string,
  createdAt: string,
  object: Record<string, unknown> = { type: 'media' },
): FollowingFeedItem {
  return {
    kind: 'activity',
    verb,
    cursor: id,
    createdAt,
    deepLink: '/home',
    actor: { id: actorId, username },
    object,
  }
}

describe('feed-activity-aggregate', () => {
  it('groups loves within window into one card with preview urls', () => {
    const t0 = new Date('2026-06-01T12:00:00Z').toISOString()
    const t1 = new Date('2026-06-01T12:20:00Z').toISOString()
    const items = aggregateFollowingFeedItems([
      activity('a1', 'loved', 'u1', 'Snizzle', t0, {
        type: 'media',
        mediaKind: 'video',
        previewUrls: ['/a.jpg'],
      }),
      activity('a2', 'loved', 'u1', 'Snizzle', t1, {
        type: 'media',
        mediaKind: 'video',
        previewUrls: ['/b.jpg'],
      }),
    ])
    assert.equal(items.length, 1)
    assert.equal(items[0]?.object?.count, 2)
    assert.deepEqual(items[0]?.object?.previewUrls, ['/a.jpg', '/b.jpg'])
  })

  it('does not merge unrelated object types', () => {
    const t = new Date('2026-06-01T12:00:00Z').toISOString()
    const items = aggregateFollowingFeedItems([
      activity('a1', 'loved', 'u1', 'Snizzle', t, { type: 'media' }),
      activity('a2', 'loved', 'u1', 'Snizzle', t, { type: 'discussion' }),
    ])
    assert.equal(items.length, 2)
  })

  it('follow batches merge usernames', () => {
    const t = new Date('2026-06-01T12:00:00Z').toISOString()
    const items = aggregateFollowingFeedItems([
      activity('f1', 'followed', 'u1', 'Danial12', t, {
        type: 'profile',
        usernames: ['a'],
      }),
      activity('f2', 'followed', 'u1', 'Danial12', t, {
        type: 'profile',
        usernames: ['b'],
      }),
    ])
    assert.equal(items.length, 1)
    assert.equal(items[0]?.object?.count, 2)
  })

  it('aggregation windows exist for key verbs', () => {
    assert.ok(aggregationWindowMs('loved'))
    assert.ok(aggregationWindowMs('followed'))
    assert.equal(aggregationWindowMs('group_join'), null)
  })
})
