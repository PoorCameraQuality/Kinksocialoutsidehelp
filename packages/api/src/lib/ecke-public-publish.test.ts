import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import {
  buildEckePublicEnvelope,
  buildEducationArticleUnpublishEnvelope,
  getEducationArticleIneligibilityReason,
  isEntityEckePublishEligible,
  redactEducationArticleForEcke,
  redactedPayloadExcludesForbiddenKeys,
  type EducationArticleAuthorContext,
  type EducationArticlePublishRow,
} from './ecke-public-publish.js'
import {
  loadEckeIngestApiConfig,
  publishEducationArticleEnvelopeToEcke,
  unpublishEducationArticleEnvelopeToEcke,
} from './ecke-publish-client.js'

const ARTICLE_ID = '11111111-1111-4111-8111-111111111111'

function baseArticle(overrides: Partial<EducationArticlePublishRow> = {}): EducationArticlePublishRow {
  return {
    id: ARTICLE_ID,
    slug: 'safety-basics',
    title: 'Safety Basics',
    excerpt: 'A public excerpt.',
    bodyHtml: '<p>Public guidance</p>',
    categories: ['Safety'],
    contentWarnings: ['power exchange'],
    difficulty: 'beginner',
    heroImageUrl: 'https://cdn.example/hero.jpg',
    readingMinutes: 8,
    publishedAt: new Date('2026-06-01T12:00:00.000Z'),
    updatedAt: new Date('2026-06-02T12:00:00.000Z'),
    visibility: 'PUBLIC',
    publicationStatus: 'PUBLISHED',
    eckePublish: true,
    authorUserId: '22222222-2222-4222-8222-222222222222',
    presenterProfileUserId: null,
    ...overrides,
  }
}

const author: EducationArticleAuthorContext = {
  displayName: 'Alex Educator',
  username: 'alex',
  presenterUsername: null,
  presenterDirectoryVisibility: null,
}

const INGEST_ENV_KEYS = [
  'ECKE_PUBLISH_ENABLED',
  'ECKE_PUBLISH_ENDPOINT',
  'ECKE_PUBLISH_SECRET',
  'ECKE_PUBLIC_BASE_URL',
  'ECKE_UNPUBLISH_ENDPOINT',
  'C2K_PUBLIC_WEB_URL',
] as const

function saveEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {}
  for (const k of INGEST_ENV_KEYS) snap[k] = process.env[k]
  return snap
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of INGEST_ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
}

describe('education article ECKE eligibility', () => {
  it('rejects draft articles', () => {
    const article = baseArticle({ publicationStatus: 'DRAFT' })
    assert.equal(getEducationArticleIneligibilityReason(article), 'Only published articles can sync to ECKE')
    assert.equal(isEntityEckePublishEligible('education_article', article), false)
  })

  it('rejects member-only articles', () => {
    const article = baseArticle({ visibility: 'MEMBERS' })
    assert.match(getEducationArticleIneligibilityReason(article)!, /member-only/i)
  })

  it('rejects connection-only articles', () => {
    const article = baseArticle({ visibility: 'CONNECTIONS' })
    assert.match(getEducationArticleIneligibilityReason(article)!, /connection-only/i)
  })

  it('rejects archived articles', () => {
    const article = baseArticle({ publicationStatus: 'ARCHIVED' })
    assert.match(getEducationArticleIneligibilityReason(article)!, /archived/i)
  })

  it('rejects when eckePublish is false', () => {
    const article = baseArticle({ eckePublish: false })
    assert.match(getEducationArticleIneligibilityReason(article)!, /not opted in/i)
  })

  it('accepts published public opted-in articles', () => {
    const article = baseArticle()
    assert.equal(getEducationArticleIneligibilityReason(article), null)
    assert.equal(isEntityEckePublishEligible('education_article', article), true)
  })
})

