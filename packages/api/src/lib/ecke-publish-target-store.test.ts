import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashEckePayload, buildGroupListingPayload } from './ecke-publish-payload.js'
import { deriveTargetDisplayStatus } from './ecke-publish-target-store.js'

describe('ecke-publish-target-store stale detection', () => {
  it('marks published row stale when content hash changes', () => {
    const payloadA = buildGroupListingPayload({
      slug: 'demo',
      name: 'Demo',
      description: 'Original',
      visibility: 'public',
    })
    const payloadB = buildGroupListingPayload({
      slug: 'demo',
      name: 'Demo',
      description: 'Updated description',
      visibility: 'public',
    })
    const hashA = hashEckePayload(payloadA)
    const hashB = hashEckePayload(payloadB)
    assert.notEqual(hashA, hashB)

    const status = deriveTargetDisplayStatus(hashB, {
      id: '00000000-0000-4000-8000-000000000001',
      scopeType: 'group',
      organizationId: null,
      conventionId: null,
      groupId: '00000000-0000-4000-8000-000000000002',
      educationArticleId: null,
      vendorProfileId: null,
      eventId: null,
      targetKind: 'ecke_listing',
      externalSlug: 'demo',
      status: 'published',
      contentHash: hashB,
      publishedContentHash: hashA,
      lastPreviewAt: new Date('2026-06-01T00:00:00.000Z'),
      lastPublishedAt: new Date('2026-06-01T00:00:00.000Z'),
      lastAttemptAt: new Date('2026-06-01T00:00:00.000Z'),
      lastError: null,
      publishedByUserId: null,
      eckePublicUrl: null,
      eckeRecordId: null,
      unpublishedAt: null,
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    })
    assert.equal(status, 'stale')
  })

  it('returns unpublished when row status is unpublished', () => {
    const status = deriveTargetDisplayStatus('abc', {
      id: '00000000-0000-4000-8000-000000000001',
      scopeType: 'group',
      organizationId: null,
      conventionId: null,
      groupId: '00000000-0000-4000-8000-000000000002',
      educationArticleId: null,
      vendorProfileId: null,
      eventId: null,
      targetKind: 'ecke_listing',
      externalSlug: 'demo',
      status: 'unpublished',
      contentHash: 'abc',
      publishedContentHash: null,
      lastPreviewAt: null,
      lastPublishedAt: null,
      lastAttemptAt: null,
      lastError: null,
      publishedByUserId: null,
      eckePublicUrl: null,
      eckeRecordId: null,
      unpublishedAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    })
    assert.equal(status, 'unpublished')
  })
})
