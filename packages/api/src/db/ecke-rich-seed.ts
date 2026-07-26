/**
 * Rich dev seed from eastcoastkinkevents.com catalog - feed, vendors, photos, connections, activities.
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  defaultFeedSettings,
  defaultNotificationSettings,
  defaultPrivacySettings,
} from '@c2k/shared'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { insertFeedActivity } from '../lib/feed-activities.js'
import { refreshEventRsvpCount } from '../lib/event-rsvp-helpers.js'
import type { AlphaSeedMarker } from '../lib/alpha-seed-labels.js'
import {
  ECKE_DUNGEONS,
  ECKE_PERSONAS,
  ECKE_SOURCE,
  ECKE_UPCOMING_EVENTS,
  ECKE_VENDORS,
  type EckePersonaRow,
  type EckeVendorRow,
} from './ecke-catalog.js'
import { db, schema } from './index.js'
import { resolveVendorCategoryTags } from '../lib/vendor-public-dto.js'
import { resolveEastCoastRepoRoot, syncEckeDungeonLogo } from './ecke-seed-images.js'

const DEMO_PASSWORD = () => process.env.DEMO_LOGIN_PASSWORD ?? 'demo'

let alphaMarkFn: AlphaSeedMarker | undefined

async function markAlpha(
  targetType: string,
  targetId: string,
  opts: {
    isSynthetic?: boolean
    isPublicSource?: boolean
    sourceSlug?: string
    sourceType?: string
  } = {},
) {
  if (!alphaMarkFn) return
  await alphaMarkFn({ targetType, targetId, ...opts })
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000)
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

async function stateIdByName(name: string): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.states.id })
    .from(schema.states)
    .where(eq(schema.states.name, name))
    .limit(1)
  return row?.id ?? null
}

async function ensurePersonaUser(p: EckePersonaRow): Promise<string> {
  const [ex] = await db.select().from(schema.users).where(eq(schema.users.username, p.username)).limit(1)
  if (ex) {
    await markAlpha('user', ex.id, { isSynthetic: true, sourceType: 'ecke_persona', sourceSlug: p.username })
    return ex.id
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD(), 10)
  const [user] = await db
    .insert(schema.users)
    .values({
      username: p.username,
      email: `${slugify(p.username)}@ecke-seed.local`,
      passwordHash: hash,
    })
    .returning()
  if (!user) throw new Error(`insert ${p.username}`)

  const stateId = await stateIdByName(p.stateName)
  await db.insert(schema.profiles).values({
    userId: user.id,
    displayName: p.displayName,
    bio: p.bio,
    visibility: 'PUBLIC',
    verified: p.isVendor === true,
    trustScore: 55 + Math.floor(Math.random() * 30),
    location: p.location,
    stateId,
  })
  await db.insert(schema.userSettings).values({
    userId: user.id,
    privacySettings: defaultPrivacySettings,
    notificationSettings: defaultNotificationSettings,
    feedSettings: defaultFeedSettings,
  })
  await markAlpha('user', user.id, { isSynthetic: true, sourceType: 'ecke_persona', sourceSlug: p.username })
  return user.id
}

export type EckeSeedContext = {
  braxId: string
  ropeId: string
  leatherId: string
  shutterId: string
  orgId: string
  previewConventionId?: string
  /** When set, every created entity is registered in alpha_seed_items. */
  alphaMark?: AlphaSeedMarker
}

export async function seedEckeRichExperience(ctx: EckeSeedContext): Promise<void> {
  console.log(`ECKE rich seed. Catalog from ${ECKE_SOURCE}`)
  alphaMarkFn = ctx.alphaMark

  try {
    const personaIds: string[] = []
    for (const p of ECKE_PERSONAS) {
      personaIds.push(await ensurePersonaUser(p))
    }
    const allUserIds = [ctx.braxId, ctx.ropeId, ctx.leatherId, ctx.shutterId, ...personaIds]

    const eventIdByTitle = await seedEckeCalendarEvents(ctx.braxId, ctx.orgId)
    if (!alphaMarkFn) {
      await seedEckeCommunityPlaces(ctx.braxId)
    }
    await seedEckeVendorShops(personaIds)
    await seedEckeProfilePhotos(allUserIds)
    await seedEckeConnectionMesh(allUserIds)
    await seedEckeRsvpsAndActivities(allUserIds, eventIdByTitle)
    const postIds = await seedEckeFeedPosts(allUserIds, eventIdByTitle)
    await seedEckePostActivities(postIds)
    await seedEckeOrgForum(ctx.orgId, allUserIds)
    if (ctx.previewConventionId) {
      await seedEckeConventionHub(ctx.previewConventionId, allUserIds)
    }

    console.log(
      `ECKE rich seed complete: ${ECKE_UPCOMING_EVENTS.length} events, ${ECKE_VENDORS.length} added vendors, ${postIds.length} feed posts, ${personaIds.length} personas.`,
    )
  } finally {
    alphaMarkFn = undefined
  }
}

