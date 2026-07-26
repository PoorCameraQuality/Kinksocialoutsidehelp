import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { loadEckePublishClientConfig, publishListingToEcke } from './ecke-publish-client.js'

const ENV_KEYS = [
  'ECKE_PUBLISH_ENABLED',
  'ECKE_SUPABASE_URL',
  'ECKE_SUPABASE_SERVICE_ROLE_KEY',
  'ECKE_PUBLISH_LISTING_WEBHOOK_URL',
  'ECKE_PUBLISH_WEBHOOK_SECRET',
] as const

function saveEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {}
  for (const k of ENV_KEYS) snap[k] = process.env[k]
  return snap
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
}

describe('loadEckePublishClientConfig', () => {
  const snap = saveEnv()

  afterEach(() => {
    restoreEnv(snap)
  })

  it('returns null when disabled', () => {
    process.env.ECKE_PUBLISH_ENABLED = 'false'
    process.env.ECKE_SUPABASE_URL = 'https://example.supabase.co'
    process.env.ECKE_SUPABASE_SERVICE_ROLE_KEY = 'secret'
    assert.equal(loadEckePublishClientConfig(), null)
  })

  it('returns null when creds missing', () => {
    process.env.ECKE_PUBLISH_ENABLED = 'true'
    delete process.env.ECKE_SUPABASE_URL
    delete process.env.ECKE_SUPABASE_SERVICE_ROLE_KEY
    assert.equal(loadEckePublishClientConfig(), null)
  })

  it('loads config when enabled with supabase creds', () => {
    process.env.ECKE_PUBLISH_ENABLED = 'true'
    process.env.ECKE_SUPABASE_URL = 'https://example.supabase.co/'
    process.env.ECKE_SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.ECKE_PUBLISH_LISTING_WEBHOOK_URL = 'https://ecke.example/publish'
    process.env.ECKE_PUBLISH_WEBHOOK_SECRET = 'whsec'

    const cfg = loadEckePublishClientConfig()
    assert.ok(cfg)
    assert.equal(cfg!.supabaseUrl, 'https://example.supabase.co')
    assert.equal(cfg!.listingWebhookUrl, 'https://ecke.example/publish')
  })
})

describe('publishListingToEcke guards', () => {
  const cfg = {
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'service-key',
    listingWebhookUrl: 'https://ecke.example/publish',
  }

  it('rejects hidden listings', async () => {
    const result = await publishListingToEcke(cfg, {
      slug: 'secret-con',
      title: 'Secret',
      visibility: 'hidden',
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /not public/i)
  })

  it('rejects payloads containing kink.social URLs', async () => {
    const result = await publishListingToEcke(cfg, {
      slug: 'bad-link',
      title: 'Bad',
      visibility: 'public',
      description: 'See https://kink.social/events/1',
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /kink\.social/i)
  })
})
