import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ALPHA_SOCIAL_BATCH_KEY,
  ALPHA_SOCIAL_POSTS,
  ALPHA_SOCIAL_USERS,
  alphaSocialEmail,
  alphaSocialMarker,
  isAlphaSocialEmail,
  isAlphaSocialUsername,
} from './alpha-social-seed-catalog.js'

describe('alpha-social-seed-catalog', () => {
  it('uses stable batch key and marker prefix', () => {
    assert.equal(ALPHA_SOCIAL_BATCH_KEY, 'alpha-social-seed')
    assert.equal(alphaSocialMarker('demo'), '[alpha_social_seed:demo]')
  })

  it('namespaces usernames and emails', () => {
    for (const user of ALPHA_SOCIAL_USERS) {
      assert.ok(isAlphaSocialUsername(user.username), user.username)
      const email = alphaSocialEmail(user.username)
      assert.ok(isAlphaSocialEmail(email), email)
      assert.ok(email.endsWith('@example.test'))
    }
  })

  it('has unique post keys and markers', () => {
    const keys = ALPHA_SOCIAL_POSTS.map((p) => p.key)
    assert.equal(new Set(keys).size, keys.length)
    for (const post of ALPHA_SOCIAL_POSTS) {
      assert.ok(post.body.includes(alphaSocialMarker(post.key)), post.key)
    }
  })

  it('includes privacy scenario authors', () => {
    const usernames = new Set(ALPHA_SOCIAL_USERS.map((u) => u.username))
    assert.ok(usernames.has('alpha_connected'))
    assert.ok(usernames.has('alpha_private'))
    assert.ok(usernames.has('alpha_quiet'))
    assert.ok(usernames.has('alpha_blocker'))
    assert.ok(usernames.has('alpha_open_dm'))
    assert.ok(usernames.has('alpha_connections_dm'))
  })
})
