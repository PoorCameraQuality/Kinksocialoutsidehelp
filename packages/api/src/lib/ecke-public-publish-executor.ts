import { eq } from 'drizzle-orm'
import type { EckeEducationArticlePayload, KinkSocialPublicIngestEnvelope } from '@c2k/shared'
import { db, schema } from '../db/index.js'
import {
  buildEckePublicEnvelopeAsync,
  buildEducationArticleUnpublishEnvelope,
  getEducationArticleIneligibilityReason,
  type EducationArticleAuthorContext,
  type EducationArticlePublishRow,
  type EckePublicPublishEntityType,
} from './ecke-public-publish.js'
import { hashEckePayload } from './ecke-publish-payload.js'
import {
  loadEckeIngestApiConfig,
  publishEducationArticleEnvelopeToEcke,
  unpublishEducationArticleEnvelopeToEcke,
  type EckeIngestApiConfig,
  type EckePublishResult,
} from './ecke-publish-client.js'

const ARTICLE_PUBLISH_SELECT = {
  id: schema.educationArticles.id,
  slug: schema.educationArticles.slug,
  title: schema.educationArticles.title,
  excerpt: schema.educationArticles.excerpt,
  bodyHtml: schema.educationArticles.bodyHtml,
  categories: schema.educationArticles.categories,
  contentWarnings: schema.educationArticles.contentWarnings,
  difficulty: schema.educationArticles.difficulty,
  heroImageUrl: schema.educationArticles.heroImageUrl,
  readingMinutes: schema.educationArticles.readingMinutes,
  publishedAt: schema.educationArticles.publishedAt,
  updatedAt: schema.educationArticles.updatedAt,
  visibility: schema.educationArticles.visibility,
  publicationStatus: schema.educationArticles.publicationStatus,
  eckePublish: schema.educationArticles.eckePublish,
  authorUserId: schema.educationArticles.authorUserId,
  organizationId: schema.educationArticles.organizationId,
  presenterProfileUserId: schema.educationArticles.presenterProfileUserId,
} as const

async function loadEducationArticlePublishRow(articleId: string): Promise<EducationArticlePublishRow | null> {
  const [article] = await db
    .select(ARTICLE_PUBLISH_SELECT)
    .from(schema.educationArticles)
    .where(eq(schema.educationArticles.id, articleId))
    .limit(1)

  return article ?? null
}

async function loadEducationArticleAuthorContext(
  article: EducationArticlePublishRow,
): Promise<EducationArticleAuthorContext> {
  const [author] = await db
    .select({
      displayName: schema.profiles.displayName,
      username: schema.users.username,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, article.authorUserId))
    .limit(1)

  let presenterUsername: string | null = null
  let presenterDirectoryVisibility: string | null = null

  if (article.presenterProfileUserId) {
    const [presenterUser] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, article.presenterProfileUserId))
      .limit(1)

    const [presenterProfile] = await db
      .select({ directoryVisibility: schema.presenterProfiles.directoryVisibility })
      .from(schema.presenterProfiles)
      .where(eq(schema.presenterProfiles.userId, article.presenterProfileUserId))
      .limit(1)

    presenterUsername = presenterUser?.username ?? null
    presenterDirectoryVisibility = presenterProfile?.directoryVisibility ?? null
  }

  return {
    displayName: author?.displayName ?? null,
    username: author?.username ?? null,
    presenterUsername,
    presenterDirectoryVisibility,
  }
}

export async function executeEckePublishEntity(
  entityType: EckePublicPublishEntityType,
  sourceId: string,
  ingestCfg: EckeIngestApiConfig,
  userId?: string,
): Promise<EckePublishResult & { contentHash?: string; externalSlug?: string }> {
  if (entityType !== 'education_article') {
    return { ok: false, targetKind: 'ecke_article', error: `Unsupported entity type: ${entityType}` }
  }

  const article = await loadEducationArticlePublishRow(sourceId)
  if (!article) {
    return { ok: false, targetKind: 'ecke_article', error: 'Article not found' }
  }

  const ineligible = getEducationArticleIneligibilityReason(article)
  if (ineligible) {
    return { ok: false, targetKind: 'ecke_article', error: ineligible }
  }

  const author = await loadEducationArticleAuthorContext(article)
  let envelope: KinkSocialPublicIngestEnvelope<EckeEducationArticlePayload>
  try {
    envelope = await buildEckePublicEnvelopeAsync(entityType, article, author)
  } catch (err) {
    return {
      ok: false,
      targetKind: 'ecke_article',
      error: err instanceof Error ? err.message : 'Could not build ECKE publish envelope',
    }
  }
  const contentHash = hashEckePayload(envelope.payload)

  const result = await publishEducationArticleEnvelopeToEcke(ingestCfg, envelope)
  if (!result.ok) {
    return { ...result, contentHash }
  }

  return {
    ...result,
    contentHash,
    externalSlug: result.eckeSlug || envelope.preferredSlug || article.slug,
  }
}

export async function executeEckeUnpublishEducationArticle(
  articleId: string,
  reason?: 'archived' | 'deleted' | 'opt_out' | 'ineligible' | 'visibility_change',
): Promise<EckePublishResult> {
  const ingestCfg = loadEckeIngestApiConfig()
  if (!ingestCfg) {
    return {
      ok: false,
      targetKind: 'ecke_article',
      error: 'ECKE ingest API not configured (ECKE_PUBLISH_ENDPOINT / ECKE_PUBLISH_SECRET)',
    }
  }

  const envelope = buildEducationArticleUnpublishEnvelope(articleId, reason)
  return unpublishEducationArticleEnvelopeToEcke(ingestCfg, envelope)
}

export async function loadEducationArticleForPublish(articleId: string) {
  return loadEducationArticlePublishRow(articleId)
}

export async function loadEducationArticleAuthorContextForPublish(article: EducationArticlePublishRow) {
  return loadEducationArticleAuthorContext(article)
}

export { getEducationArticleIneligibilityReason }
