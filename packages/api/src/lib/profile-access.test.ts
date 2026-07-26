import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canViewerReadProfile, canViewerReadProfileEmail } from './profile-access.js'

describe('profile-access', () => {
  it('canViewerReadProfileEmail is owner-only', () => {
    assert.equal(canViewerReadProfileEmail(true), true)
    assert.equal(canViewerReadProfileEmail(false), false)
  })

  it('PRIVATE profile is owner-only', () => {
    assert.equal(canViewerReadProfile('PRIVATE', { viewerId: null, isOwner: false }), false)
    assert.equal(canViewerReadProfile('PRIVATE', { viewerId: 'u2', isOwner: false }), false)
    assert.equal(canViewerReadProfile('PRIVATE', { viewerId: 'u1', isOwner: true }), true)
  })

  it('MEMBERS profile requires signed-in viewer', () => {
    assert.equal(canViewerReadProfile('MEMBERS', { viewerId: null, isOwner: false }), false)
    assert.equal(canViewerReadProfile('MEMBERS', { viewerId: 'u2', isOwner: false }), true)
  })

  it('PUBLIC profile is readable by anyone', () => {
    assert.equal(canViewerReadProfile('PUBLIC', { viewerId: null, isOwner: false }), true)
  })
})