async function seedEckeCalendarEvents(
  hostId: string,
  orgId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let added = 0
  for (const row of ECKE_UPCOMING_EVENTS) {
    const [ex] = await db.select().from(schema.events).where(eq(schema.events.title, row.title)).limit(1)
    if (ex) {
      map.set(row.title, ex.id)
      await markAlpha('event', ex.id, {
        isPublicSource: true,
        sourceType: 'ecke_event',
        sourceSlug: row.slug,
      })
      continue
    }
    const [ev] = await db
      .insert(schema.events)
      .values({
        hostId,
        organizationId: orgId,
        title: row.title,
        description: row.description,
        location: row.location,
        startsAt: new Date(row.startsAt),
        endsAt: new Date(row.endsAt),
        category: row.category,
        tags: ['eck-calendar', 'ecke-seed', ...row.slug.split('-').slice(0, 2)],
        eventFormat: 'in-person',
        ticketPurchaseUrl: `${ECKE_SOURCE}/events/${row.slug}`,
        ticketingProvider: 'external',
        rsvpCount: 0,
      })
      .returning()
    if (ev) {
      map.set(row.title, ev.id)
      await markAlpha('event', ev.id, {
        isPublicSource: true,
        sourceType: 'ecke_event',
        sourceSlug: row.slug,
      })
      added++
    }
  }
  console.log(`ECKE: ${added} calendar events (${map.size} total titles).`)
  return map
}

async function loadEastCoastDungeonLogoPaths(): Promise<Map<string, string>> {
  const eckeRoot = resolveEastCoastRepoRoot()
  if (!eckeRoot) return new Map()
  try {
    const mod = await import(pathToFileURL(path.join(eckeRoot, 'src/data/dungeons.js')).href)
    const raw = (mod.getAllDungeons?.() ?? mod.dungeons ?? []) as { slug: string; logo?: string }[]
    return new Map(raw.filter((d) => d.logo).map((d) => [d.slug, d.logo!]))
  } catch {
    return new Map()
  }
}

async function seedEckeCommunityPlaces(submittedByUserId: string) {
  const eckeRoot = resolveEastCoastRepoRoot()
  const logoPaths = await loadEastCoastDungeonLogoPaths()
  let added = 0
  let updated = 0
  for (const d of ECKE_DUNGEONS) {
    const slug = `ecke-${d.slug}`
    const logoPath = logoPaths.get(d.slug) ?? d.logoUrl ?? undefined
    const logoUrl =
      eckeRoot && logoPath ? syncEckeDungeonLogo(eckeRoot, d.slug, logoPath) : d.logoUrl ?? null
    const [ex] = await db
      .select()
      .from(schema.communityPlaces)
      .where(eq(schema.communityPlaces.slug, slug))
      .limit(1)
    if (ex) {
      if (logoUrl && logoUrl !== ex.logoUrl) {
        await db
          .update(schema.communityPlaces)
          .set({ logoUrl })
          .where(eq(schema.communityPlaces.id, ex.id))
        updated++
      }
      continue
    }
    await db.insert(schema.communityPlaces).values({
      name: d.name,
      slug,
      category: 'dungeon_club',
      description: d.description,
      city: d.location,
      logoUrl: logoUrl ?? undefined,
      status: 'published',
      submittedByUserId,
    })
    const [place] = await db
      .select({ id: schema.communityPlaces.id })
      .from(schema.communityPlaces)
      .where(eq(schema.communityPlaces.slug, slug))
      .limit(1)
    if (place) {
      await markAlpha('community_place', place.id, {
        isPublicSource: true,
        sourceType: 'ecke_dungeon',
        sourceSlug: d.slug,
      })
    }
    added++
  }
  if (added > 0 || updated > 0) {
    console.log(`ECKE: ${added} new, ${updated} updated community places (dungeons).`)
  }
}

