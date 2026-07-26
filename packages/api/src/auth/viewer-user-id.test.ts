import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import { getViewerUserId } from './viewer-user-id.js'

describe('getViewerUserId', () => {
  it('returns UUID sub as the database user id', () => {
    const userId = randomUUID()
    assert.equal(getViewerUserId({ username: 'demo', sub: userId }), userId)
  })

  it('rejects mock/demo username subjects', () => {
    assert.equal(getViewerUserId({ username: 'RopeDreamer', sub: 'RopeDreamer' }), null)
  })

  it('returns null for missing payload or sub', () => {
    assert.equal(getViewerUserId(null), null)
    assert.equal(getViewerUserId(undefined), null)
    assert.equal(getViewerUserId({ username: 'x', sub: '' }), null)
  })
})
