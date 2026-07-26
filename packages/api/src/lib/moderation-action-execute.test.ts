import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveHideContentKind } from './moderation-action-execute.js'

describe('resolveHideContentKind', () => {
  it('resolves from payload contentKind', () => {
    assert.equal(resolveHideContentKind('forum_post', 'other'), 'forum_post')
    assert.equal(resolveHideContentKind('org_channel_message', 'other'), 'org_channel_message')
  })

  it('falls back to action targetType', () => {
    assert.equal(resolveHideContentKind(undefined, 'forum_post'), 'forum_post')
    assert.equal(resolveHideContentKind(null, 'org_channel_message'), 'org_channel_message')
  })

  it('returns null for unsupported kinds so execute can fail closed', () => {
    assert.equal(resolveHideContentKind('media_asset', 'media_asset'), null)
    assert.equal(resolveHideContentKind(undefined, 'user'), null)
    assert.equal(resolveHideContentKind(123, 'profile'), null)
  })
})