async function ensureEckeVendorUser(v: EckeVendorRow): Promise<string> {
  const username = `shop-${v.slug}`.slice(0, 32)
  const [ex] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (ex) return ex.id
  const hash = await bcrypt.hash(DEMO_PASSWORD(), 10)
  const [user] = await db
    .insert(schema.users)
    .values({
      username,
      email: `${username}@ecke-vendor.local`,
      passwordHash: hash,
    })
    .returning()
  if (!user) throw new Error(`vendor user ${username}`)
  await db.insert(schema.profiles).values({
    userId: user.id,
    displayName: v.name,
    bio: v.bio,
    visibility: 'PUBLIC',
    verified: true,
    trustScore: 70,
    location: v.location,
  })
  await db.insert(schema.userSettings).values({
    userId: user.id,
    privacySettings: defaultPrivacySettings,
    notificationSettings: defaultNotificationSettings,
    feedSettings: defaultFeedSettings,
  })
  return user.id
}

async function seedEckeVendorShops(_personaIds: string[]) {
  let added = 0
  for (const v of ECKE_VENDORS) {
    const [ex] = await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.slug, v.slug)).limit(1)
    if (ex) continue
    const userId = await ensureEckeVendorUser(v)
    const taxonomy = resolveVendorCategoryTags({ categories: v.categories })
    const [vp] = await db
      .insert(schema.vendorProfiles)
      .values({
        userId,
        slug: v.slug,
        displayName: v.name,
        bio: `${v.bio} (Sourced from ${ECKE_SOURCE} vendor directory · C2K demo only.)`,
        bannerUrl: `https://picsum.photos/seed/ecke-v-${v.slug}/1600/420`,
        logoUrl: `https://picsum.photos/seed/ecke-vlogo-${v.slug}/320/320`,
        shopHeaderLayout: 'BELOW',
        category: taxonomy.category,
        tags: taxonomy.tags,
        categories: taxonomy.categories,
        rating: 4.2 + Math.random() * 0.7,
        shipsTo: 'US',
        website: v.website ?? ECKE_SOURCE,
        verified: true,
      })
      .returning()
    if (!vp) continue
    const listingUrl = v.website ?? ECKE_SOURCE
    await db.insert(schema.products).values([
      {
        vendorId: vp.id,
        title: `${v.categories[0] ?? 'Gear'}. Starter kit`,
        priceCents: 2499 + Math.floor(Math.random() * 5000),
        primaryImageUrl: `https://picsum.photos/seed/ecke-prod-${v.slug}-1/800/600`,
        listingUrl,
      },
      {
        vendorId: vp.id,
        title: `${v.name}. Convention special`,
        priceCents: 899 + Math.floor(Math.random() * 2000),
        primaryImageUrl: `https://picsum.photos/seed/ecke-prod-${v.slug}-2/800/600`,
        listingUrl,
      },
    ])
    await markAlpha('vendor_profile', vp.id, {
      isPublicSource: true,
      sourceType: 'ecke_vendor',
      sourceSlug: v.slug,
    })
    const prods = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.vendorId, vp.id))
    for (const prod of prods) {
      await markAlpha('product', prod.id, { isSynthetic: true, sourceType: 'ecke_vendor_product' })
    }
    added++
  }
  if (added > 0) console.log(`ECKE: ${added} vendor shops with products.`)
}

async function seedEckeProfilePhotos(userIds: string[]) {
  let photos = 0
  for (const userId of userIds) {
    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
    if (!profile) continue
    const [have] = await db
      .select()
      .from(schema.profilePhotos)
      .where(eq(schema.profilePhotos.profileId, profile.id))
      .limit(1)
    if (have) continue
    const [u] = await db.select({ username: schema.users.username }).from(schema.users).where(eq(schema.users.id, userId)).limit(1)
    const un = u?.username ?? 'user'
    await db.insert(schema.profilePhotos).values([
      {
        profileId: profile.id,
        url: `https://picsum.photos/seed/ecke-profile-${un}-1/800/800`,
        caption: 'Profile. Convention floor',
        sortOrder: 0,
      },
      {
        profileId: profile.id,
        url: `https://picsum.photos/seed/ecke-profile-${un}-2/800/800`,
        caption: 'Workshop day',
        sortOrder: 1,
      },
      {
        profileId: profile.id,
        url: `https://picsum.photos/seed/ecke-profile-${un}-3/800/800`,
        caption: 'Community night',
        sortOrder: 2,
      },
    ])
    photos += 3
  }
  if (photos > 0) console.log(`ECKE: ${photos} profile photos.`)
}

