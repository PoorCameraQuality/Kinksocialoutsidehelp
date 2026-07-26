import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildEckeArticleRow,
  buildEckeEventRowFromListing,
  buildEckeVendorRow,
  isOrgDungeonListing,
} from './ecke-directory-sync.js'
import type { EckeListingPayload } from './ecke-publish-payload.js'

describe('ecke-directory-sync', () => {
  it('buildEckeEventRowFromListing maps convention listing to events row', () => {
    const listing: EckeListingPayload = {
      slug: 'test-con',
      title: 'Test Con',
      description: 'A festival',
      startsAt: '2026-06-01T12:00:00.000Z',
      endsAt: '2026-06-03T12:00:00.000Z',
      location: 'Baltimore, MD',
      visibility: 'public',
    }
    const row = buildEckeEventRowFromListing(listing, '11111111-1111-1111-1111-111111111111', 'convention')
    assert.equal(row.slug, 'test-con')
    assert.equal(row.c2k_source_id, '11111111-1111-1111-1111-111111111111')
    assert.equal(row.status, 'published')
    assert.equal(row.state, 'MD')
  })

  it('isOrgDungeonListing reads feature flags', () => {
    assert.equal(isOrgDungeonListing({ listingKind: 'dungeon' }), true)
    assert.equal(isOrgDungeonListing({ eckeDungeonListing: true }), true)
    assert.equal(isOrgDungeonListing({}), false)
  })

  it('buildEckeVendorRow sets c2k source fields', () => {
    const row = buildEckeVendorRow({
      id: '22222222-2222-2222-2222-222222222222',
      slug: 'rope-co',
      displayName: 'Rope Co',
      bio: 'Handmade rope',
      visibility: 'PUBLIC',
    })
    assert.equal(row.c2k_source_type, 'vendor_profile')
    assert.equal(row.slug, 'rope-co')
  })

  it('buildEckeArticleRow requires published status in caller', () => {
    const row = buildEckeArticleRow({
      id: '33333333-3333-3333-3333-333333333333',
      slug: 'consent-101',
      title: 'Consent 101',
      bodyHtml: '<p>Hello</p>',
      authorDisplayName: 'Alex',
      publicationStatus: 'PUBLISHED',
    })
    assert.equal(row.status, 'published')
    assert.equal(row.c2k_source_type, 'education_article')
  })

  it('buildEckeEventRowFromListing strips kink.social from descriptions', () => {
    const listing: EckeListingPayload = {
      slug: 'test-con',
      title: 'Test Con',
      description: 'Details at https://kink.social/events/abc only',
      visibility: 'public',
    }
    const row = buildEckeEventRowFromListing(listing, '11111111-1111-1111-1111-111111111111', 'convention')
    assert.doesNotMatch(row.long_description, /kink\.social/i)
    assert.doesNotMatch(row.short_description, /kink\.social/i)
  })

  it('buildEckeEventRowFromListing maps organizer website/venue/highlights onto the events row', () => {
    const listing: EckeListingPayload = {
      slug: 'test-con',
      title: 'Test Con',
      visibility: 'public',
      website: 'https://example.com/fest',
      venue: 'Hyatt Regency Baltimore',
      features: ['100+ classes', 'Dungeon open late', 'Vendor hall'],
    }
    const row = buildEckeEventRowFromListing(listing, '11111111-1111-1111-1111-111111111111', 'convention')
    assert.equal(row.website, 'https://example.com/fest')
    assert.equal(row.venue, 'Hyatt Regency Baltimore')
    assert.deepEqual(JSON.parse(row.features as string), ['100+ classes', 'Dungeon open late', 'Vendor hall'])
  })

  it('buildEckeEventRowFromListing leaves website empty and features null when not provided', () => {
    const listing: EckeListingPayload = {
      slug: 'test-con',
      title: 'Test Con',
      visibility: 'public',
      memberActionUrl: 'https://kink.social/conventions/my-con/register',
    }
    const row = buildEckeEventRowFromListing(listing, '11111111-1111-1111-1111-111111111111', 'convention')
    assert.equal(row.website, '')
    assert.equal(row.features ?? null, null)
    assert.equal(row.venue ?? null, null)
  })
})
