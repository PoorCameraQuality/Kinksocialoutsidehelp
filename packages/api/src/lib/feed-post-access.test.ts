import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultFeedActivityPrivacy, type FeedActivityPrivacy } from '@c2k/shared'
import { canViewerSeeAuthorPostInGlobalFeed } from './feed-post-access.js'

function privacy(showPostsInFeeds: FeedActivityPrivacy['showPostsInFeeds']): FeedActivityPrivacy {
  return { ...defaultFeedActivityPrivacy, showPostsInFeeds }
}

function ctx(
  viewerId: string | null,
  authorId: string,
  opts?: { connected?: boolean; blocked?: boolean; showPostsInFeeds?: FeedActivityPrivacy['showPostsInFeeds'] },
) {
  const viewerConnectionIds = new Set<string>()
  if (viewerId) viewerConnectionIds.add(viewerId)
  if (opts?.connected && viewerId) viewerConnectionIds.add(authorId)
  const blockedAuthorIds = opts?.blocked ? new Set([authorId]) : new Set<string>()
  const privacyByActor = new Map([
    [authorId, privacy(opts?.showPostsInFeeds ?? 'normal')],
  ])
  return canViewerSeeAuthorPostInGlobalFeed({
    viewerId,
    authorId,
    blockedAuthorIds,
    viewerConnectionIds,
    privacyByActor,
  })
}

describe('canViewerSeeAuthorPostInGlobalFeed', () => {
  it('global feed excludes posts from a user blocked by the viewer', () => {
    assert.equal(ctx('viewer-1', 'author-1', { blocked: true }), false)
  })

  it('global feed excludes posts from a user who blocked the viewer', () => {
    assert.equal(ctx('viewer-1', 'author-1', { blocked: true }), false)
  })

  it('global feed excludes only_me author posts for other viewers', () => {
    assert.equal(ctx('viewer-1', 'author-1', { showPostsInFeeds: 'only_me' }), false)
    assert.equal(ctx(null, 'author-1', { showPostsInFeeds: 'only_me' }), false)
  })

  it('global feed includes only_me author posts for the author', () => {
    assert.equal(ctx('author-1', 'author-1', { showPostsInFeeds: 'only_me' }), true)
  })

  it('global feed excludes connections_only author posts for strangers', () => {
    assert.equal(ctx('viewer-1', 'author-1', { showPostsInFeeds: 'connections_only' }), false)
    assert.equal(ctx(null, 'author-1', { showPostsInFeeds: 'connections_only' }), false)
  })

  it('global feed includes connections_only author posts for accepted connections', () => {
    assert.equal(
      ctx('viewer-1', 'author-1', { showPostsInFeeds: 'connections_only', connected: true }),
      true,
    )
  })

  it('global feed includes normal author posts for strangers', () => {
    assert.equal(ctx('viewer-1', 'author-1', { showPostsInFeeds: 'normal' }), true)
    assert.equal(ctx(null, 'author-1', { showPostsInFeeds: 'normal' }), true)
  })
})
