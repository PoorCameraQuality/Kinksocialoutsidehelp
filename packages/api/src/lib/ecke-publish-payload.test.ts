import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildConventionListingPayload,
  buildDancecardEventPayload,
  buildGroupListingPayload,
  buildOrgListingPayload,
  buildStandaloneEventListingPayload,
  derivePublishStatus,
  hashEckePayload,
  isDancecardPublishEnabled,
  isStandaloneEventEckeEligible,
  resolveDancecardSlug,
  resolveEckeListingSlug,
  resolveStandaloneEventEckeSlug,
  resolveStandaloneEventPublicLocation,
} from './ecke-publish-payload.js'
import { buildEckeEventRowFromListing, buildEckeEventRowFromStandaloneEvent } from './ecke-directory-sync.js'
import { eckePayloadContainsPrivateAppUrls } from '@c2k/shared'

describe('resolveEckeListingSlug', () => {
  it('uses convention slug by default', () => {
    assert.equal(resolveEckeListingSlug('My-Con'), 'my-con')
  })

  it('prefers settings override', () => {
    assert.equal(resolveEckeListingSlug('my-con', { eckeListingSlug: 'Custom-Slug' }), 'custom-slug')
  })
})

describe('isDancecardPublishEnabled', () => {
  it('defaults to enabled', () => {
    assert.equal(isDancecardPublishEnabled(undefined), true)
    assert.equal(isDancecardPublishEnabled({}), true)
  })

  it('respects explicit false', () => {
    assert.equal(isDancecardPublishEnabled({ dancecardEnabled: false }), false)
  })
})

describe('buildOrgListingPayload', () => {
  it('marks non-public orgs hidden', () => {
    const p = buildOrgListingPayload({
      slug: 'Demo-Org',
      displayName: 'Demo Org',
      bio: 'Hello',
      visibility: 'MEMBERS',
    })
    assert.equal(p.visibility, 'hidden')
    assert.equal(p.slug, 'demo-org')
  })
})

describe('buildGroupListingPayload', () => {
  it('maps group to listing with parent org', () => {
    const p = buildGroupListingPayload({
      slug: 'Rope-Social',
      name: 'Rope Social',
      description: 'Weekly munch',
      visibility: 'public',
      orgSlug: 'demo-org',
      orgDisplayName: 'Demo Org',
    })
    assert.equal(p.slug, 'rope-social')
    assert.equal(p.title, 'Rope Social')
    assert.equal(p.orgSlug, 'demo-org')
    assert.equal(p.visibility, 'public')
  })
})

describe('buildConventionListingPayload', () => {
  it('prefers anchor event title and dates', () => {
    const starts = new Date('2026-06-01T12:00:00.000Z')
    const ends = new Date('2026-06-03T12:00:00.000Z')
    const p = buildConventionListingPayload({
      conventionSlug: 'fest',
      conventionName: 'Fest Name',
      startsAt: new Date('2026-05-01T00:00:00.000Z'),
      endsAt: new Date('2026-05-02T00:00:00.000Z'),
      anchor: {
        title: 'Anchor Title',
        description: 'Anchor desc',
        startsAt: starts,
        endsAt: ends,
        location: 'Hotel',
        publicLocationSummary: 'Public hotel',
        imageUrl: 'https://example.com/img.jpg',
        visibility: 'public',
      },
    })
    assert.equal(p.title, 'Anchor Title')
    assert.equal(p.startsAt, starts.toISOString())
    assert.equal(p.location, 'Public hotel')
  })

  it('includes memberActionUrl for ECKE registration CTA', () => {
    const p = buildConventionListingPayload({
      conventionSlug: 'my-con',
      conventionName: 'My Con',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-03T00:00:00.000Z'),
    })
    assert.match(p.memberActionUrl ?? '', /\/conventions\/my-con\/register$/)
  })
})

