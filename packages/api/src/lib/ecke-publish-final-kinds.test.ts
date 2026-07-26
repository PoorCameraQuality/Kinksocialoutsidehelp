import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildOrgListingPublishContext,
  buildOrgDungeonPublishContext,
  getOrgListingIneligibilityReason,
  getDungeonProfileIneligibilityReason,
  redactDancecardPayloadForPreview,
} from './ecke-publish-org-convention.js'
import {
  FINAL_SUPPORTED_WRITE_KINDS,
  isFinalSupportedWriteKind,
  payloadExcludesPrivateOrgFields,
  payloadExcludesPrivateDancecardFields,
} from './ecke-publish-final-kinds.js'
import { buildDancecardEventPayload } from './ecke-publish-payload.js'

const baseOrg = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  slug: 'test-org',
  displayName: 'Test Org',
  bio: 'Public bio',
  logoUrl: null,
  visibility: 'PUBLIC',
  featureFlags: { listingKind: 'dungeon', eckeDungeonListing: true },
  externalSiteUrl: 'https://example.com',
}

describe('final ECKE supported kinds', () => {
  it('includes org, dungeon, convention, and dancecard kinds', () => {
    assert.ok(isFinalSupportedWriteKind('organization_listing'))
    assert.ok(isFinalSupportedWriteKind('dungeon_profile'))
    assert.ok(isFinalSupportedWriteKind('convention_listing'))
    assert.ok(isFinalSupportedWriteKind('dancecard_event'))
    assert.ok(FINAL_SUPPORTED_WRITE_KINDS.has('group_listing'))
    assert.ok(FINAL_SUPPORTED_WRITE_KINDS.has('vendor_profile'))
    assert.ok(isFinalSupportedWriteKind('presenter_profile'))
    assert.ok(isFinalSupportedWriteKind('venue_profile'))
    assert.ok(isFinalSupportedWriteKind('convention_event_anchor'))
  })
})

describe('organization listing eligibility', () => {
  it('public org is eligible', () => {
    assert.equal(getOrgListingIneligibilityReason(baseOrg), null)
  })

  it('private org is ineligible', () => {
    assert.match(getOrgListingIneligibilityReason({ visibility: 'PRIVATE' }), /public/i)
  })
})

describe('dungeon profile eligibility', () => {
  it('dungeon-flagged public org is eligible', () => {
    assert.equal(getDungeonProfileIneligibilityReason(baseOrg), null)
  })

  it('non-dungeon org is ineligible', () => {
    assert.match(
      getDungeonProfileIneligibilityReason({ ...baseOrg, featureFlags: {} }),
      /not configured/i,
    )
  })
})

describe('org publish contexts', () => {
  it('builds org listing payload server-side', () => {
    const ctx = buildOrgListingPublishContext(baseOrg)
    assert.equal(ctx.eligibility.eligible, true)
    assert.ok(ctx.listingPayload.title)
    assert.equal(payloadExcludesPrivateOrgFields(ctx.listingPayload as Record<string, unknown>), true)
  })

  it('builds dungeon payload without member roster', () => {
    const ctx = buildOrgDungeonPublishContext(baseOrg)
    assert.equal(ctx.eligibility.eligible, true)
    const serialized = JSON.stringify(ctx.payload).toLowerCase()
    assert.equal(serialized.includes('memberlist'), false)
  })
})

describe('dancecard preview redaction', () => {
  it('redacts raw access codes in preview payload', () => {
    const payload = buildDancecardEventPayload({
      conventionSlug: 'test-con',
      conventionName: 'Test Con',
      timezone: 'America/New_York',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-03T00:00:00.000Z'),
      settings: { staffAccessCode: 'SECRET123', registrationAccessCode: 'REG456' },
      slots: [],
      locations: [],
      volunteerShifts: [],
    })
    const redacted = redactDancecardPayloadForPreview(payload)
    assert.equal(redacted.staffAccessCode, '[configured]')
    assert.equal(redacted.registrationAccessCode, '[configured]')
    assert.equal(payloadExcludesPrivateDancecardFields(redacted as unknown as Record<string, unknown>), true)
  })
})

describe('regression: prior pass kinds still supported', () => {
  it('service wires final kinds module', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /buildOrganizationListingPreview/)
    assert.match(src, /buildConventionListingPreview/)
    assert.match(src, /buildDancecardEventPreview/)
    assert.match(src, /executeOrganizationListingPublish/)
  })
})
