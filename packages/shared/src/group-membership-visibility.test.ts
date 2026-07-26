import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canViewerSeeGroupMemberInPublicList,
  effectiveGroupMemberListVisibility,
  shouldEmitGroupJoinFeedActivity,
  shouldEmitGroupForumThreadFeedActivity,
} from './group-membership-visibility.js'

const regularMemberCtx = { isOwner: false, isGroupStaff: false, isSiteStaff: false, isSelf: false }
const ownerCtx = { isOwner: true, isGroupStaff: false, isSiteStaff: false, isSelf: false }
const modCtx = { isOwner: false, isGroupStaff: true, isSiteStaff: false, isSelf: false }
const siteStaffCtx = { isOwner: false, isGroupStaff: false, isSiteStaff: true, isSelf: false }
const selfCtx = { isOwner: false, isGroupStaff: false, isSiteStaff: false, isSelf: true }

describe('group-membership-visibility', () => {
  it('staff roles are always visible in member lists', () => {
    assert.equal(effectiveGroupMemberListVisibility('owner', 'hidden'), 'visible')
    assert.equal(effectiveGroupMemberListVisibility('admin', 'hidden'), 'visible')
    assert.equal(effectiveGroupMemberListVisibility('moderator', 'hidden'), 'visible')
  })

  it('hidden members do not appear in public member list', () => {
    assert.equal(canViewerSeeGroupMemberInPublicList('hidden', 'member', regularMemberCtx), false)
  })

  it('hidden members are visible to group owner, staff, and site staff', () => {
    assert.equal(canViewerSeeGroupMemberInPublicList('hidden', 'member', ownerCtx), true)
    assert.equal(canViewerSeeGroupMemberInPublicList('hidden', 'member', modCtx), true)
    assert.equal(canViewerSeeGroupMemberInPublicList('hidden', 'member', siteStaffCtx), true)
  })

  it('hidden members can see themselves', () => {
    assert.equal(canViewerSeeGroupMemberInPublicList('hidden', 'member', selfCtx), true)
  })

  it('visible members appear to regular viewers', () => {
    assert.equal(canViewerSeeGroupMemberInPublicList('visible', 'member', regularMemberCtx), true)
  })

  it('hidden group join does not create public feed activity', () => {
    assert.equal(
      shouldEmitGroupJoinFeedActivity(
        { memberListVisibility: 'hidden', announceGroupJoinInFeed: true },
        'member',
      ),
      false,
    )
    assert.equal(
      shouldEmitGroupJoinFeedActivity(
        { memberListVisibility: 'visible', announceGroupJoinInFeed: false },
        'member',
      ),
      false,
    )
    assert.equal(
      shouldEmitGroupJoinFeedActivity(
        { memberListVisibility: 'visible', announceGroupJoinInFeed: true },
        'member',
      ),
      true,
    )
  })

  it('staff promotion forces visible even when feed announce is on', () => {
    assert.equal(
      shouldEmitGroupJoinFeedActivity(
        { memberListVisibility: 'hidden', announceGroupJoinInFeed: true },
        'moderator',
      ),
      true,
    )
  })

  it('hidden members do not emit group forum thread feed activity', () => {
    assert.equal(
      shouldEmitGroupForumThreadFeedActivity({ memberListVisibility: 'hidden' }, 'member'),
      false,
    )
    assert.equal(
      shouldEmitGroupForumThreadFeedActivity({ memberListVisibility: 'visible' }, 'member'),
      true,
    )
    assert.equal(
      shouldEmitGroupForumThreadFeedActivity({ memberListVisibility: 'hidden' }, 'moderator'),
      true,
    )
  })
})
