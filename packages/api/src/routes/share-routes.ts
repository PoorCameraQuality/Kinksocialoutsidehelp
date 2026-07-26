import { APP_NAME, KINK_SOCIAL_ROBOTS_META, KINK_SOCIAL_X_ROBOTS_TAG, resolveShareImageUrl } from '@c2k/shared'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import type { ConventionPublicSettings } from '../db/schema.js'
import { db, schema } from '../db/index.js'
import { canViewOrg, isOrgMember } from '../lib/org-visibility.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function siteBaseUrl(): string {
  const raw = process.env.VITE_SITE_URL ?? process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:5173'
  return raw.replace(/\/$/, '')
}

function siteDefaultOgImage(): string | null {
  const base = siteBaseUrl()
  return `${base}/og-default.png`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function shareHtml(opts: {
  title: string
  description: string
  imageUrl: string | null
  canonicalUrl: string
  redirectUrl: string
}): string {
  const img = opts.imageUrl ? `<meta property="og:image" content="${escapeHtml(opts.imageUrl)}" />` : ''
  const twImg = opts.imageUrl ? `<meta name="twitter:image" content="${escapeHtml(opts.imageUrl)}" />` : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts.title)}</title>
  <meta name="description" content="${escapeHtml(opts.description)}" />
  <meta name="robots" content="${KINK_SOCIAL_ROBOTS_META}" />
  <meta name="googlebot" content="${KINK_SOCIAL_ROBOTS_META}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(opts.title)}" />
  <meta property="og:description" content="${escapeHtml(opts.description)}" />
  <meta property="og:url" content="${escapeHtml(opts.canonicalUrl)}" />
  ${img}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(opts.title)}" />
  <meta name="twitter:description" content="${escapeHtml(opts.description)}" />
  ${twImg}
  <meta http-equiv="refresh" content="0;url=${escapeHtml(opts.redirectUrl)}" />
  <link rel="canonical" href="${escapeHtml(opts.canonicalUrl)}" />
</head>
<body>
  <p><a href="${escapeHtml(opts.redirectUrl)}">Continue to ${escapeHtml(opts.title)}</a></p>
</body>
</html>`
}

async function loadHeroForConvention(anchorEventId: string | null): Promise<string | null> {
  if (!anchorEventId) return null
  const [row] = await db
    .select({ imageUrl: schema.events.imageUrl })
    .from(schema.events)
    .where(eq(schema.events.id, anchorEventId))
    .limit(1)
  return row?.imageUrl ?? null
}

export async function registerShareRoutes(app: FastifyInstance) {
  const sendShareHtml = (reply: FastifyReply, html: string) =>
    reply.header('X-Robots-Tag', KINK_SOCIAL_X_ROBOTS_TAG).type('text/html; charset=utf-8').send(html)

  app.get('/share/groups/:key', async (req, reply) => {
    const { key } = req.params as { key: string }
    const [g] = await db
      .select()
      .from(schema.groups)
      .where(
        UUID_RE.test(key) ?
          eq(schema.groups.id, key)
        : eq(schema.groups.slug, key),
      )
      .limit(1)
    if (!g || g.disbandedAt) return reply.status(404).send('Not found')
    const base = siteBaseUrl()
    const path = `/groups/${encodeURIComponent(g.id)}`
    const image = resolveShareImageUrl({
      shareImageUrl: g.shareImageUrl,
      bannerUrl: g.bannerUrl,
      logoUrl: g.logoUrl,
      siteDefault: siteDefaultOgImage(),
    })
    const html = shareHtml({
      title: g.name,
      description: `Community group on ${APP_NAME}`,
      imageUrl: image,
      canonicalUrl: `${base}${path}`,
      redirectUrl: `${base}${path}`,
    })
    return sendShareHtml(reply, html)
  })

  app.get('/share/orgs/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const [o] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, slug))
      .limit(1)
    if (!o) return reply.status(404).send('Not found')
    const viewer = resolveViewerFromRequest(req)
    const viewerId = getViewerUserId(viewer.payload)
    if (!(await canViewOrg(o, viewerId))) return reply.status(404).send('Not found')
    const base = siteBaseUrl()
    const path = `/orgs/${encodeURIComponent(o.slug)}`
    const member = await isOrgMember(o, viewerId)
    const fullOg = o.visibility === 'PUBLIC' || member
    const title = fullOg ? o.displayName : `Organization on ${APP_NAME}`
    const desc = fullOg
      ? (o.bio ?? '').replace(/<[^>]+>/g, '').slice(0, 200) || `${o.displayName} on ${APP_NAME}`
      : `Organization on ${APP_NAME}`
    const image = fullOg
      ? resolveShareImageUrl({
          shareImageUrl: o.shareImageUrl,
          bannerUrl: o.bannerUrl,
          logoUrl: o.logoUrl,
          siteDefault: siteDefaultOgImage(),
        })
      : siteDefaultOgImage()
    const html = shareHtml({
      title,
      description: desc,
      imageUrl: image,
      canonicalUrl: `${base}${path}`,
      redirectUrl: `${base}${path}`,
    })
    return sendShareHtml(reply, html)
  })

  app.get('/share/conventions/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const [c] = await db
      .select()
      .from(schema.conventions)
      .where(eq(schema.conventions.slug, slug))
      .limit(1)
    if (!c) return reply.status(404).send('Not found')
    const settings = (c.settings ?? {}) as ConventionPublicSettings
    const es = settings.eventSystems ?? {}
    const hero = await loadHeroForConvention(c.anchorEventId)
    const base = siteBaseUrl()
    const path = `/conventions/${encodeURIComponent(c.slug)}`
    const image = resolveShareImageUrl({
      shareImageUrl: settings.shareImageUrl,
      heroImageUrl: hero,
      logoUrl: es.logoUrl ?? null,
      siteDefault: siteDefaultOgImage(),
    })
    const title = es.eventTitle ?? c.name
    const desc = (c.description ?? '').slice(0, 200) || `${title} on ${APP_NAME}`
    const html = shareHtml({
      title,
      description: desc,
      imageUrl: image,
      canonicalUrl: `${base}${path}`,
      redirectUrl: `${base}${path}`,
    })
    return sendShareHtml(reply, html)
  })
}
