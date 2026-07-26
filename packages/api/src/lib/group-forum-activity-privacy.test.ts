import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapFeedVerbToPrivacyKey } from './feed-activity-privacy-filter.js'

describe('group forum activity privacy mapping', () => {
  it('maps group_thread_created to commented privacy key', () => {
    assert.equal(mapFeedVerbToPrivacyKey('group_thread_created', 'activity'), 'commented')
  })
})
