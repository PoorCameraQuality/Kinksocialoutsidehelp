import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MESSAGING_EMPTY_INBOX_BODY,
  MESSAGING_EMPTY_INBOX_TITLE,
  PROFILE_MESSAGE_HINT_CONNECT_FIRST,
  PROFILE_MESSAGING_HELPER,
  profileMessageHintCopy,
} from './messaging-copy.ts'

describe('messaging copy', () => {
  it('includes inbox empty state strings', () => {
    assert.equal(MESSAGING_EMPTY_INBOX_TITLE, 'No messages yet.')
    assert.match(MESSAGING_EMPTY_INBOX_BODY, /messaging settings/)
  })

  it('includes profile messaging helper', () => {
    assert.match(PROFILE_MESSAGING_HELPER, /privacy settings/)
  })

  it('maps profile message hints to safe copy', () => {
    assert.equal(profileMessageHintCopy('connect_first'), PROFILE_MESSAGE_HINT_CONNECT_FIRST)
    assert.equal(profileMessageHintCopy('limited'), 'This member limits who can message them.')
    assert.equal(profileMessageHintCopy('unavailable'), 'Messaging is unavailable.')
    assert.equal(profileMessageHintCopy(null), null)
  })
})
