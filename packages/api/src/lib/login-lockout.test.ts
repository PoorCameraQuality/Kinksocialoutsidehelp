import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isPgUniqueViolation,
  LOGIN_LOCKOUT_MESSAGE,
  LoginLockoutStore,
  loginLockoutKey,
  REGISTER_CONFLICT_MESSAGE,
} from './login-lockout.js'

describe('loginLockoutKey', () => {
  it('is case-insensitive and opaque', () => {
    assert.equal(loginLockoutKey('Alex@Example.com'), loginLockoutKey(' alex@example.com '))
    assert.notEqual(loginLockoutKey('alex@example.com'), 'alex@example.com')
  })
})

describe('LoginLockoutStore progressive backoff', () => {
  it('allows attempts until threshold, then locks with growing windows', () => {
    const store = new LoginLockoutStore({
      threshold: 3,
      baseLockMs: 1_000,
      maxLockMs: 8_000,
      stepEvery: 2,
      idleResetMs: 60_000,
    })
    let now = 1_000_000
    assert.equal(store.remainingLockMs('user', now), 0)

    assert.equal(store.recordFailure('user', now).lockedForMs, 0)
    assert.equal(store.recordFailure('user', now + 1).lockedForMs, 0)
    const third = store.recordFailure('user', now + 2)
    assert.equal(third.failures, 3)
    assert.equal(third.lockedForMs, 1_000)
    assert.ok(store.remainingLockMs('user', now + 2) > 0)

    // Still locked before expiry.
    assert.ok(store.remainingLockMs('user', now + 500) > 0)

    // After lock expires, further failures escalate.
    now = now + 2 + 1_001
    assert.equal(store.remainingLockMs('user', now), 0)
    store.recordFailure('user', now) // 4
    const fifth = store.recordFailure('user', now + 1) // 5 → still base until stepEvery past threshold
    // threshold=3, stepEvery=2 → at failures 3,4 = 1s; 5,6 = 2s
    assert.equal(fifth.failures, 5)
    assert.equal(fifth.lockedForMs, 2_000)
  })

  it('clears on success path helper', () => {
    const store = new LoginLockoutStore({ threshold: 2, baseLockMs: 5_000, maxLockMs: 5_000, stepEvery: 1, idleResetMs: 60_000 })
    store.recordFailure('alice', 100)
    store.recordFailure('alice', 101)
    assert.ok(store.remainingLockMs('alice', 102) > 0)
    store.clearFailures('alice')
    assert.equal(store.remainingLockMs('alice', 103), 0)
  })

  it('caps at maxLockMs', () => {
    const store = new LoginLockoutStore({
      threshold: 1,
      baseLockMs: 1_000,
      maxLockMs: 3_000,
      stepEvery: 1,
      idleResetMs: 60_000,
    })
    let last = 0
    for (let i = 0; i < 10; i++) {
      last = store.recordFailure('x', i).lockedForMs
    }
    assert.equal(last, 3_000)
  })
})

describe('register / lockout messaging', () => {
  it('exports stable privacy-safe messages', () => {
    assert.match(LOGIN_LOCKOUT_MESSAGE, /Too many sign-in attempts/i)
    assert.doesNotMatch(REGISTER_CONFLICT_MESSAGE, /already taken/i)
    assert.match(REGISTER_CONFLICT_MESSAGE, /sign in/i)
  })

  it('detects Postgres unique violations including nested cause', () => {
    assert.equal(isPgUniqueViolation({ code: '23505' }), true)
    assert.equal(isPgUniqueViolation({ cause: { code: '23505' } }), true)
    assert.equal(isPgUniqueViolation({ code: '23503' }), false)
    assert.equal(isPgUniqueViolation(null), false)
  })
})
