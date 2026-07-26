import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CONNECTIONS_EMPTY_BODY,
  CONNECTIONS_EMPTY_TITLE,
  FOLLOW_VS_CONNECT_LONG,
  FOLLOW_VS_CONNECT_SHORT,
  PEOPLE_EMPTY_NEW_ACCOUNT_TITLE,
  PEOPLE_EMPTY_SEARCH_TITLE,
  PROFILE_ACTION_HELPER,
} from './social-graph-copy.ts'

describe('social graph copy', () => {
  it('includes canonical follow vs connect short line', () => {
    assert.match(FOLLOW_VS_CONNECT_SHORT, /Follow helps shape/)
    assert.match(FOLLOW_VS_CONNECT_SHORT, /Connect is mutual/)
  })

  it('includes longer follow vs connect helper', () => {
    assert.match(FOLLOW_VS_CONNECT_LONG, /connection request/)
  })

  it('includes profile action helper', () => {
    assert.match(PROFILE_ACTION_HELPER, /Follow for public updates/)
  })

  it('includes people and connections empty titles', () => {
    assert.equal(PEOPLE_EMPTY_SEARCH_TITLE, 'No matching people yet.')
    assert.equal(PEOPLE_EMPTY_NEW_ACCOUNT_TITLE, 'Start finding your people.')
    assert.equal(CONNECTIONS_EMPTY_TITLE, 'Your connection circle starts small.')
    assert.match(CONNECTIONS_EMPTY_BODY, /block or report/)
  })
})
