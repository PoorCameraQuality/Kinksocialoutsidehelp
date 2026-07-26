import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { FollowingFeedItem, HomeFeedPost } from './feed-types.ts'
import {
  demoFollowingFeedItems,
  demoHomeFeedPosts,
  presentFollowingFeedItems,
  presentHomeFeedPosts,
} from './following-feed-demo.ts'

function apiPost(id: string, body: string): HomeFeedPost {
  return {
    id,
    authorUsername: 'real_user',
    authorAvatarUrl: null,
    kind: 'status',
    title: null,
    body,
    bodyFormat: 'text',
    attachments: [],
    mentions: [],
    repostOfId: null,
    timeAgo: '1m ago',
    likes: 0,
    comments: 0,
    source: 'api',
  }
}

function apiFollowingPost(id: string): FollowingFeedItem {
  return {
    kind: 'post',
    cursor: `post-${id}`,
    createdAt: new Date().toISOString(),
    deepLink: `/feed/posts/${id}`,
    post: apiPost(id, 'Real following post'),
  }
}

describe('presentHomeFeedPosts', () => {
  it('returns empty array without demo padding by default', () => {
    assert.deepEqual(presentHomeFeedPosts([]), [])
  })

  it('keeps sparse real posts without demo padding by default', () => {
    const real = [apiPost('r1', 'Hello'), apiPost('r2', 'World')]
    const out = presentHomeFeedPosts(real)
    assert.equal(out.length, 2)
    assert.equal(out.every((p) => p.source === 'api'), true)
  })

  it('filters automated e2e posts without injecting demo content', () => {
    const out = presentHomeFeedPosts([apiPost('e2e-1', 'e2e-following-feed smoke')])
    assert.equal(out.length, 0)
  })

  it('injects demo posts only when allowDemoPadding is true', () => {
    const out = presentHomeFeedPosts([], { allowDemoPadding: true })
    assert.ok(out.length > 0)
    assert.equal(out.every((p) => p.source === 'mock'), true)
    assert.deepEqual(out, demoHomeFeedPosts())
  })

  it('pads sparse real feeds only when allowDemoPadding is true', () => {
    const real = [apiPost('r1', 'Only one')]
    const out = presentHomeFeedPosts(real, { allowDemoPadding: true })
    assert.ok(out.length >= 5)
    assert.ok(out.some((p) => p.id === 'r1'))
    assert.ok(out.some((p) => p.source === 'mock'))
  })
})

describe('presentFollowingFeedItems', () => {
  it('returns empty array without demo padding by default', () => {
    assert.deepEqual(presentFollowingFeedItems([]), [])
  })

  it('keeps sparse real items without demo padding by default', () => {
    const real = [apiFollowingPost('f1')]
    const out = presentFollowingFeedItems(real)
    assert.equal(out.length, 1)
    assert.equal(out[0]?.kind, 'post')
  })

  it('injects demo items only when allowDemoPadding is true', () => {
    const out = presentFollowingFeedItems([], { allowDemoPadding: true })
    assert.ok(out.length > 0)
    assert.deepEqual(out.length, demoFollowingFeedItems().length)
  })
})