async function seedEckeConnectionMesh(userIds: string[]) {
  const hub = userIds[0]
  let edges = 0
  for (let i = 1; i < userIds.length; i++) {
    const other = userIds[i]
    const [ex] = await db
      .select()
      .from(schema.connections)
      .where(
        and(eq(schema.connections.requesterId, hub), eq(schema.connections.recipientId, other)),
      )
      .limit(1)
    if (!ex) {
      await db.insert(schema.connections).values({
        requesterId: hub,
        recipientId: other,
        status: 'ACCEPTED',
      })
      edges++
      await insertFeedActivity({
        actorId: hub,
        verb: 'connection_accepted',
        objectType: 'connection',
        objectId: other,
        metadata: { seed: 'ecke' },
      })
    }
  }
  for (let i = 2; i < Math.min(userIds.length, 8); i++) {
    const a = userIds[i]
    const b = userIds[i + 3] ?? userIds[1]
    if (!b || a === b) continue
    const [ex] = await db
      .select()
      .from(schema.connections)
      .where(and(eq(schema.connections.requesterId, a), eq(schema.connections.recipientId, b)))
      .limit(1)
    if (!ex) {
      await db.insert(schema.connections).values({
        requesterId: a,
        recipientId: b,
        status: 'ACCEPTED',
      })
      edges++
    }
  }
  console.log(`ECKE: ${edges} new connection edges (Following graph).`)
}

async function seedEckeRsvpsAndActivities(userIds: string[], eventIdByTitle: Map<string, string>) {
  const titles = [...eventIdByTitle.keys()].slice(0, 18)
  let rsvps = 0
  let acts = 0
  for (let i = 0; i < userIds.length; i++) {
    const uid = userIds[i]
    for (let j = 0; j < 3; j++) {
      const title = titles[(i + j) % titles.length]
      const eventId = eventIdByTitle.get(title)
      if (!eventId) continue
      const [ex] = await db
        .select()
        .from(schema.eventRsvps)
        .where(and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, uid)))
        .limit(1)
      if (ex) continue
      await db.insert(schema.eventRsvps).values({
        eventId,
        userId: uid,
        status: j === 0 ? 'going' : 'maybe',
      })
      rsvps++
      await insertFeedActivity({
        actorId: uid,
        verb: 'event_rsvp',
        objectType: 'event',
        objectId: eventId,
        metadata: { eventTitle: title, status: j === 0 ? 'going' : 'maybe' },
      })
      acts++
    }
  }
  for (const eventId of [...new Set(eventIdByTitle.values())].slice(0, 12)) {
    await refreshEventRsvpCount(eventId)
  }
  console.log(`ECKE: ${rsvps} RSVPs, ${acts} event_rsvp activities.`)
}

type PostSeed = { id: string; authorId: string }

