import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPublicWebPath } from './public-routes'

describe('isPublicWebPath', () => {
  it('allows auth and play browse without a session', () => {
    for (const path of ['/', '/login', '/join', '/play', '/play/summer-camp', '/verify-email']) {
      assert.equal(isPublicWebPath(path), true, path)
    }
  })

  it('keeps nested play manage/schedule auth-gated', () => {
    for (const path of ['/play/schedule', '/play/summer/reservations', '/play/summer/program/manage']) {
      assert.equal(isPublicWebPath(path), false, path)
    }
  })

  it('allows guest share links', () => {
    assert.equal(isPublicWebPath('/play/summer/s/token123'), true)
    assert.equal(isPublicWebPath('/conventions/foo/dancecard/s/token123'), true)
  })

  it('still gates member surfaces', () => {
    for (const path of ['/home', '/messaging', '/settings', '/notifications']) {
      assert.equal(isPublicWebPath(path), false, path)
    }
  })
})
