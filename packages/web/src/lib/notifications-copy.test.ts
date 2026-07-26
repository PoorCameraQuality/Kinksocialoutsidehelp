import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ACTIVITY_EMPTY_BODY,
  NOTIFICATIONS_EMPTY_BODY,
  NOTIFICATIONS_EMPTY_TITLE,
  NOTIFICATIONS_PAGE_INTRO,
} from './notifications-copy.ts'

describe('notifications copy', () => {
  it('includes page intro and empty state strings', () => {
    assert.match(NOTIFICATIONS_PAGE_INTRO, /need your attention/)
    assert.equal(NOTIFICATIONS_EMPTY_TITLE, 'No notifications yet.')
    assert.match(NOTIFICATIONS_EMPTY_BODY, /accepts a connection/)
    assert.match(ACTIVITY_EMPTY_BODY, /real activity stream/)
  })
})