async function seedEckeFeedPosts(
  userIds: string[],
  eventIdByTitle: Map<string, string>,
): Promise<PostSeed[]> {
  const have = await db.select().from(schema.feedPosts).where(eq(schema.feedPosts.bodyFormat, 'html')).limit(5)
  if (have.length >= 5) {
    const rows = await db
      .select({ id: schema.feedPosts.id, authorId: schema.feedPosts.authorId })
      .from(schema.feedPosts)
      .limit(80)
    return rows
  }

  const eventTitles = [...eventIdByTitle.keys()]
  const templates: {
    kind: 'status' | 'article'
    title?: string
    body: string
    withImage?: boolean
  }[] = [
    {
      kind: 'status',
      body: '<p>Calendar is live. Who else is heading to <strong>TESFest</strong> this July? Hotel block closes soon on the organiser site.</p>',
      withImage: true,
    },
    {
      kind: 'article',
      title: 'Packing for a summer con weekend',
      body: '<p>My carry-on checklist after ten years on the circuit: shears, nitrile, water bottle, layer for arctic hotel AC, and a paper copy of medical info.</p>',
      withImage: true,
    },
    {
      kind: 'status',
      body: '<p>Just pinned <strong>Dark Odyssey Fusion</strong> · Maryland friends, see you in June.</p>',
    },
    {
      kind: 'article',
      title: 'Journal: first vendor table',
      body: '<p>Table layout matters: vertical banner behind you, touchable samples in front, payment QR at eye level. Thank you to everyone who stopped by at Naughty N\'at.</p>',
      withImage: true,
    },
    {
      kind: 'status',
      body: '<p>Reminder: <strong>Camp Crucible</strong> volunteer shifts posted · DM if you want door training.</p>',
    },
    {
      kind: 'status',
      body: '<p>Photos from last weekend\'s munch. Consent check-ins at the door made a huge difference.</p>',
      withImage: true,
    },
    {
      kind: 'article',
      title: 'Dungeon etiquette notes',
      body: '<p>Watch scene traffic, don\'t spectate without invitation, and leave impact zones clear. Baltimore Playhouse first-timer nights are a great on-ramp.</p>',
    },
    {
      kind: 'status',
      body: '<p>Who\'s doing <strong>Elevation Rope</strong>? Looking for practice partners for partial suspensions.</p>',
    },
  ]

  const out: PostSeed[] = []
  let h = 2
  for (let i = 0; i < 48; i++) {
    const authorId = userIds[i % userIds.length]
    const t = templates[i % templates.length]
    const evTitle = eventTitles[i % eventTitles.length]
    const body =
      i % 4 === 0 ?
        `<p>Thinking about <strong>${evTitle}</strong>. Tickets on ${ECKE_SOURCE}.</p>`
      : t.body
    const [u] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, authorId))
      .limit(1)
    const un = u?.username ?? 'user'
    const attachments =
      t.withImage || i % 3 === 0 ?
        [{ type: 'image' as const, url: `https://picsum.photos/seed/ecke-feed-${un}-${i}/900/600` }]
      : []
    const [row] = await db
      .insert(schema.feedPosts)
      .values({
        authorId,
        kind: t.kind,
        title: t.kind === 'article' ? t.title ?? `Notes from the road` : null,
        body,
        bodyFormat: 'html',
        attachments,
        mentions: [],
        createdAt: hoursAgo(h),
        updatedAt: hoursAgo(h),
      })
      .returning()
    if (row) {
      out.push({ id: row.id, authorId })
      await markAlpha('feed_post', row.id, { isSynthetic: true, sourceType: 'ecke_feed' })
      h += 2 + (i % 5)
    }
  }

  if (out.length >= 2) {
    const [repost] = await db
      .insert(schema.feedPosts)
      .values({
        authorId: userIds[1],
        kind: 'repost',
        body: '',
        bodyFormat: 'text',
        repostOfId: out[0].id,
        attachments: [],
        mentions: [],
        createdAt: hoursAgo(1),
        updatedAt: hoursAgo(1),
      })
      .returning()
    if (repost) {
      out.push({ id: repost.id, authorId: userIds[1] })
      await markAlpha('feed_post', repost.id, { isSynthetic: true, sourceType: 'ecke_feed' })
    }
  }

  console.log(`ECKE: ${out.length} feed posts (status, articles, images, repost).`)
  return out
}

async function seedEckePostActivities(posts: PostSeed[]) {
  let n = 0
  for (const p of posts) {
    if (p.id) {
      await insertFeedActivity({
        actorId: p.authorId,
        verb: 'post',
        objectType: 'feed_post',
        objectId: p.id,
      })
      n++
    }
  }
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (org) {
    await insertFeedActivity({
      actorId: posts[0]?.authorId ?? org.ownerId,
      verb: 'org_announcement',
      objectType: 'organization',
      objectId: org.id,
      metadata: { title: 'Summer calendar on C2K' },
    })
    n++
  }
  const [group] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.slug, 'mid-atlantic-rope-social'))
    .limit(1)
  if (group) {
    await insertFeedActivity({
      actorId: posts[0]?.authorId ?? group.ownerId,
      verb: 'group_join',
      objectType: 'group',
      objectId: group.id,
    })
    n++
  }
  const [conv] = await db
    .select()
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, 'preview-c2k-weekend'))
    .limit(1)
  if (conv) {
    for (const uid of [posts[0]?.authorId, posts[2]?.authorId].filter(Boolean) as string[]) {
      await insertFeedActivity({
        actorId: uid,
        verb: 'convention_pin',
        objectType: 'convention',
        objectId: conv.id,
      })
      n++
    }
  }
  console.log(`ECKE: ${n} feed_activities rows.`)
}

