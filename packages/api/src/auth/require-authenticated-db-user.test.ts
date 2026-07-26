import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { encodeSession, SESSION_COOKIE_NAME } from '@c2k/shared/session-token'
import { requireAuthenticatedDbUser } from './require-authenticated-db-user.js'

function mockReply() {
  const state: { statusCode?: number; body?: unknown } = {}
  const reply = {
    status(code: number) {
      state.statusCode = code
      return this
    },
    send(body: unknown) {
      state.body = body
      return this
    },
  } as unknown as FastifyReply
  return { reply, state }
}

function mockReq(cookies: Record<string, string> = {}): FastifyRequest {
  return { cookies } as unknown as FastifyRequest
}

describe('requireAuthenticatedDbUser', () => {
  it('returns 401 Unauthorized when no session', () => {
    const { reply, state } = mockReply()
    const result = requireAuthenticatedDbUser(mockReq(), reply)
    assert.equal(result, null)
    assert.equal(state.statusCode, 401)
    assert.deepEqual(state.body, { error: 'Unauthorized' })
  })

  it('returns 401 Invalid session for authenticated non-UUID sub', () => {
    const { reply, state } = mockReply()
    const token = encodeSession({ username: 'RopeDreamer', sub: 'RopeDreamer' })
    const result = requireAuthenticatedDbUser(
      mockReq({ [SESSION_COOKIE_NAME]: token }),
      reply,
    )
    assert.equal(result, null)
    assert.equal(state.statusCode, 401)
    assert.deepEqual(state.body, { error: 'Invalid session' })
  })

  it('returns userId for a UUID session subject', () => {
    const userId = randomUUID()
    const { reply, state } = mockReply()
    const token = encodeSession({ username: 'demo', sub: userId })
    const result = requireAuthenticatedDbUser(
      mockReq({ [SESSION_COOKIE_NAME]: token }),
      reply,
    )
    assert.deepEqual(result, { userId })
    assert.equal(state.statusCode, undefined)
  })
})
