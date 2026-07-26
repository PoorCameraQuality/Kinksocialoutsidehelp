import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { corsOriginsFromEnv } from './cors-origins.js'

describe('corsOriginsFromEnv', () => {
  const prev = process.env.CORS_ORIGIN

  afterEach(() => {
    if (prev === undefined) delete process.env.CORS_ORIGIN
    else process.env.CORS_ORIGIN = prev
  })

  it('defaults to localhost when unset', () => {
    delete process.env.CORS_ORIGIN
    assert.deepEqual(corsOriginsFromEnv(), ['http://localhost:5173', 'http://127.0.0.1:5173'])
  })

  it('drops empty entries from CORS_ORIGIN', () => {
    process.env.CORS_ORIGIN = 'https://kink.social, , https://www.kink.social,'
    assert.deepEqual(corsOriginsFromEnv(), ['https://kink.social', 'https://www.kink.social'])
  })
})
