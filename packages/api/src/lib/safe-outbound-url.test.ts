import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  UnsafeOutboundUrlError,
  assertSafeOutboundHttpsUrl,
  fetchSafeOutboundUrl,
} from './safe-outbound-url.js'

async function expectUnsafe(url: string): Promise<void> {
  await assert.rejects(
    () => assertSafeOutboundHttpsUrl(url),
    UnsafeOutboundUrlError,
    `expected ${url} to be rejected`
  )
}

describe('assertSafeOutboundHttpsUrl (PR 3 M3/M7)', () => {
  test('rejects non-https schemes', async () => {
    await expectUnsafe('http://example.com/feed.xml')
    await expectUnsafe('ftp://example.com/file')
    await expectUnsafe('file:///etc/passwd')
    await expectUnsafe('not a url')
  })

  test('rejects loopback and unspecified addresses', async () => {
    await expectUnsafe('https://127.0.0.1/feed.xml')
    await expectUnsafe('https://127.8.8.8/feed.xml')
    await expectUnsafe('https://0.0.0.0/x')
    await expectUnsafe('https://localhost/x')
    await expectUnsafe('https://foo.localhost/x')
    await expectUnsafe('https://[::1]/x')
  })

  test('rejects RFC1918, link-local, CGNAT, and metadata hosts', async () => {
    await expectUnsafe('https://10.0.0.5/x')
    await expectUnsafe('https://172.16.0.1/x')
    await expectUnsafe('https://172.31.255.255/x')
    await expectUnsafe('https://192.168.1.1/x')
    await expectUnsafe('https://169.254.169.254/latest/meta-data/')
    await expectUnsafe('https://100.64.0.1/x')
    await expectUnsafe('https://metadata.google.internal/computeMetadata/v1/')
    await expectUnsafe('https://internal-api.corp.internal/x')
    await expectUnsafe('https://printer.local/x')
  })

  test('rejects private IPv6 and IPv4-mapped IPv6', async () => {
    await expectUnsafe('https://[fe80::1]/x')
    await expectUnsafe('https://[fd00::1]/x')
    await expectUnsafe('https://[::ffff:10.0.0.1]/x')
  })

  test('rejects URLs with embedded credentials', async () => {
    await expectUnsafe('https://user:pass@example.com/x')
  })

  test('accepts public IP literals without DNS', async () => {
    const url = await assertSafeOutboundHttpsUrl('https://93.184.216.34/feed.xml')
    assert.equal(url.hostname, '93.184.216.34')
  })
})

describe('fetchSafeOutboundUrl redirect re-validation (PR 3 M3/M7)', () => {
  function redirectingFetch(map: Record<string, { status: number; location?: string }>): typeof fetch {
    return (async (input: string | URL | Request) => {
      const key = String(input)
      const entry = map[key]
      if (!entry) return new Response('ok', { status: 200 })
      const headers = new Headers()
      if (entry.location) headers.set('location', entry.location)
      return new Response(null, { status: entry.status, headers })
    }) as typeof fetch
  }

  test('follows a safe redirect and returns the final response', async () => {
    const res = await fetchSafeOutboundUrl('https://198.51.100.7/a', {
      fetchImpl: redirectingFetch({
        'https://198.51.100.7/a': { status: 302, location: 'https://198.51.100.7/b' },
      }),
    })
    assert.equal(res.status, 200)
  })

  test('rejects a redirect that targets an internal address', async () => {
    await assert.rejects(
      () =>
        fetchSafeOutboundUrl('https://198.51.100.7/a', {
          fetchImpl: redirectingFetch({
            'https://198.51.100.7/a': {
              status: 302,
              location: 'https://169.254.169.254/latest/meta-data/',
            },
          }),
        }),
      UnsafeOutboundUrlError
    )
  })

  test('rejects a redirect that downgrades to http', async () => {
    await assert.rejects(
      () =>
        fetchSafeOutboundUrl('https://198.51.100.7/a', {
          fetchImpl: redirectingFetch({
            'https://198.51.100.7/a': { status: 301, location: 'http://198.51.100.7/b' },
          }),
        }),
      UnsafeOutboundUrlError
    )
  })

  test('gives up after too many redirects', async () => {
    await assert.rejects(
      () =>
        fetchSafeOutboundUrl('https://198.51.100.7/loop', {
          fetchImpl: redirectingFetch({
            'https://198.51.100.7/loop': { status: 302, location: 'https://198.51.100.7/loop' },
          }),
        }),
      UnsafeOutboundUrlError
    )
  })
})
