import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { parseRssEpisodes } from './media-rss-parse.js'
import { slugifyMediaTitle } from './media-show-schema.js'
import { fetchSafeOutboundUrl } from './safe-outbound-url.js'

async function ensureEpisodeSlug(showId: string, title: string): Promise<string> {
  const base = slugifyMediaTitle(title) || 'episode'
  for (let n = 0; n < 20; n++) {
    const candidate = (n === 0 ? base : `${base}-${n}`).slice(0, 160)
    const [dup] = await db
      .select({ id: schema.mediaShowEpisodes.id })
      .from(schema.mediaShowEpisodes)
      .where(
        and(eq(schema.mediaShowEpisodes.showId, showId), eq(schema.mediaShowEpisodes.slug, candidate)),
      )
      .limit(1)
    if (!dup) return candidate
  }
  return `ep-${Date.now()}`.slice(0, 160)
}

export async function syncMediaShowRss(showId: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const [show] = await db.select().from(schema.mediaShows).where(eq(schema.mediaShows.id, showId)).limit(1)
  if (!show?.rssFeedUrl) return { ok: false, count: 0, error: 'No RSS feed URL' }

  let xml: string
  try {
    // PR 3 (M3): SSRF guard — https-only, no private/metadata hosts,
    // redirects re-validated hop by hop.
    const res = await fetchSafeOutboundUrl(show.rssFeedUrl, {
      headers: { 'User-Agent': 'CoastToCoastKink-MediaSync/1.0' },
      timeoutMs: 30_000,
    })
    if (!res.ok) return { ok: false, count: 0, error: `HTTP ${res.status}` }
    xml = await res.text()
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : 'Fetch failed' }
  }

  const parsed = parseRssEpisodes(xml, 50)
  let count = 0
  for (const ep of parsed) {
    const [byGuid] = await db
      .select()
      .from(schema.mediaShowEpisodes)
      .where(
        and(eq(schema.mediaShowEpisodes.showId, showId), eq(schema.mediaShowEpisodes.rssGuid, ep.guid)),
      )
      .limit(1)

    if (byGuid) {
      await db
        .update(schema.mediaShowEpisodes)
        .set({
          title: ep.title,
          description: ep.description,
          publishedAt: ep.publishedAt,
          externalAudioUrl: ep.externalAudioUrl,
          websiteUrl: ep.link,
          updatedAt: new Date(),
        })
        .where(eq(schema.mediaShowEpisodes.id, byGuid.id))
      count++
      continue
    }

    const slug = await ensureEpisodeSlug(showId, ep.title)
    await db.insert(schema.mediaShowEpisodes).values({
      showId,
      slug,
      title: ep.title,
      description: ep.description,
      publishedAt: ep.publishedAt,
      externalAudioUrl: ep.externalAudioUrl,
      websiteUrl: ep.link,
      rssGuid: ep.guid,
    })
    count++
  }

  await db
    .update(schema.mediaShows)
    .set({ lastEpisodeSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.mediaShows.id, showId))

  return { ok: true, count }
}

export async function syncAllMediaShowFeeds(): Promise<{ shows: number; episodes: number; errors: string[] }> {
  const rows = await db
    .select({ id: schema.mediaShows.id })
    .from(schema.mediaShows)
    .where(
      and(
        eq(schema.mediaShows.publicationStatus, 'PUBLISHED'),
        eq(schema.mediaShows.listInMedia, true),
      ),
    )

  let episodes = 0
  const errors: string[] = []
  for (const row of rows) {
    const [show] = await db.select().from(schema.mediaShows).where(eq(schema.mediaShows.id, row.id)).limit(1)
    if (!show?.rssFeedUrl) continue
    if (show.mediaFormat === 'video') continue
    const r = await syncMediaShowRss(row.id)
    if (r.ok) episodes += r.count
    else if (r.error) errors.push(`${row.id}: ${r.error}`)
  }
  return { shows: rows.length, episodes, errors }
}
