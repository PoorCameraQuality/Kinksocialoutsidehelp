import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildGroupListingPayload,
  buildStandaloneEventListingPayload,
} from './ecke-publish-payload.js'
import {
  getEventOmittedFields,
  getGroupOmittedFields,
  isGroupListingEntityEligible,
  resolvePublicLocationForEcke,
} from './ecke-redaction.js'
import {
  buildGroupListingPlainFields,
  buildGroupListingPublishContext,
  canViewerManageGroupEckePublish,
  computeEventListingActions,
  computeGroupListingActions,
  payloadExcludesPrivateGroupFields,
  PASS3_UNSUPPORTED_ERROR,
  PASS4_UNSUPPORTED_ERROR,
  PASS5_UNSUPPORTED_ERROR,
} from './ecke-publish-service.js'
import { getRegistryEntry, PASS2_DISABLED_ACTIONS } from './ecke-publish-registry.js'
import { isStandaloneEventEckeEligible } from './ecke-publish-payload.js'
import { getEventDeferredFields } from './ecke-redaction.js'

describe('ecke-redaction group listing eligibility', () => {
  it('private group is not eligible', () => {
    const result = isGroupListingEntityEligible({ visibility: 'private' })
    assert.equal(result.eligible, false)
    assert.match(result.reason ?? '', /public groups/i)
  })

  it('public group is eligible', () => {
    const result = isGroupListingEntityEligible({ visibility: 'public' })
    assert.equal(result.eligible, true)
  })

  it('omitted fields include member list and hidden membership', () => {
    const labels = getGroupOmittedFields().map((f) => f.label)
    assert.ok(labels.some((l) => /member list/i.test(l)))
    assert.ok(labels.some((l) => /hidden membership/i.test(l)))
  })
})

describe('ecke-redaction event location preview', () => {
  it('private location omits exact address from public location', () => {
    const resolved = resolvePublicLocationForEcke({
      location: '123 Secret St, Baltimore, MD',
      publicLocationSummary: 'Baltimore metro',
      locationVisibility: 'rsvp',
    })
    assert.equal(resolved.publicLocation, 'Baltimore metro')
    assert.equal(resolved.omittedExactLocation, true)
  })

  it('event listing payload uses summary only when location is not public', () => {
    const payload = buildStandaloneEventListingPayload({
      eventId: '11111111-1111-4111-8111-111111111111',
      title: 'Munch',
      startsAt: new Date('2026-07-01T18:00:00.000Z'),
      location: '123 Secret St',
      publicLocationSummary: 'Downtown Baltimore',
      locationVisibility: 'approved',
      visibility: 'public',
    })
    assert.equal(payload.location, 'Downtown Baltimore')
    assert.notEqual(payload.location, '123 Secret St')
  })

  it('event omitted fields mention exact private location for non-public visibility', () => {
    const omitted = getEventOmittedFields('rsvp').map((f) => f.label)
    assert.ok(omitted.some((l) => /exact private location/i.test(l)))
  })
})

