import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  allowMockGroupExperienceFromFlags,
  groupsSectionNavForViewer,
  isStubGroupsLibraryMode,
  shouldFetchApiGroupDetailFromFlags,
} from './group-detail-guards.ts'
import { API_GROUP_TABS, groupCommunityTabs, MOCK_GROUP_TABS } from './group-community-tabs.ts'

describe('group detail guards', () => {
  it('allows mock groups only in unsigned demo fallback env', () => {
    assert.equal(allowMockGroupExperienceFromFlags(true, false), true)
    assert.equal(allowMockGroupExperienceFromFlags(true, true), false)
    assert.equal(allowMockGroupExperienceFromFlags(false, false), false)
  })

  it('fetches API detail when not in unsigned demo fallback', () => {
    assert.equal(shouldFetchApiGroupDetailFromFlags('g0', true, false), false)
    assert.equal(shouldFetchApiGroupDetailFromFlags('g0', true, true), true)
    assert.equal(shouldFetchApiGroupDetailFromFlags('g0', false, false), true)
  })

  it('hides stub personal library nav for signed-in real users', () => {
    const realNav = groupsSectionNavForViewer(true)
    assert.ok(realNav.some((n) => n.match === 'discover'))
    assert.ok(realNav.some((n) => n.match === 'my'))
    assert.equal(
      realNav.some((n) => n.match === 'invitations' || n.match === 'posts' || n.match === 'saved'),
      false,
    )
    const demoNav = groupsSectionNavForViewer(false)
    assert.ok(demoNav.some((n) => n.match === 'invitations'))
  })

  it('marks stub library modes', () => {
    assert.equal(isStubGroupsLibraryMode('invitations'), true)
    assert.equal(isStubGroupsLibraryMode('my'), false)
  })
})

describe('groupCommunityTabs', () => {
  it('uses API tabs without mock-only sections for real groups', () => {
    assert.deepEqual(groupCommunityTabs(true), API_GROUP_TABS)
    assert.ok(!groupCommunityTabs(true).includes('Channels'))
  })

  it('uses mock tabs for demo slug groups', () => {
    assert.deepEqual(groupCommunityTabs(false), MOCK_GROUP_TABS)
    assert.ok(!groupCommunityTabs(false).includes('Forums'))
  })
})
