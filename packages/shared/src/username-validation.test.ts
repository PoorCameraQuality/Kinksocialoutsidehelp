import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isEmailLikeUsername, usernameEqualsEmail, validatePublicUsername } from './username-validation.js'

describe('validatePublicUsername', () => {
  it('rejects email-shaped usernames', () => {
    assert.equal(validatePublicUsername('mj@example.com'), 'Username cannot be an email address. Pick a public @handle instead.')
  })

  it('rejects username identical to email', () => {
    assert.equal(
      validatePublicUsername('funpoly', 'funpoly@webthink.org'),
      null
    )
    assert.equal(
      validatePublicUsername('funpoly@webthink.org', 'funpoly@webthink.org'),
      'Username cannot be an email address. Pick a public @handle instead.'
    )
  })

  it('allows normal handles', () => {
    assert.equal(validatePublicUsername('MedusaMinded', 'mj@example.com'), null)
  })
})

describe('isEmailLikeUsername', () => {
  it('detects @ in username', () => {
    assert.equal(isEmailLikeUsername('user@host.com'), true)
    assert.equal(isEmailLikeUsername('MedusaMinded'), false)
  })
})

describe('usernameEqualsEmail', () => {
  it('is case insensitive', () => {
    assert.equal(usernameEqualsEmail('MJ@Example.COM', 'mj@example.com'), true)
  })
})
