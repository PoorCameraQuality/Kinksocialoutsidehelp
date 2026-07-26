import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  eckeListingWebhookEndpoint,
  eckePublishIngestEndpoint,
  isEckeEventIngestEnabled,
  isEckeEventPublishBridgeConfigured,
  isEckeIngestEnabledFor,
  isEckePlaceIngestEnabled,
  isEckeVendorIngestEnabled,
} from './ecke-publish-config.js'

const KEYS = [
  'ECKE_PUBLISH_ENABLED',
  'ECKE_EVENT_INGEST_ENABLED',
  'ECKE_PLACE_INGEST_ENABLED',
  'ECKE_VENDOR_INGEST_ENABLED',
  'ECKE_PUBLISH_ENDPOINT',
  'ECKE_LISTING_ENDPOINT',
  'ECKE_PUBLISH_LISTING_WEBHOOK_URL',
] as const

function saveEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {}
  for (const k of KEYS) snap[k] = process.env[k]
  return snap
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of KEYS) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
}

describe('ecke-publish-config', () => {
  let snap: Record<string, string | undefined>

  beforeEach(() => {
    snap = saveEnv()
    for (const k of KEYS) delete process.env[k]
  })

  afterEach(() => restoreEnv(snap))

  it('ingest flags default false', () => {
    assert.equal(isEckeEventIngestEnabled(), false)
    assert.equal(isEckePlaceIngestEnabled(), false)
    assert.equal(isEckeVendorIngestEnabled(), false)
    assert.equal(isEckeIngestEnabledFor('event'), false)
  })

  it('ingest flags honor truthy env', () => {
    process.env.ECKE_EVENT_INGEST_ENABLED = 'true'
    assert.equal(isEckeEventIngestEnabled(), true)
    process.env.ECKE_PLACE_INGEST_ENABLED = '1'
    assert.equal(isEckePlaceIngestEnabled(), true)
  })

  it('event publish bridge accepts ingest-only config when flag set', () => {
    process.env.ECKE_PUBLISH_ENABLED = 'true'
    process.env.ECKE_EVENT_INGEST_ENABLED = 'true'
    process.env.ECKE_PUBLISH_ENDPOINT = 'https://www.eastcoastkinkevents.com/api/kink-social/ingest'
    process.env.ECKE_PUBLISH_SECRET = 'secret'
    assert.equal(isEckeEventPublishBridgeConfigured(), true)
  })

  it('endpoint helpers read env aliases', () => {
    process.env.ECKE_PUBLISH_ENDPOINT = 'https://ecke.example/ingest'
    process.env.ECKE_LISTING_ENDPOINT = 'https://ecke.example/listing'
    assert.equal(eckePublishIngestEndpoint(), 'https://ecke.example/ingest')
    assert.equal(eckeListingWebhookEndpoint(), 'https://ecke.example/listing')

    delete process.env.ECKE_LISTING_ENDPOINT
    process.env.ECKE_PUBLISH_LISTING_WEBHOOK_URL = 'https://ecke.example/legacy-listing'
    assert.equal(eckeListingWebhookEndpoint(), 'https://ecke.example/legacy-listing')
  })
})
