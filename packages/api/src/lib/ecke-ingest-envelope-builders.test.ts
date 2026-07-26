import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  buildEckeEventIngestEnvelope,
  buildEckeEventIngestEnvelopeIfEnabled,
  buildEckeEventIngestEnvelopeFromRow,
  buildEckePlaceIngestEnvelope,
  buildEckePlaceIngestEnvelopeIfEnabled,
  buildEckeVendorIngestEnvelope,
  buildEckeVendorIngestEnvelopeIfEnabled,
  eckeEventRowToIngestPayload,
  redactPlacePayloadForPrivacy,
} from './ecke-ingest-envelope-builders.js'

const FLAG_KEYS = [
  'ECKE_EVENT_INGEST_ENABLED',
  'ECKE_PLACE_INGEST_ENABLED',
  'ECKE_VENDOR_INGEST_ENABLED',
  'C2K_PUBLIC_WEB_URL',
] as const

function saveEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {}
  for (const k of FLAG_KEYS) snap[k] = process.env[k]
  return snap
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of FLAG_KEYS) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
}

describe('ecke-ingest-envelope-builders', () => {
  let envSnap: Record<string, string | undefined>

  beforeEach(() => {
    envSnap = saveEnv()
    process.env.C2K_PUBLIC_WEB_URL = 'https://kink.social'
  })

  afterEach(() => {
    restoreEnv(envSnap)
  })

  it('buildEckeEventIngestEnvelope includes convention entityType and c2k_source_type', () => {
    const envelope = buildEckeEventIngestEnvelope({
      sourceId: 'conv-1',
      sourceUpdatedAt: '2026-06-01T00:00:00.000Z',
      c2kSourceType: 'convention',
      preferredSlug: 'crucible-con',
      canonicalKinkSocialPath: '/conventions/crucible-con',
      payload: {
        title: 'Crucible Con',
        slug: 'crucible-con',
        shortDescription: 'A convention',
        startDate: '2026-07-01',
        endDate: '2026-07-03',
      },
    })
    assert.equal(envelope.entityType, 'convention')
    assert.equal(envelope.sourceSystem, 'kink.social')
    assert.equal(envelope.preferredSlug, 'crucible-con')
    assert.equal(envelope.canonicalKinkSocialUrl, 'https://kink.social/conventions/crucible-con')
    assert.equal((envelope.payload as { c2k_source_type: string }).c2k_source_type, 'convention')
    assert.equal(envelope.publicSafe, true)
  })

  it('buildEckePlaceIngestEnvelope strips private address when privacyMode is public_summary_only', () => {
    const envelope = buildEckePlaceIngestEnvelope({
      sourceId: 'place-1',
      sourceUpdatedAt: '2026-06-01T00:00:00.000Z',
      preferredSlug: 'the-mark',
      canonicalKinkSocialPath: '/places/the-mark',
      payload: {
        name: 'The Mark',
        slug: 'the-mark',
        placeKind: 'dungeon',
        privacyMode: 'public_summary_only',
        publicLocationSummary: 'Metro DC area',
        publicAddress: '123 Secret St',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    })
    assert.equal(envelope.entityType, 'place')
    assert.equal(envelope.payload.publicAddress, null)
    assert.equal(envelope.payload.publicLocationSummary, 'Metro DC area')
  })

  it('redactPlacePayloadForPrivacy keeps address when public_address_ok', () => {
    const payload = redactPlacePayloadForPrivacy({
      name: 'Club',
      slug: 'club',
      placeKind: 'club',
      privacyMode: 'public_address_ok',
      publicAddress: '1 Main St',
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    assert.equal(payload.publicAddress, '1 Main St')
  })

  it('eckeEventRowToIngestPayload maps convention row and never includes address', () => {
    const row = {
      title: 'Crucible Con',
      slug: 'crucible-con',
      start_date: '2026-07-01',
      end_date: '2026-07-03',
      display_date: '2026-07-01',
      city: 'DC',
      state: 'MD',
      short_description: 'Short',
      long_description: 'Long',
      category: 'Convention',
      logo: 'https://cdn.example/logo.jpg',
      website: 'https://example.com',
      venue: 'Hotel',
      organizer_name: 'CPI',
      status: 'published' as const,
      c2k_source_type: 'convention',
      c2k_source_id: 'conv-1',
      last_synced_at: '2026-06-01T00:00:00.000Z',
      tags: ['convention'],
    }
    const payload = eckeEventRowToIngestPayload(row)
    assert.equal(payload.c2k_source_type, 'convention')
    assert.equal(payload.publicAddress, null)
    const envelope = buildEckeEventIngestEnvelopeFromRow(row, '/conventions/crucible-con')
    assert.equal(envelope.entityType, 'convention')
    assert.equal(envelope.sourceId, 'conv-1')
  })

  it('buildEckeVendorIngestEnvelope shape', () => {
    const envelope = buildEckeVendorIngestEnvelope({
      sourceId: 'vendor-1',
      sourceUpdatedAt: '2026-06-01T00:00:00.000Z',
      preferredSlug: 'flogging-farmers',
      canonicalKinkSocialPath: '/vendors/flogging-farmers',
      payload: {
        displayName: 'Flogging Farmers',
        slug: 'flogging-farmers',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    })
    assert.equal(envelope.entityType, 'vendor')
    assert.equal(envelope.payload.displayName, 'Flogging Farmers')
  })

  it('IfEnabled builders return null unless flag set', () => {
    delete process.env.ECKE_EVENT_INGEST_ENABLED
    delete process.env.ECKE_PLACE_INGEST_ENABLED
    delete process.env.ECKE_VENDOR_INGEST_ENABLED

    assert.equal(
      buildEckeEventIngestEnvelopeIfEnabled({
        sourceId: 'e1',
        sourceUpdatedAt: '2026-06-01T00:00:00.000Z',
        c2kSourceType: 'event',
        preferredSlug: 'munch',
        canonicalKinkSocialPath: '/events/munch',
        payload: {
          title: 'Munch',
          slug: 'munch',
          shortDescription: 'Social',
          startDate: '2026-08-01',
          endDate: '2026-08-01',
        },
      }),
      null,
    )

    process.env.ECKE_EVENT_INGEST_ENABLED = 'true'
    assert.ok(buildEckeEventIngestEnvelopeIfEnabled({
      sourceId: 'e1',
      sourceUpdatedAt: '2026-06-01T00:00:00.000Z',
      c2kSourceType: 'event',
      preferredSlug: 'munch',
      canonicalKinkSocialPath: '/events/munch',
      payload: {
        title: 'Munch',
        slug: 'munch',
        shortDescription: 'Social',
        startDate: '2026-08-01',
        endDate: '2026-08-01',
      },
    }))
    assert.equal(buildEckePlaceIngestEnvelopeIfEnabled({
      sourceId: 'p1',
      sourceUpdatedAt: '2026-06-01T00:00:00.000Z',
      preferredSlug: 'mark',
      canonicalKinkSocialPath: '/places/mark',
      payload: {
        name: 'Mark',
        slug: 'mark',
        placeKind: 'venue',
        privacyMode: 'public_summary_only',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    }), null)
    assert.equal(buildEckeVendorIngestEnvelopeIfEnabled({
      sourceId: 'v1',
      sourceUpdatedAt: '2026-06-01T00:00:00.000Z',
      preferredSlug: 'shop',
      canonicalKinkSocialPath: '/vendors/shop',
      payload: { displayName: 'Shop', slug: 'shop', updatedAt: '2026-06-01T00:00:00.000Z' },
    }), null)
  })
})
