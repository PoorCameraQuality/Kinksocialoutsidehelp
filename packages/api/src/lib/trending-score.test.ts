import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyTypeCaps,
  decayFactor,
  eventScoringAnchor,
  rawScoreV1,
  scoreV1,
  trendingWeightsV1,
  type TrendingCandidate,
} from './trending-score.js'

describe('decayFactor', () => {
  it('halves score every 48 hours', () => {
    assert.equal(decayFactor(48), 0.5)
    assert.equal(decayFactor(0), 1)
  })
})

describe('rawScoreV1', () => {
  it('adds reaction and repost weights', () => {
    const c: TrendingCandidate = {
      kind: 'feed_post',
      id: 'p1',
      createdAt: new Date(),
      likeCount: 2,
      repostCount: 1,
    }
    const expected = 1 + 2 * trendingWeightsV1.reaction + 1 * trendingWeightsV1.repost
    assert.equal(rawScoreV1(c), expected)
  })

  it('adds RSVP velocity for events', () => {
    const c: TrendingCandidate = {
      kind: 'event',
      id: 'e1',
      createdAt: new Date(),
      likeCount: 0,
      repostCount: 0,
      rsvpVelocityPerHour: 4,
    }
    assert.equal(rawScoreV1(c), 1 + 4 * trendingWeightsV1.rsvpPerHour)
  })
})

describe('scoreV1', () => {
  const now = new Date('2026-05-28T12:00:00.000Z')

  it('ranks higher engagement above newer low-engagement post', () => {
    const hot: TrendingCandidate = {
      kind: 'feed_post',
      id: 'hot',
      createdAt: new Date('2026-05-27T12:00:00.000Z'),
      likeCount: 10,
      repostCount: 3,
    }
    const fresh: TrendingCandidate = {
      kind: 'feed_post',
      id: 'fresh',
      createdAt: new Date('2026-05-28T11:00:00.000Z'),
      likeCount: 0,
      repostCount: 0,
    }
    assert.ok(scoreV1(hot, now) > scoreV1(fresh, now))
  })

  it('ranks event with recent RSVPs above stale equal-age event', () => {
    const createdAt = new Date('2026-05-20T12:00:00.000Z')
    const active: TrendingCandidate = {
      kind: 'event',
      id: 'active',
      createdAt,
      likeCount: 0,
      repostCount: 0,
      rsvpVelocityPerHour: 6,
    }
    const quiet: TrendingCandidate = {
      kind: 'event',
      id: 'quiet',
      createdAt,
      likeCount: 0,
      repostCount: 0,
      rsvpVelocityPerHour: 0,
    }
    assert.ok(scoreV1(active, now) > scoreV1(quiet, now))
  })
})

describe('eventScoringAnchor', () => {
  it('uses seven days before start when event was created earlier', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z')
    const startsAt = new Date('2026-06-01T00:00:00.000Z')
    const anchor = eventScoringAnchor(createdAt, startsAt)
    assert.equal(anchor.toISOString(), new Date('2026-05-25T00:00:00.000Z').toISOString())
  })
})

describe('applyTypeCaps', () => {
  const items = [
    { kind: 'feed_status', id: '1', score: 100 },
    { kind: 'feed_status', id: '2', score: 90 },
    { kind: 'feed_status', id: '3', score: 80 },
    { kind: 'event', id: 'e1', score: 70 },
    { kind: 'event', id: 'e2', score: 60 },
    { kind: 'education_article', id: 'a1', score: 50 },
    { kind: 'group', id: 'g1', score: 40 },
  ]

  it('respects feed and event caps at limit 10', () => {
    const out = applyTypeCaps(items, 10)
    const feed = out.filter((x) => x.kind.startsWith('feed_')).length
    const events = out.filter((x) => x.kind === 'event').length
    assert.ok(feed <= 5)
    assert.ok(events <= 3)
    assert.equal(out.length, items.length)
  })
})
