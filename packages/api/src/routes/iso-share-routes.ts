import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  APP_NAME,
  KINK_SOCIAL_ROBOTS_META,
  KINK_SOCIAL_X_ROBOTS_TAG,
  isoPostHasListableContent,
  isoShareCardText,
} from '@c2k/shared'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { canViewerReadIsoVisibility, type IsoVisibility } from '../lib/iso-access.js'
import { renderIsoCardFromPost } from '../lib/iso-card-image.js'
import { isoCardCacheControl } from '../lib/iso-share-card-model.js'

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function siteBaseUrl(): string {
  const raw = process.env.VITE_SITE_URL ?? process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:5173'
  return raw.replace(/\/$/, '')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function loadPublicIsoCard(username: string, viewerId: string | null) {
  const [user] = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.profiles.displayName,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.username, username))
    .limit(1)
  if (!user) return null

  const [post] = await db
    .select()
    .from(schema.userIsoPosts)
    .where(eq(schema.userIsoPosts.userId, user.id))
    .limit(1)
  if (!post || !isoPostHasListableContent(post.body ?? '', post.structured)) return null

  const isOwner = viewerId === user.id
  const visibility = post.visibility as IsoVisibility
  if (visibility === 'PRIVATE' && !isOwner) return null

  const canRead = canViewerReadIsoVisibility(visibility, { viewerId, isOwner })
  const crawlerReveal = visibility === 'PUBLIC'
  const revealBody = crawlerReveal || (canRead && viewerId != null)
  const cardText = isoShareCardText(post.body ?? '', post.structured)

  const images = await db
    .select({ url: schema.userIsoImages.url, sortOrder: schema.userIsoImages.sortOrder })
    .from(schema.userIsoImages)
    .where(eq(schema.userIsoImages.userId, user.id))
    .orderBy(asc(schema.userIsoImages.sortOrder))

  return {
    user,
    post,
    cardText,
    revealBody,
    crawlerReveal,
    isOwner,
    visibility,
    imageUrls: images.map((i) => i.url),
    imageUrl: images[0]?.url ?? null,
  }
}

export async function registerIsoShareRoutes(app: FastifyInstance) {
  app.get('/api/v1/iso/:username/card.png', async (req, reply) => {
    if (!useDatabase()) return reply.status(503).send({ error: 'Database required' })
    const { username } = req.params as { username: string }
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    const data = await loadPublicIsoCard(username, viewerId)
    if (!data) return reply.status(404).send({ error: 'ISO not found' })

    // PUBLIC: full for anyone. MEMBERS: full for signed-in viewers. PRIVATE: owner only (load already gates).
    // Anonymous MEMBERS/PRIVATE crawlers get teaser (PRIVATE non-owner never reaches here).
    const pngRevealFull =
      Boolean(data.isOwner) ||
      data.crawlerReveal ||
      (data.visibility === 'MEMBERS' && viewerId != null)

    const png = await renderIsoCardFromPost({
      displayName: data.user.displayName || data.user.username,
      username: data.user.username,
      visibility: data.visibility,
      body: data.post.body ?? '',
      structured: data.post.structured,
      imageUrls: pngRevealFull ? data.imageUrls : [],
      revealFull: pngRevealFull,
    })

    const { cacheControl, varyCookie } = isoCardCacheControl({
      visibility: data.visibility,
      revealFull: pngRevealFull,
    })
    if (varyCookie) reply.header('Vary', 'Cookie')
    return reply.header('Cache-Control', cacheControl).type('image/png').send(png)
  })

  app.get('/share/iso/:username', async (req, reply: FastifyReply) => {
    if (!useDatabase()) return reply.status(503).send('Database required')
    const { username } = req.params as { username: string }
    const data = await loadPublicIsoCard(username, null)
    if (!data) return reply.status(404).type('text/plain').send('Not found')

    const base = siteBaseUrl()
    const profilePath = `/profile/${encodeURIComponent(data.user.username)}?tab=ISO`
    const cardPath = `/api/v1/iso/${encodeURIComponent(data.user.username)}/card.png`
    const title = `${data.user.displayName || data.user.username} — ISO · ${APP_NAME}`
    const description = data.crawlerReveal
      ? data.cardText.slice(0, 180)
      : `In Search Of on ${APP_NAME}. Sign in to view this member’s ISO.`
    const imageUrl = `${base}${cardPath}`
    const canonicalUrl = `${base}/share/iso/${encodeURIComponent(data.user.username)}`
    const redirectUrl = `${base}${profilePath}`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="${KINK_SOCIAL_ROBOTS_META}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
</head>
<body>
  <p><a href="${escapeHtml(redirectUrl)}">View ISO on ${escapeHtml(APP_NAME)}</a></p>
</body>
</html>`

    return reply
      .header('X-Robots-Tag', KINK_SOCIAL_X_ROBOTS_TAG)
      .type('text/html; charset=utf-8')
      .send(html)
  })
}