describe('buildDancecardEventPayload', () => {
  it('maps slots to dancecard shape', () => {
    const p = buildDancecardEventPayload({
      conventionSlug: 'paf26',
      conventionName: 'PAF',
      timezone: 'America/New_York',
      startsAt: new Date('2026-05-01T00:00:00.000Z'),
      endsAt: new Date('2026-05-04T00:00:00.000Z'),
      orgDisplayName: 'Demo Org',
      orgSlug: 'demo-org',
      slots: [
        {
          id: 'slot-uuid-1',
          startsAt: new Date('2026-05-01T14:00:00.000Z'),
          endsAt: new Date('2026-05-01T15:00:00.000Z'),
          title: 'Rope 101',
          trackLabel: 'Classes',
          roomLabel: 'Ballroom A',
          sortOrder: 0,
        },
      ],
    })
    assert.equal(p.slug, 'paf26')
    assert.equal(p.slots.length, 1)
    assert.equal(p.slots[0].externalKey, 'slot-uuid-1')
    assert.equal(p.slots[0].room, 'Ballroom A')
    assert.equal(p.staffShifts.length, 0)
    assert.equal(p.locations.length, 0)
  })

  it('maps locations and locationId on slots', () => {
    const p = buildDancecardEventPayload({
      conventionSlug: 'paf26',
      conventionName: 'PAF',
      timezone: 'America/New_York',
      startsAt: new Date('2026-05-01T00:00:00.000Z'),
      endsAt: new Date('2026-05-04T00:00:00.000Z'),
      locations: [
        {
          id: 'loc-1',
          name: 'Ballroom A',
          shortName: 'A',
          capacity: 100,
          sortOrder: 0,
          parentId: null,
        },
      ],
      slots: [
        {
          id: 'slot-uuid-1',
          startsAt: new Date('2026-05-01T14:00:00.000Z'),
          endsAt: new Date('2026-05-01T15:00:00.000Z'),
          title: 'Rope 101',
          trackLabel: 'Classes',
          locationId: 'loc-1',
          locationName: 'Ballroom A',
          sortOrder: 0,
        },
      ],
    })
    assert.equal(p.locations.length, 1)
    assert.equal(p.locations[0].externalKey, 'loc-1')
    assert.equal(p.slots[0].locationId, 'loc-1')
    assert.equal(p.slots[0].room, 'Ballroom A')
  })

  it('maps volunteer shifts to dancecard staff shape', () => {
    const p = buildDancecardEventPayload({
      conventionSlug: 'paf26',
      conventionName: 'PAF',
      timezone: 'America/New_York',
      startsAt: new Date('2026-05-01T00:00:00.000Z'),
      endsAt: new Date('2026-05-04T00:00:00.000Z'),
      slots: [],
      volunteerShifts: [
        {
          id: 'shift-uuid-1',
          title: 'Jordan | Registration',
          startsAt: new Date('2026-05-01T08:00:00.000Z'),
          endsAt: new Date('2026-05-01T12:00:00.000Z'),
          sortOrder: 1,
        },
      ],
    })
    assert.equal(p.staffShifts.length, 1)
    assert.equal(p.staffShifts[0].externalKey, 'shift-uuid-1')
    assert.equal(p.staffShifts[0].personName, 'Jordan')
    assert.equal(p.staffShifts[0].role, 'Registration')
  })
})

describe('derivePublishStatus', () => {
  it('returns draft when never published', () => {
    assert.equal(derivePublishStatus('abc', null, null), 'draft')
  })

  it('returns stale when hash differs', () => {
    assert.equal(derivePublishStatus('new', 'old', new Date()), 'stale')
  })

  it('returns published when hash matches', () => {
    assert.equal(derivePublishStatus('same', 'same', new Date()), 'published')
  })
})

describe('hashEckePayload', () => {
  it('is stable for same object', () => {
    const a = buildOrgListingPayload({ slug: 'x', displayName: 'X', visibility: 'PUBLIC' })
    assert.equal(hashEckePayload(a), hashEckePayload(a))
  })
})

describe('resolveDancecardSlug', () => {
  it('uses settings dancecardSlug when set', () => {
    assert.equal(resolveDancecardSlug('fest', { dancecardSlug: 'custom-dc' }), 'custom-dc')
  })
})

describe('standalone event ECKE publish', () => {
  const eventId = '11111111-1111-4111-8111-111111111111'
  const startsAt = new Date('2026-07-01T18:00:00.000Z')

  it('blocks private events', () => {
    const eligibility = isStandaloneEventEckeEligible({ visibility: 'private' })
    assert.equal(eligibility.eligible, false)
  })

  it('blocks convention anchor events', () => {
    const eligibility = isStandaloneEventEckeEligible({ visibility: 'public', isConventionAnchor: true })
    assert.equal(eligibility.eligible, false)
  })

  it('redacts private address unless location is public', () => {
    assert.equal(
      resolveStandaloneEventPublicLocation({
        location: '123 Secret St, Philadelphia, PA',
        publicLocationSummary: 'Center City',
        locationVisibility: 'rsvp',
      }),
      'Center City',
    )
    assert.equal(
      resolveStandaloneEventPublicLocation({
        location: '123 Main St, Philadelphia, PA',
        locationVisibility: 'public',
      }),
      '123 Main St, Philadelphia, PA',
    )
  })

  it('builds deterministic ECKE slug', () => {
    const slug = resolveStandaloneEventEckeSlug('Rope Munch', eventId)
    assert.match(slug, /^rope-munch-c2k-11111111$/)
  })

  it('standalone event row omits kink.social website and attendee fields', () => {
    const listing = buildStandaloneEventListingPayload({
      eventId,
      title: 'Rope Munch',
      description: 'Weekly social',
      startsAt,
      location: '123 Secret St',
      publicLocationSummary: 'Center City',
      locationVisibility: 'rsvp',
      visibility: 'public',
    })
    const row = buildEckeEventRowFromStandaloneEvent(listing, eventId, { category: 'Munch', tags: ['rope'] })
    assert.equal(row.c2k_source_type, 'event')
    assert.equal(row.c2k_source_id, eventId)
    assert.equal(row.website, '')
    assert.equal(eckePayloadContainsPrivateAppUrls(row), false)
    const serialized = JSON.stringify(row)
    assert.doesNotMatch(serialized, /attendee/i)
    assert.doesNotMatch(serialized, /123 Secret St/)
    assert.match(serialized, /Center City/)
  })

  it('convention event row omits kink.social URLs from Supabase payload', () => {
    const listing = buildConventionListingPayload({
      conventionSlug: 'fest',
      conventionName: 'Fest',
      startsAt,
      endsAt: startsAt,
    })
    const row = buildEckeEventRowFromListing(listing, '22222222-2222-4222-8222-222222222222', 'convention')
    assert.equal(row.website, '')
    assert.equal(eckePayloadContainsPrivateAppUrls(row), false)
  })
})
