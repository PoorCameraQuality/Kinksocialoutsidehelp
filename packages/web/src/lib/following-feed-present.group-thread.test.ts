import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  followingActivityVerbPhrase,
  followingFeedDeepLinkLabel,
  isCompactFollowingActivity,
  resolveGroupThreadActivityDeepLink,
} from './following-feed-present.ts'

const threadId = '11111111-1111-4111-8111-111111111111'

describe('group_thread_created presentation', () => {
  it('renders compact group discussion copy with thread title', () => {
    assert.equal(isCompactFollowingActivity('group_thread_created', {}), true)
    assert.equal(
      followingActivityVerbPhrase('group_thread_created', {
        groupName: 'Philly Rope',
        threadTitle: 'Rope safety Q&A',
      }),
      'started a discussion in Philly Rope: Rope safety Q&A',
    )
    assert.equal(followingFeedDeepLinkLabel('group_thread_created'), 'Read discussion')
  })

  it('omits group name when metadata is missing', () => {
    assert.equal(followingActivityVerbPhrase('group_thread_created', {}), 'started a group discussion')
  })

  it('resolves thread deep link from object id when backend link lacks thread param', () => {
    const link = resolveGroupThreadActivityDeepLink('/groups/philly-rope?tab=Forums', {
      id: threadId,
      groupSlug: 'philly-rope',
    })
    assert.equal(link, `/groups/philly-rope?tab=Forums&thread=${encodeURIComponent(threadId)}`)
  })

  it('falls back to forums tab when thread id is missing', () => {
    const link = resolveGroupThreadActivityDeepLink('/groups/philly-rope?tab=Forums', {
      groupSlug: 'philly-rope',
    })
    assert.equal(link, '/groups/philly-rope?tab=Forums')
  })
})

describe('post comment activity presentation', () => {
  it('renders compact comment rows with FetLife-style copy', () => {
    assert.equal(isCompactFollowingActivity('post_comment', {}), true)
    assert.equal(isCompactFollowingActivity('commented', {}), true)
    assert.equal(
      followingActivityVerbPhrase('post_comment', { postAuthorUsername: 'wildflours' }),
      "commented on wildflours's status update",
    )
    assert.equal(followingFeedDeepLinkLabel('post_comment'), 'View post')
  })
})
