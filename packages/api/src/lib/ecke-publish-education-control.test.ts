import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { EducationArticlePublishRow } from './ecke-public-publish.js'
import { buildEckePublicEnvelope, getEducationArticleIneligibilityReason } from './ecke-public-publish.js'
import { hashEckePayload } from './ecke-publish-payload.js'
import { resolveEckePublicEducationUrl } from './ecke-publish-client.js'
import {
  getEducationDeferredFields,
  getEducationOmittedFields,
} from './ecke-redaction.js'
import { getRegistryEntry } from './ecke-publish-registry.js'
import { deriveTargetDisplayStatus } from './ecke-publish-target-store.js'
import {
  buildEducationArticlePlainFields,
  buildEducationArticlePreviewFieldSets,
  buildEducationArticlePublishContext,
  canViewerManageEducationArticleEckePublish,
  computeEducationArticleActions,
  payloadExcludesPrivateEducationFields,
  PASS5_UNSUPPORTED_ERROR,
} from './ecke-publish-service.js'

const AUTHOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function baseArticle(overrides: Partial<EducationArticlePublishRow> = {}): EducationArticlePublishRow {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    slug: 'safety-basics',
    title: 'Safety Basics',
    excerpt: 'Intro to safety',
    bodyHtml: '<p>Public sanitized body</p>',
    categories: ['Safety'],
    contentWarnings: [],
    difficulty: 'Beginner',
    heroImageUrl: null,
    readingMinutes: 5,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    visibility: 'PUBLIC',
    publicationStatus: 'PUBLISHED',
    eckePublish: true,
    authorUserId: AUTHOR_ID,
    organizationId: null,
    presenterProfileUserId: null,
    ...overrides,
  }
}

const authorContext = {
  displayName: 'Educator One',
  username: 'educator1',
  presenterUsername: null,
  presenterDirectoryVisibility: null,
}

describe('ecke-publish-registry education_article', () => {
  it('marks education_article active_existing with ingest_api', () => {
    const entry = getRegistryEntry('education_article')!
    assert.equal(entry.supportState, 'active_existing')
    assert.equal(entry.currentTransport, 'ingest_api')
    assert.equal(entry.visibleInUserDashboard, true)
    assert.ok(entry.eckeSurfacesAffected.some((s) => /Education article page/i.test(s)))
  })
})

describe('education article eligibility', () => {
  it('public published article with opt-in is eligible', () => {
    assert.equal(getEducationArticleIneligibilityReason(baseArticle()), null)
  })

  it('draft article is ineligible for publish', () => {
    const reason = getEducationArticleIneligibilityReason(
      baseArticle({ publicationStatus: 'DRAFT' }),
    )
    assert.match(reason ?? '', /published/i)
  })

  it('member-only article cannot publish', () => {
    const reason = getEducationArticleIneligibilityReason(baseArticle({ visibility: 'MEMBERS' }))
    assert.match(reason ?? '', /member-only/i)
  })

  it('connection-only article cannot publish', () => {
    const reason = getEducationArticleIneligibilityReason(baseArticle({ visibility: 'CONNECTIONS' }))
    assert.match(reason ?? '', /connection-only/i)
  })

  it('non-author cannot manage ECKE publish', () => {
    assert.equal(canViewerManageEducationArticleEckePublish(baseArticle(), OTHER_USER), false)
  })

  it('author can manage ECKE publish', () => {
    assert.equal(canViewerManageEducationArticleEckePublish(baseArticle(), AUTHOR_ID), true)
  })
})

