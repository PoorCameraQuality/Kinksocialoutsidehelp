import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canViewerBrowseConnectionsList,
  canViewerSeeMutualConnectionsCount,
} from './connections-list-visibility.js'

describe('connections-list-visibility', () => {
  it('owner and moderator always browse', () => {
    assert.equal(
      canViewerBrowseConnectionsList('hidden', { isOwner: true, isAuthenticated: false, isConnected: false }),
      true,
    )
    assert.equal(
      canViewerBrowseConnectionsList('hidden', {
        isOwner: false,
        isAuthenticated: false,
        isConnected: false,
        isModerator: true,
      }),
      true,
    )
  })

  it('hidden blocks non-owners', () => {
    assert.equal(
      canViewerBrowseConnectionsList('hidden', { isOwner: false, isAuthenticated: true, isConnected: true }),
      false,
    )
  })

  it('connections_only requires mutual connection', () => {
    assert.equal(
      canViewerBrowseConnectionsList('connections_only', {
        isOwner: false,
        isAuthenticated: true,
        isConnected: false,
      }),
      false,
    )
    assert.equal(
      canViewerBrowseConnectionsList('connections_only', {
        isOwner: false,
        isAuthenticated: true,
        isConnected: true,
      }),
      true,
    )
  })

  it('members requires sign-in', () => {
    assert.equal(
      canViewerBrowseConnectionsList('members', { isOwner: false, isAuthenticated: false, isConnected: false }),
      false,
    )
    assert.equal(
      canViewerBrowseConnectionsList('members', { isOwner: false, isAuthenticated: true, isConnected: false }),
      true,
    )
  })

  it('public allows everyone', () => {
    assert.equal(
      canViewerBrowseConnectionsList('public', { isOwner: false, isAuthenticated: false, isConnected: false }),
      true,
    )
  })

  it('mutual count when list is hidden but viewer may know overlap', () => {
    assert.equal(
      canViewerSeeMutualConnectionsCount('connections_only', {
        isOwner: false,
        isAuthenticated: true,
        isConnected: false,
      }),
      true,
    )
    assert.equal(
      canViewerSeeMutualConnectionsCount('hidden', {
        isOwner: false,
        isAuthenticated: true,
        isConnected: true,
      }),
      true,
    )
    assert.equal(
      canViewerSeeMutualConnectionsCount('public', {
        isOwner: false,
        isAuthenticated: true,
        isConnected: false,
      }),
      false,
    )
  })

  it('mutual count teaser is off for owner, moderator, and anonymous', () => {
    assert.equal(
      canViewerSeeMutualConnectionsCount('connections_only', {
        isOwner: true,
        isAuthenticated: true,
        isConnected: false,
      }),
      false,
    )
    assert.equal(
      canViewerSeeMutualConnectionsCount('connections_only', {
        isOwner: false,
        isAuthenticated: true,
        isConnected: false,
        isModerator: true,
      }),
      false,
    )
    assert.equal(
      canViewerSeeMutualConnectionsCount('connections_only', {
        isOwner: false,
        isAuthenticated: false,
        isConnected: false,
      }),
      false,
    )
  })
})
