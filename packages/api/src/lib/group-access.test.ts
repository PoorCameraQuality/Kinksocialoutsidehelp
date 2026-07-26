import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canViewGroup, filterGroupMembersForViewer } from './group-access.js'

describe('canViewGroup', () => {
  const privateGroup = {
    id: 'g1',
    disbandedAt: null,
    visibility: 'private' as const,
    ownerId: 'owner-1',
  }

  it('allows public groups for anonymous viewers', async () => {
    assert.equal(await canViewGroup({ ...privateGroup, visibility: 'public' }, null), true)
  })

  it('denies private groups for anonymous viewers', async () => {
    assert.equal(await canViewGroup(privateGroup, null), false)
  })
})

describe('filterGroupMembersForViewer', () => {
  const members = [
    { userId: 'visible-1', role: 'member', memberListVisibility: 'visible' as const },
    { userId: 'hidden-1', role: 'member', memberListVisibility: 'hidden' as const },
    { userId: 'hidden-mod', role: 'moderator', memberListVisibility: 'hidden' as const },
  ]

  it('hides hidden members from regular viewers', () => {
    const filtered = filterGroupMembersForViewer(members, {
      viewerUserId: 'viewer',
      groupOwnerId: 'owner-1',
      viewerMembership: { role: 'member' },
      isSiteStaff: false,
    })
    assert.deepEqual(
      filtered.map((m) => m.userId),
      ['visible-1', 'hidden-mod'],
    )
  })

  it('shows hidden members to group owner', () => {
    const filtered = filterGroupMembersForViewer(members, {
      viewerUserId: 'owner-1',
      groupOwnerId: 'owner-1',
      viewerMembership: { role: 'owner' },
      isSiteStaff: false,
    })
    assert.equal(filtered.length, 3)
  })

  it('shows hidden member to themselves', () => {
    const filtered = filterGroupMembersForViewer(members, {
      viewerUserId: 'hidden-1',
      groupOwnerId: 'owner-1',
      viewerMembership: { role: 'member' },
      isSiteStaff: false,
    })
    assert.ok(filtered.some((m) => m.userId === 'hidden-1'))
  })
})
