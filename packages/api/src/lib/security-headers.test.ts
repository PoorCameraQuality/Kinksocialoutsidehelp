import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { afterEach, describe, it } from 'node:test'
import { registerSecurityHeaders } from './security-headers.js'

describe('registerSecurityHeaders', () => {
  const prevNode = process.env.NODE_ENV
  const prevC2k = process.env.C2K_ENV

  afterEach(() => {
    if (prevNode === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNode
    if (prevC2k === undefined) delete process.env.C2K_ENV
    else process.env.C2K_ENV = prevC2k
  })

  it('sets baseline security headers on responses', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.C2K_ENV
    const app = Fastify()
    await registerSecurityHeaders(app)
    app.get('/ping', async () => ({ ok: true }))
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/ping' })
    assert.equal(res.headers['x-content-type-options'], 'nosniff')
    assert.equal(res.headers['x-frame-options'], 'DENY')
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin')
    assert.equal(res.headers['cross-origin-resource-policy'], 'same-site')
    assert.match(String(res.headers['permissions-policy'] ?? ''), /camera=\(\)/)
    assert.equal(res.headers['strict-transport-security'], undefined)
    await app.close()
  })

  it('adds HSTS in production runtime', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.C2K_ENV
    const app = Fastify()
    await registerSecurityHeaders(app)
    app.get('/ping', async () => ({ ok: true }))
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/ping' })
    assert.match(String(res.headers['strict-transport-security'] ?? ''), /max-age=31536000/)
    await app.close()
  })
})