describe('ecke-publish-service preview helpers', () => {
  it('builds plain-English group listing preview fields', () => {
    const payload = buildGroupListingPayload({
      slug: 'rope-social',
      name: 'Rope Social',
      description: 'Weekly munch',
      visibility: 'public',
      orgSlug: 'demo-org',
      orgDisplayName: 'Demo Org',
    })
    const entry = getRegistryEntry('group_listing')!
    const fields = buildGroupListingPlainFields(payload, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', entry)
    assert.ok(fields.some((f) => f.label === 'Title' && f.value === 'Rope Social'))
    assert.ok(fields.some((f) => f.label === 'Slug' && f.value === 'rope-social'))
    assert.ok(fields.some((f) => f.label.includes('CTA')))
  })

  it('Pass 2 actions disable publish/sync/unpublish', () => {
    assert.deepEqual(PASS2_DISABLED_ACTIONS, {
      preview: true,
      publish: false,
      sync: false,
      unpublish: false,
    })
  })

  it('group admin can manage ECKE preview; normal member cannot', () => {
    assert.equal(canViewerManageGroupEckePublish('admin', false), true)
    assert.equal(canViewerManageGroupEckePublish('owner', false), true)
    assert.equal(canViewerManageGroupEckePublish('member', false), false)
    assert.equal(canViewerManageGroupEckePublish(null, false), false)
    assert.equal(canViewerManageGroupEckePublish('member', true), true)
  })

  it('computeGroupListingActions enables publish for never/unpublished and sync for stale', () => {
    assert.deepEqual(
      computeGroupListingActions({ eligible: true, status: 'never', bridgeConfigured: true }),
      { preview: true, publish: true, sync: false, unpublish: false },
    )
    assert.equal(
      computeGroupListingActions({ eligible: true, status: 'stale', bridgeConfigured: true }).sync,
      true,
    )
    assert.equal(
      computeGroupListingActions({ eligible: true, status: 'stale', bridgeConfigured: true }).unpublish,
      true,
    )
    assert.equal(
      computeGroupListingActions({ eligible: false, status: 'never', bridgeConfigured: true }).publish,
      false,
    )
  })

  it('buildGroupListingPublishContext ignores client and uses server group fields', () => {
    const ctx = buildGroupListingPublishContext({
      group: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        slug: 'rope-social',
        name: 'Rope Social',
        description: 'Public only',
        visibility: 'public',
        organizationId: null,
        disbandedAt: null,
      },
      org: null,
      canManage: true,
      groupRole: 'admin',
    })
    assert.equal(ctx.listingPayload.title, 'Rope Social')
    assert.equal(ctx.eligibility.eligible, true)
    assert.equal(payloadExcludesPrivateGroupFields(ctx.listingPayload), true)
    assert.equal(JSON.stringify(ctx.listingPayload).includes('member'), false)
  })

  it('hidden group is not eligible in publish context', () => {
    const ctx = buildGroupListingPublishContext({
      group: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        slug: 'secret',
        name: 'Secret',
        description: 'Hidden',
        visibility: 'private',
        organizationId: null,
        disbandedAt: null,
      },
      org: null,
      canManage: true,
      groupRole: 'admin',
    })
    assert.equal(ctx.eligibility.eligible, false)
    assert.equal(ctx.listingPayload.visibility, 'hidden')
  })

  it('Pass 3 unsupported error is defined for non-group_listing writes', () => {
    assert.equal(PASS3_UNSUPPORTED_ERROR.errorCode, 'unsupported_in_pass_3')
  })

  it('Pass 5 unsupported error points operators to the registry for unsupported kinds', () => {
    assert.equal(PASS5_UNSUPPORTED_ERROR.errorCode, 'unsupported_in_pass_5')
    assert.match(PASS5_UNSUPPORTED_ERROR.message, /registry/i)
    assert.match(PASS5_UNSUPPORTED_ERROR.message, /unified ECKE control plane/i)
  })

  it('Pass 4 unsupported error message remains for historical reference', () => {
    assert.equal(PASS4_UNSUPPORTED_ERROR.errorCode, 'unsupported_in_pass_4')
  })

  it('computeEventListingActions mirrors group listing action rules', () => {
    assert.deepEqual(
      computeEventListingActions({ eligible: true, status: 'never', bridgeConfigured: true }),
      { preview: true, publish: true, sync: false, unpublish: false },
    )
  })

  it('convention anchor event is not eligible for standalone event_listing', () => {
    const result = isStandaloneEventEckeEligible({ visibility: 'public', isConventionAnchor: true })
    assert.equal(result.eligible, false)
    assert.match(result.reason ?? '', /convention/i)
  })

  it('non-public event is not eligible for event_listing', () => {
    const result = isStandaloneEventEckeEligible({ visibility: 'private' })
    assert.equal(result.eligible, false)
  })

  it('public location may include exact address when locationVisibility is public', () => {
    const payload = buildStandaloneEventListingPayload({
      eventId: '11111111-1111-4111-8111-111111111111',
      title: 'Munch',
      startsAt: new Date('2026-07-01T18:00:00.000Z'),
      location: '123 Main St, Baltimore, MD',
      publicLocationSummary: null,
      locationVisibility: 'public',
      visibility: 'public',
    })
    assert.equal(payload.location, '123 Main St, Baltimore, MD')
  })

  it('event deferred fields catalog ECKE capability gaps', () => {
    const labels = getEventDeferredFields().map((f) => f.label)
    assert.ok(labels.some((l) => /schedule/i.test(l)))
    assert.ok(labels.some((l) => /map pins/i.test(l)))
  })
})

describe('ecke-publish-control transport separation', () => {
  it('control routes delegate writes to service, not ECKE client directly', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../routes/ecke-publish-control-routes.ts', import.meta.url), 'utf8'),
    )
    assert.doesNotMatch(src, /publishListingToEcke|unpublishListingToEcke/)
    assert.match(src, /publishEckeSource/)
    assert.match(src, /syncEckeSource/)
    assert.match(src, /unpublishEckeSource/)
  })

  it('preview paths in service do not call publishListingToEcke directly', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8'),
    )
    const previewBlock = src.slice(src.indexOf('async function buildGroupListingPreview'), src.indexOf('async function buildEventListingPreview'))
    assert.doesNotMatch(previewBlock, /publishListingToEcke|unpublishListingToEcke/)
    assert.match(src, /executeGroupListingPublish/)
    assert.match(src, /executeEventListingPublish/)
    assert.match(src, /publishListingToEcke/)
  })
})