describe('education article redaction and envelope', () => {
  it('builds envelope for eligible article', () => {
    const envelope = buildEckePublicEnvelope('education_article', baseArticle(), author)
    assert.equal(envelope.entityType, 'education_article')
    assert.equal(envelope.sourceId, ARTICLE_ID)
    assert.equal(envelope.visibility, 'PUBLIC')
    assert.equal(envelope.publishToEcke, true)
    assert.equal(envelope.publicSafe, true)
    assert.equal(envelope.allowSlugSuffix, false)
    assert.match(envelope.canonicalKinkSocialUrl!, /\/education\/safety-basics/)
    assert.equal(envelope.payload.title, 'Safety Basics')
  })

  it('redacted payload excludes forbidden keys', () => {
    const payload = redactEducationArticleForEcke(baseArticle(), author)
    assert.equal(redactedPayloadExcludesForbiddenKeys(payload), true)
    assert.equal('email' in payload, false)
    assert.equal('bodyJson' in payload, false)
  })

  it('sanitizes private kink.social URLs from body but keeps brand mentions', () => {
    const payload = redactEducationArticleForEcke(
      baseArticle({
        title: 'Kink.Social comes online in alpha',
        bodyHtml:
          '<p>Join https://kink.social/messages/secret but visit kink.social for more.</p><img src="https://kink.social/api/v1/media/assets/x/content" alt="hero">',
        excerpt: 'kink.social alpha launch',
        slug: 'kink-social-goes-live',
      }),
      author,
    )
    assert.match(payload.title, /Kink\.Social/i)
    assert.match(payload.excerpt, /kink\.social/i)
    assert.doesNotMatch(payload.bodyHtml, /kink\.social\/messages/)
    assert.doesNotMatch(payload.bodyHtml, /kink\.social\/api/)
    assert.match(payload.bodyHtml, /kink\.social/)
    assert.doesNotMatch(payload.bodyHtml, /<img\b/)
    assert.equal(payload.slug, 'kink-social-goes-live')
  })

  it('keeps TipTap formatting and public CDN inline images in ECKE body', () => {
    const payload = redactEducationArticleForEcke(
      baseArticle({
        bodyHtml:
          '<h2>Safety</h2><p>Use <strong>negotiation</strong>.</p><ul><li>SSC</li></ul>' +
          '<img src="https://kink.social/c2k-uploads/education/inline.jpg" alt="demo" />',
      }),
      author,
    )
    assert.match(payload.bodyHtml, /<h2>Safety<\/h2>/)
    assert.match(payload.bodyHtml, /<strong>negotiation<\/strong>/)
    assert.match(payload.bodyHtml, /<ul>/)
    assert.match(payload.bodyHtml, /c2k-uploads\/education\/inline\.jpg/)
  })

  it('allows author profile attribution URLs when public web base is kink.social', () => {
    const prev = process.env.C2K_PUBLIC_WEB_URL
    process.env.C2K_PUBLIC_WEB_URL = 'https://kink.social'
    try {
      const payload = redactEducationArticleForEcke(baseArticle(), author)
      assert.match(payload.authorProfileUrl ?? '', /^https:\/\/kink\.social\/profile\//)
      assert.doesNotMatch(JSON.stringify(payload), /kink\.social\/messages/)
    } finally {
      if (prev === undefined) delete process.env.C2K_PUBLIC_WEB_URL
      else process.env.C2K_PUBLIC_WEB_URL = prev
    }
  })

  it('strips kink.social from slug and drops proxy hero images', () => {
    const payload = redactEducationArticleForEcke(
      baseArticle({
        slug: 'kink.social-goes-live-for-alpha',
        heroImageUrl: 'https://kink.social/api/v1/media/assets/abc/content',
      }),
      author,
    )
    assert.equal(payload.slug, 'kink-social-goes-live-for-alpha')
    assert.equal(payload.heroImageUrl, null)
  })

  it('unpublish envelope is valid', () => {
    const envelope = buildEducationArticleUnpublishEnvelope(ARTICLE_ID, 'opt_out')
    assert.equal(envelope.action, 'unpublish')
    assert.equal(envelope.entityType, 'education_article')
    assert.equal(envelope.reason, 'opt_out')
  })
})

describe('loadEckeIngestApiConfig', () => {
  const snap = saveEnv()

  afterEach(() => restoreEnv(snap))

  it('loads ingest API config when enabled', () => {
    process.env.ECKE_PUBLISH_ENABLED = 'true'
    process.env.ECKE_PUBLISH_ALLOW_NON_PRODUCTION = 'true'
    process.env.ECKE_PUBLISH_ENDPOINT = 'https://ecke.example/api/kink-social/ingest'
    process.env.ECKE_PUBLISH_SECRET = 'ingest-secret'
    const cfg = loadEckeIngestApiConfig()
    assert.ok(cfg)
    assert.equal(cfg!.unpublishEndpoint, 'https://ecke.example/api/kink-social/unpublish')
  })

  it('rejects Vercel preview endpoints unless explicitly overridden', () => {
    process.env.ECKE_PUBLISH_ENABLED = 'true'
    delete process.env.ECKE_PUBLISH_ALLOW_NON_PRODUCTION
    process.env.ECKE_PUBLISH_ENDPOINT =
      'https://eastcoastkinkevents-abc123-poorcameraqualitys-projects.vercel.app/api/kink-social/ingest'
    process.env.ECKE_PUBLISH_SECRET = 'ingest-secret'
    assert.equal(loadEckeIngestApiConfig(), null)
  })

  it('accepts production ECKE hostnames', () => {
    process.env.ECKE_PUBLISH_ENABLED = 'true'
    delete process.env.ECKE_PUBLISH_ALLOW_NON_PRODUCTION
    process.env.ECKE_PUBLISH_ENDPOINT = 'https://www.eastcoastkinkevents.com/api/kink-social/ingest'
    process.env.ECKE_PUBLISH_SECRET = 'ingest-secret'
    const cfg = loadEckeIngestApiConfig()
    assert.ok(cfg)
    assert.equal(cfg!.publicBaseUrl, 'https://www.eastcoastkinkevents.com')
  })
})

describe('education article Option A ingest client', () => {
  const snap = saveEnv()
  const cfg = {
    publishEndpoint: 'https://ecke.example/api/kink-social/ingest',
    unpublishEndpoint: 'https://ecke.example/api/kink-social/unpublish',
    publishSecret: 'ingest-secret',
    publicBaseUrl: 'https://www.eastcoastkinkevents.com',
  }

  let fetchMock: ReturnType<typeof mock.fn>
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchMock = mock.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    restoreEnv(snap)
  })

  it('calls ECKE ingest API for education_article', async () => {
    fetchMock.mock.mockImplementation(async () =>
      Response.json({
        status: 'published',
        eckeSlug: 'safety-basics',
        eckePublicUrl: 'https://www.eastcoastkinkevents.com/education/safety-basics',
        eckeRecordId: 'aaa',
      }),
    )

    const envelope = buildEckePublicEnvelope('education_article', baseArticle(), author)
    const result = await publishEducationArticleEnvelopeToEcke(cfg, envelope)

    assert.equal(result.ok, true)
    assert.equal(fetchMock.mock.callCount(), 1)
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit]
    assert.equal(url, cfg.publishEndpoint)
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer ingest-secret')
    const body = JSON.parse(String(init.body))
    assert.equal(body.entityType, 'education_article')
    assert.equal(body.payload.slug, 'safety-basics')
  })

  it('records error on 401 without marking published', async () => {
    fetchMock.mock.mockImplementation(async () =>
      Response.json(
        { status: 'rejected', errorCode: 'bad_auth', errorMessage: 'Invalid ingest credentials' },
        { status: 401 },
      ),
    )

    const envelope = buildEckePublicEnvelope('education_article', baseArticle(), author)
    const result = await publishEducationArticleEnvelopeToEcke(cfg, envelope)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /invalid ingest credentials/i)
  })

  it('records error on 409 slug_collision', async () => {
    fetchMock.mock.mockImplementation(async () =>
      Response.json(
        { status: 'rejected', errorCode: 'slug_collision', errorMessage: 'Slug collision' },
        { status: 409 },
      ),
    )

    const envelope = buildEckePublicEnvelope('education_article', baseArticle(), author)
    const result = await publishEducationArticleEnvelopeToEcke(cfg, envelope)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.error, /slug collision/i)
  })

  it('unpublish helper sends unpublish envelope', async () => {
    fetchMock.mock.mockImplementation(async () =>
      Response.json({
        status: 'unpublished',
        eckeSlug: 'safety-basics',
        eckePublicUrl: 'https://www.eastcoastkinkevents.com/education/safety-basics',
      }),
    )

    const envelope = buildEducationArticleUnpublishEnvelope(ARTICLE_ID, 'ineligible')
    const result = await unpublishEducationArticleEnvelopeToEcke(cfg, envelope)
    assert.equal(result.ok, true)
    const [, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    assert.equal(body.action, 'unpublish')
    assert.equal(body.sourceId, ARTICLE_ID)
  })
})

describe('education article does not use legacy Supabase REST path', () => {
  it('publishArticleRowToEcke remains exported for legacy entities only', async () => {
    const { publishArticleRowToEcke } = await import('./ecke-publish-client.js')
    assert.equal(typeof publishArticleRowToEcke, 'function')
  })
})