describe('education article preview payload', () => {
  it('builds server-side payload and excludes private author email', async () => {
    const ctx = await buildEducationArticlePublishContext({
      article: baseArticle(),
      author: { ...authorContext, displayName: 'Educator One' },
      canManage: true,
    })
    assert.equal(ctx.eligibility.eligible, true)
    assert.equal('email' in (ctx.payload as Record<string, unknown>), false)
    assert.equal(payloadExcludesPrivateEducationFields(ctx.payload as Record<string, unknown>), true)
    assert.match(ctx.payload.bodyHtml, /Public sanitized body/)
  })

  it('draft preview context is ineligible but still builds payload', async () => {
    const ctx = await buildEducationArticlePublishContext({
      article: baseArticle({ publicationStatus: 'DRAFT' }),
      author: authorContext,
      canManage: true,
    })
    assert.equal(ctx.eligibility.eligible, false)
    assert.ok(ctx.payload.title)
  })

  it('computeEducationArticleActions disables publish for ineligible draft', () => {
    const actions = computeEducationArticleActions({
      eligible: false,
      status: 'never',
      bridgeConfigured: true,
    })
    assert.equal(actions.preview, true)
    assert.equal(actions.publish, false)
  })

  it('computeEducationArticleActions enables sync when stale', () => {
    const actions = computeEducationArticleActions({
      eligible: true,
      status: 'stale',
      bridgeConfigured: true,
    })
    assert.equal(actions.sync, true)
    assert.equal(actions.unpublish, true)
  })

  it('plain fields include sanitized public body and canonical URL', async () => {
    const ctx = await buildEducationArticlePublishContext({
      article: baseArticle(),
      author: authorContext,
      canManage: true,
    })
    const entry = getRegistryEntry('education_article')!
    const fields = buildEducationArticlePlainFields(ctx, entry)
    assert.ok(fields.some((f) => f.label === 'Title' && f.value === 'Safety Basics'))
    assert.ok(fields.some((f) => f.label.includes('Public body')))
    assert.ok(fields.some((f) => f.label.includes('Canonical kink.social URL')))
  })

  it('defers hero image when kink.social proxy URL cannot reach ECKE', async () => {
    const ctx = await buildEducationArticlePublishContext({
      article: baseArticle({
        heroImageUrl: 'https://kink.social/api/v1/media/assets/11111111-1111-4111-8111-111111111111/content',
      }),
      author: authorContext,
      canManage: true,
    })
    const entry = getRegistryEntry('education_article')!
    const { wouldPublish, wouldPublishDeferred } = buildEducationArticlePreviewFieldSets(ctx, entry)
    assert.equal(
      wouldPublish.some((field) => field.label.includes('Hero image')),
      false,
    )
    assert.ok(wouldPublishDeferred.some((field) => field.label === 'Hero image'))
  })

  it('omitted fields catalog covers private email and internal notes', () => {
    const labels = getEducationOmittedFields().map((f) => f.label)
    assert.ok(labels.some((l) => /private email/i.test(l)))
    assert.ok(labels.some((l) => /internal notes/i.test(l)))
    assert.ok(labels.some((l) => /member-only body/i.test(l)))
  })

  it('deferred fields catalog ECKE capability gaps', () => {
    const labels = getEducationDeferredFields().map((f) => f.label)
    assert.ok(labels.some((l) => /related public articles/i.test(l)))
    assert.ok(labels.some((l) => /learning path/i.test(l)))
  })

  it('stale detection works after public article edit', () => {
    const article = baseArticle()
    const envelope = buildEckePublicEnvelope('education_article', article, authorContext)
    const originalHash = hashEckePayload(envelope.payload)
    const edited = baseArticle({ bodyHtml: '<p>Updated public body</p>' })
    const editedEnvelope = buildEckePublicEnvelope('education_article', edited, authorContext)
    const editedHash = hashEckePayload(editedEnvelope.payload)
    assert.notEqual(originalHash, editedHash)

    const status = deriveTargetDisplayStatus(editedHash, {
      id: 'row',
      status: 'published',
      contentHash: editedHash,
      publishedContentHash: originalHash,
      lastPublishedAt: new Date('2026-01-01'),
      lastPreviewAt: null,
      publishedByUserId: null,
      externalSlug: 'safety-basics',
      eckePublicUrl: null,
      eckeRecordId: null,
      lastError: null,
      lastAttemptAt: null,
      unpublishedAt: null,
      scopeType: 'education_article',
      educationArticleId: article.id,
      groupId: null,
      organizationId: null,
      conventionId: null,
      eventId: null,
      vendorProfileId: null,
      targetKind: 'ecke_article',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    assert.equal(status, 'stale')
  })

  it('resolveEckePublicEducationUrl builds education page URL', () => {
    const url = resolveEckePublicEducationUrl('safety-basics')
    assert.match(url ?? '', /\/education\/safety-basics$/)
  })
})

describe('ecke-publish-service education control plane wiring', () => {
  it('service wires education_article preview and publish executors', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /buildEducationArticlePreview/)
    assert.match(src, /executeEducationArticlePublish/)
    assert.match(src, /executeEckePublishArticle/)
    assert.match(src, /executeEckeUnpublishEducationArticleWithTargetUpdate/)
    assert.match(src, /education_article/)
  })

  it('Pass 5 supported write kinds include vendor_profile', () => {
    assert.equal(PASS5_UNSUPPORTED_ERROR.errorCode, 'unsupported_in_pass_5')
    assert.match(PASS5_UNSUPPORTED_ERROR.message, /unified ECKE control plane/i)
  })

  it('executor persists eckePublicUrl on successful publish', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-executor.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /eckePublicUrl/)
    assert.match(src, /eckeRecordId/)
  })

  it('unpublish sets unpublished status not stale', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-executor.ts', import.meta.url), 'utf8'),
    )
    const fn = src.slice(src.indexOf('markEducationArticleEckeUnpublished'))
    assert.match(fn, /status: 'unpublished'/)
    assert.match(fn, /unpublishedAt/)
    assert.match(fn, /publishedContentHash: null/)
  })
})

describe('group_listing and event_listing regression guards', () => {
  it('group listing preview helper still exists', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /buildGroupListingPreview/)
    assert.match(src, /executeGroupListingPublish/)
  })

  it('event listing preview helper still exists', async () => {
    const src = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./ecke-publish-service.ts', import.meta.url), 'utf8'),
    )
    assert.match(src, /buildEventListingPreview/)
    assert.match(src, /executeEventListingPublish/)
  })
})
