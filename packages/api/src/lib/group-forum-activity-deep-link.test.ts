import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildGroupForumThreadDeepLink } from './group-forum-activity.js'

const threadId = '11111111-1111-4111-8111-111111111111'
const groupId = '22222222-2222-4222-8222-222222222222'

describe('buildGroupForumThreadDeepLink', () => {
  it('includes thread query param when thread id is provided', () => {
    const link = buildGroupForumThreadDeepLink(
      { groupSlug: 'philly-rope', groupId },
      threadId,
    )
    assert.equal(
      link,
      `/groups/philly-rope?tab=Forums&thread=${encodeURIComponent(threadId)}`,
    )
  })

  it('falls back to Forums tab without thread id', () => {
    const link = buildGroupForumThreadDeepLink({ groupSlug: 'philly-rope', groupId }, null)
    assert.equal(link, '/groups/philly-rope?tab=Forums')
  })

  it('uses group id when slug is missing', () => {
    const link = buildGroupForumThreadDeepLink({ groupId }, threadId)
    assert.equal(
      link,
      `/groups/${encodeURIComponent(groupId)}?tab=Forums&thread=${encodeURIComponent(threadId)}`,
    )
  })
})