async function seedEckeOrgForum(orgId: string, userIds: string[]) {
  const threads = [
    { title: 'TESFest room share thread', body: 'Splitting a king room Friday–Sunday. Non-smoking, quiet after midnight.' },
    { title: 'ECKE calendar favorites this fall', body: 'What cons are you marking from the public listing? I\'m torn between FORNUCOPIA and MsC.' },
    { title: 'Vendor hall tips', body: 'Bring cash for small makers; card readers die when the hotel Wi-Fi flakes.' },
    { title: 'First dungeon night advice', body: 'Kink First Contact vs regular party. Which did you start with?' },
    { title: 'Rope practice partners · Mid-Atlantic', body: 'Weekly skill share in Philly/Baltimore corridor. Reply with your metro.' },
  ]
  let posts = 0
  for (const th of threads) {
    const [ex] = await db
      .select()
      .from(schema.forumThreads)
      .where(and(eq(schema.forumThreads.organizationId, orgId), eq(schema.forumThreads.title, th.title)))
      .limit(1)
    if (ex) continue
    const author = userIds[posts % userIds.length]
    const [thread] = await db
      .insert(schema.forumThreads)
      .values({
        organizationId: orgId,
        authorId: author,
        title: th.title,
      })
      .returning()
    if (!thread) continue
    await markAlpha('forum_thread', thread.id, { isSynthetic: true, sourceType: 'ecke_forum' })
    const [op] = await db
      .insert(schema.forumPosts)
      .values({
        threadId: thread.id,
        authorId: author,
        body: th.body,
      })
      .returning()
    if (op) await markAlpha('forum_post', op.id, { isSynthetic: true, sourceType: 'ecke_forum' })
    for (let r = 0; r < 2; r++) {
      const [reply] = await db
        .insert(schema.forumPosts)
        .values({
          threadId: thread.id,
          authorId: userIds[(posts + r + 1) % userIds.length],
          body: `Reply ${r + 1}: +1. See you on the calendar.`,
        })
        .returning()
      if (reply) await markAlpha('forum_post', reply.id, { isSynthetic: true, sourceType: 'ecke_forum' })
    }
    posts++
  }
  if (posts > 0) console.log(`ECKE: ${posts} forum threads with replies.`)
}

async function seedEckeConventionHub(conventionId: string, userIds: string[]) {
  const channels = [
    { slug: 'general', name: 'general', kind: 'CHAT' },
    { slug: 'announcements', name: 'announcements', kind: 'ANNOUNCEMENTS' },
  ]
  const channelIds: string[] = []
  for (const ch of channels) {
    let [row] = await db
      .select()
      .from(schema.conventionHubChannels)
      .where(
        and(
          eq(schema.conventionHubChannels.conventionId, conventionId),
          eq(schema.conventionHubChannels.slug, ch.slug),
        ),
      )
      .limit(1)
    if (!row) {
      const [ins] = await db
        .insert(schema.conventionHubChannels)
        .values({
          conventionId,
          slug: ch.slug,
          name: ch.name,
          kind: ch.kind,
          sortOrder: ch.slug === 'announcements' ? 0 : 1,
        })
        .returning()
      row = ins
    }
    if (row) {
      channelIds.push(row.id)
      await markAlpha('convention_hub_channel', row.id, { isSynthetic: true, sourceType: 'ecke_hub' })
    }
  }

  const snippets = [
    'Hub is open for preview weekend. Ask logistics here.',
    'Reminder: badge pickup opens at 10am in the main lobby.',
    'Volunteer desk still needs two people for Saturday door.',
    'Anyone bringing a vendor table for rope supplies?',
    'Hotel Wi-Fi password is at the front desk. Do not share in public channels.',
    'Aftercare room is room 214. Snacks replenished hourly.',
    'Photo policy: ask before shooting in the dungeon wing.',
    'Shuttle from the airport leaves at 2pm from zone B.',
  ]
  let msgs = 0
  for (let i = 0; i < snippets.length; i++) {
    const channelId = channelIds[i % channelIds.length]
    const senderId = userIds[i % userIds.length]
    const [msg] = await db
      .insert(schema.conventionHubChannelMessages)
      .values({
        channelId,
        senderId,
        body: snippets[i],
        createdAt: hoursAgo(24 - i * 2),
      })
      .returning()
    if (msg) await markAlpha('convention_hub_message', msg.id, { isSynthetic: true, sourceType: 'ecke_hub' })
    msgs++
  }
  if (msgs > 0) console.log(`ECKE: ${msgs} convention hub chat messages.`)
}
