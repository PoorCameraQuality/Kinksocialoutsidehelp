import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getRequestIpRaw, isTrustProxyEnabled, registrationIpPrefixFromRequest } from './client-ip.js'

describe('client-ip', () => {
  test('isTrustProxyEnabled is false in dev by default', () => {
    const prevNode = process.env.NODE_ENV
    const prevC2k = process.env.C2K_ENV
    const prevTrust = process.env.C2K_TRUST_PROXY
    delete process.env.C2K_TRUST_PROXY
    process.env.NODE_ENV = 'development'
    delete process.env.C2K_ENV
    assert.equal(isTrustProxyEnabled(), false)
    process.env.C2K_TRUST_PROXY = 'true'
    assert.equal(isTrustProxyEnabled(), true)
    if (prevNode !== undefined) process.env.NODE_ENV = prevNode
    else delete process.env.NODE_ENV
    if (prevC2k !== undefined) process.env.C2K_ENV = prevC2k
    if (prevTrust !== undefined) process.env.C2K_TRUST_PROXY = prevTrust
    else delete process.env.C2K_TRUST_PROXY
  })

  test('getRequestIpRaw ignores X-Forwarded-For when trust proxy is off', () => {
    const prev = process.env.C2K_TRUST_PROXY
    process.env.C2K_TRUST_PROXY = 'false'
    const req = {
      ip: '203.0.113.1',
      headers: { 'x-forwarded-for': '198.51.100.99' },
      socket: { remoteAddress: '127.0.0.1' },
    } as never
    assert.equal(getRequestIpRaw(req), '127.0.0.1')
    if (prev !== undefined) process.env.C2K_TRUST_PROXY = prev
    else delete process.env.C2K_TRUST_PROXY
  })

  test('getRequestIpRaw uses req.ip when trust proxy is on', () => {
    const prev = process.env.C2K_TRUST_PROXY
    process.env.C2K_TRUST_PROXY = 'true'
    const req = {
      ip: '203.0.113.1',
      headers: { 'x-forwarded-for': '198.51.100.99' },
      socket: { remoteAddress: '127.0.0.1' },
    } as never
    assert.equal(getRequestIpRaw(req), '203.0.113.1')
    if (prev !== undefined) process.env.C2K_TRUST_PROXY = prev
    else delete process.env.C2K_TRUST_PROXY
  })

  test('registrationIpPrefixFromRequest uses IPv4 from trusted ip', () => {
    const prev = process.env.C2K_TRUST_PROXY
    process.env.C2K_TRUST_PROXY = 'true'
    const req = {
      ip: '203.0.113.44',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as never
    assert.equal(registrationIpPrefixFromRequest(req), '203.0.113.44')
    if (prev !== undefined) process.env.C2K_TRUST_PROXY = prev
    else delete process.env.C2K_TRUST_PROXY
  })
})
