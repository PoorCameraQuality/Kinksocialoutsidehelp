/**
 * Alpha demo ECKE importer — append-only, reversible via clear-alpha-seed.ts
 * Run: ALLOW_ALPHA_SEED=true USE_DATABASE=true npm run db:seed:alpha:ecke -w @c2k/api
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import bcrypt from 'bcryptjs'
import { and, count, eq, inArray, like, or } from 'drizzle-orm'
import {
  defaultFeedSettings,
  defaultNotificationSettings,
  defaultPrivacySettings,
} from '@c2k/shared'
import './load-dev-env.js'
import {
  ALPHA_ECKE_BATCH_KEY,
  createAlphaSeedMarker,
  ensureAlphaSeedBatch,
} from '../lib/alpha-seed-labels.js'
import { assertAlphaSeedAllowed } from '../lib/alpha-seed-guard.js'
import { refreshEventRsvpCount } from '../lib/event-rsvp-helpers.js'
import { serializeOrgFeatureFlags, venueOrgFeatureFlags } from '../lib/org-features.js'
import { resolveVendorCategoryTags } from '../lib/vendor-public-dto.js'
import {
  ECKE_DUNGEONS,
  ECKE_SOURCE,
  ECKE_UPCOMING_EVENTS,
  ECKE_VENDORS,
  type EckeDungeonRow,
  type EckeEventRow,
  type EckeVendorRow,
} from './ecke-catalog.js'
import { importEckeEducation, loadEastCoastEducation } from './ecke-seed-education.js'
import { seedEckeRichExperience } from './ecke-rich-seed.js'
import {
  countSyncedEckeAssets,
  resolveEastCoastRepoRoot,
  rollEckeEventDatesToFuture,
  syncEckeDungeonLogo,
  syncEckeEventImage,
  syncEckeVendorLogo,
  syncEckeVendorProductImage,
} from './ecke-seed-images.js'
import { db, schema } from './index.js'

const PAF_ORG_SLUG = 'primal-arts-festival'
const PAF_CON_SLUG = 'primal-arts-fest-2026'
const PAF_ANCHOR_TITLE = 'Primal Arts Festival 2026 (alpha demo)'
const PAF_MUNCH_TITLE = 'Corridor Munch (alpha demo)'
const PAF_CHAT_CHANNEL_SLUG = 'general-event-chat'
const PAF_FORUM_MARKER = 'alpha-ecke-paf-forum:'
const PAF_CHAT_MARKER = 'alpha-ecke-paf-chat:'
const PAF_PUBLIC_SITE = 'https://www.primalartsfest.com/'
const DEMO_ORG_SLUG = 'demo-east-collective'
const MAX_EVENTS = 35
const MAX_DUNGEONS = 15
const MAX_VENDORS = 10

type EastCoastEvent = {
  name: string
  slug: string
  date: { start: string; end: string; display?: string }
  location: { city?: string; state?: string; region?: string }
  category: string
  excerpt?: string
  longDescription?: string
  website?: string
  organizer?: string
  venue?: string
  hotel?: string
  features?: string[]
  logo?: string
}

type EastCoastDungeon = {
  name: string
  slug: string
  location: { city?: string; state?: string; address?: string }
  category?: string
  excerpt?: string
  description?: { long?: string }
  website?: string
  logo?: string
}

type EastCoastVendor = {
  name: string
  slug: string
  location: string
  description: string
  story?: string
  websiteUrl?: string
  tagSlugs?: string[]
  logo125Url?: string
  productImage125ByTagSlug?: Record<string, string>
}

type PafSlot = {
  startsAt: string
  endsAt: string
  title: string
  track?: string
  room?: string
  sortOrder: number
  description?: string
}

function resolveEastCoastRoot(): string | null {
  return resolveEastCoastRepoRoot()
}

function mapEastCoastEvent(row: EastCoastEvent, eckeRoot: string | null): EckeEventRow {
  const cityState = [row.location?.city, row.location?.state].filter(Boolean).join(', ')
  const venueBit = row.venue ? ` · ${row.venue}` : ''
  const hotelBit = row.hotel ? `\n\nHotel: ${row.hotel}` : ''
  const featuresBit =
    row.features?.length ? `\n\nHighlights:\n${row.features.map((f) => `• ${f}`).join('\n')}` : ''
  const body = row.longDescription ?? row.excerpt ?? ''
  const official = row.website ?? `${ECKE_SOURCE}/events/${row.slug}`

  const rolled = rollEckeEventDatesToFuture(row.date.start, row.date.end)
  const imageUrl = eckeRoot ? syncEckeEventImage(eckeRoot, row.slug, row.logo) : null

  return {
    title: row.name,
    location: `${cityState}${venueBit}`,
    startsAt: rolled.startsAt,
    endsAt: rolled.endsAt,
    slug: row.slug,
    category: row.category,
    description: `${body}${featuresBit}${hotelBit}\n\nOfficial listing: ${official}\nDirectory: ${ECKE_SOURCE}/events/${row.slug}`,
    imageUrl,
  }
}

async function loadEastCoastEvents(): Promise<{ rows: EckeEventRow[]; source: string }> {
  const root = resolveEastCoastRoot()
  if (!root) {
    console.log('EastCoast repo not found; using ecke-catalog fallback for events.')
    const rows = ECKE_UPCOMING_EVENTS.slice(0, MAX_EVENTS).map((row) => {
      const rolled = rollEckeEventDatesToFuture(row.startsAt.slice(0, 10), row.endsAt.slice(0, 10))
      return { ...row, startsAt: rolled.startsAt, endsAt: rolled.endsAt }
    })
    return { rows, source: 'ecke-catalog' }
  }

  try {
    const mod = await import(pathToFileURL(path.join(root, 'src/data/events.js')).href)
    const raw: EastCoastEvent[] = mod.getAllEvents?.() ?? mod.events ?? []
    const now = new Date()
    const mapped = raw.map((e) => mapEastCoastEvent(e, root))
    const upcoming = mapped
      .filter((e) => new Date(e.endsAt) >= now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, MAX_EVENTS)
    const withImages = upcoming.filter((e) => e.imageUrl).length
    console.log(
      `Loaded ${upcoming.length} upcoming events from ${root} (${withImages} with logos, ${countSyncedEckeAssets(root)} assets available).`,
    )
    return { rows: upcoming, source: root }
  } catch (err) {
    console.warn('EastCoast events import failed; using catalog fallback.', err)
    return { rows: ECKE_UPCOMING_EVENTS.slice(0, MAX_EVENTS), source: 'ecke-catalog' }
  }
}

async function loadEastCoastDungeons(): Promise<EckeDungeonRow[]> {
  const root = resolveEastCoastRoot()
  if (!root) return ECKE_DUNGEONS.slice(0, MAX_DUNGEONS)

  try {
    const mod = await import(pathToFileURL(path.join(root, 'src/data/dungeons.js')).href)
    const raw: EastCoastDungeon[] = mod.getAllDungeons?.() ?? mod.dungeons ?? []
    const mapped = raw.slice(0, MAX_DUNGEONS).map((d) => ({
      name: d.name,
      slug: d.slug,
      location: [d.location?.city, d.location?.state].filter(Boolean).join(', '),
      category: d.category ?? 'BDSM Dungeon',
      description: `${d.description?.long ?? d.excerpt ?? ''}\n\n${d.website ?? `${ECKE_SOURCE}/dungeons/${d.slug}`}`,
      logoUrl: syncEckeDungeonLogo(root, d.slug, d.logo),
      website: d.website ?? `${ECKE_SOURCE}/dungeons/${d.slug}`,
    }))
    const withLogos = mapped.filter((d) => d.logoUrl).length
    console.log(`Loaded ${mapped.length} dungeons from ${root} (${withLogos} with logos).`)
    return mapped
  } catch {
    return ECKE_DUNGEONS.slice(0, MAX_DUNGEONS)
  }
}

async function loadEastCoastVendors(): Promise<EckeVendorRow[]> {
  const root = resolveEastCoastRoot()
  if (!root) return ECKE_VENDORS.slice(0, MAX_VENDORS)

  try {
    const mod = await import(pathToFileURL(path.join(root, 'src/data/vendors.js')).href)
    const raw: EastCoastVendor[] = mod.getAllVendors?.() ?? mod.vendors ?? []
    return raw.slice(0, MAX_VENDORS).map((v) => {
      const productPath = v.productImage125ByTagSlug?.default ?? v.productImage125ByTagSlug?.[v.tagSlugs?.[0] ?? '']
      return {
        name: v.name,
        slug: v.slug,
        bio: v.story ?? v.description,
        location: v.location,
        categories: (v.tagSlugs ?? ['gear']).slice(0, 4).map((t) => t.replace(/-/g, ' ')),
        website: v.websiteUrl,
        logoUrl: root ? syncEckeVendorLogo(root, v.slug, v.logo125Url) : null,
        productImageUrl: root ? syncEckeVendorProductImage(root, v.slug, productPath, 1) : null,
      }
    })
  } catch {
    return ECKE_VENDORS.slice(0, MAX_VENDORS)
  }
}

function loadPafSlots(): PafSlot[] {
  const root = resolveEastCoastRoot()
  if (!root) return []

  const jsonPath = path.join(root, 'data/paf26-program-slots.json')
  if (!existsSync(jsonPath)) return []

  try {
    const parsed = JSON.parse(readFileSync(jsonPath, 'utf8')) as { slots?: PafSlot[] }
    return parsed.slots ?? []
  } catch (err) {
    console.warn('PAF slot JSON read failed.', err)
    return []
  }
}

async function resolveDemoActors() {
  const [brax] = await db.select().from(schema.users).where(eq(schema.users.username, 'Brax')).limit(1)
  const [rope] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)
  const [leather] = await db.select().from(schema.users).where(eq(schema.users.username, 'LeatherCraftDemo')).limit(1)
  const [shutter] = await db.select().from(schema.users).where(eq(schema.users.username, 'ShutterSeed')).limit(1)
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, DEMO_ORG_SLUG)).limit(1)

  if (!brax || !rope || !leather || !shutter || !org) {
    throw new Error(
      'Base demo seed missing (Brax, RopeDreamer, LeatherCraftDemo, ShutterSeed, demo-east-collective). Run npm run db:seed first.',
    )
  }

  return { braxId: brax.id, ropeId: rope.id, leatherId: leather.id, shutterId: shutter.id, orgId: org.id }
}

function parseDungeonLocation(location: string): { city: string | null; region: string | null } {
  if (!location?.trim()) return { city: null, region: null }
  const parts = location.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) return { city: parts[0] ?? null, region: parts[1] ?? null }
  return { city: location.trim(), region: null }
}

function dungeonOrgFeatureFlags() {
  return venueOrgFeatureFlags({ subgroupsEnabled: true, chatEnabled: false })
}

/** Import ECKE dungeons as managed organizations (primary operational home). */
async function importDungeonOrganizations(
  mark: ReturnType<typeof createAlphaSeedMarker>,
  ownerId: string,
  dungeons: EckeDungeonRow[],
): Promise<Map<string, string>> {
  const orgIdByEckeSlug = new Map<string, string>()
  let added = 0
  let updated = 0

  for (const d of dungeons) {
    const featureFlags = dungeonOrgFeatureFlags()
    const patch = {
      displayName: d.name,
      bio: d.description,
      logoUrl: d.logoUrl ?? undefined,
      externalSiteUrl: d.website ?? null,
      featureFlags,
    }
    const [ex] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, d.slug)).limit(1)
    if (ex) {
      await db.update(schema.organizations).set(patch).where(eq(schema.organizations.id, ex.id))
      await mark({
        targetType: 'organization',
        targetId: ex.id,
        isPublicSource: true,
        sourceType: 'ecke_dungeon',
        sourceSlug: d.slug,
      })
      orgIdByEckeSlug.set(d.slug, ex.id)
      updated++
      continue
    }

    const [org] = await db
      .insert(schema.organizations)
      .values({
        slug: d.slug,
        displayName: d.name,
        bio: d.description,
        bioFormat: 'text',
        ownerId,
        visibility: 'PUBLIC',
        logoUrl: d.logoUrl ?? undefined,
        externalSiteUrl: d.website ?? null,
        featureFlags,
        galleryPublic: false,
        community: {
          emailListHeadline: `${d.name} on Kink.Social`,
          emailListBlurb: `Map listing imported from ${ECKE_SOURCE}. Confirm hours, policies, and events with the venue directly.`,
        },
      })
      .returning()
    if (!org) continue

    await db.insert(schema.organizationMembers).values({
      organizationId: org.id,
      userId: ownerId,
      role: 'OWNER',
    })
    await mark({
      targetType: 'organization',
      targetId: org.id,
      isPublicSource: true,
      sourceType: 'ecke_dungeon',
      sourceSlug: d.slug,
    })
    orgIdByEckeSlug.set(d.slug, org.id)
    added++
  }

  console.log(`Alpha ECKE: ${added} new, ${updated} updated dungeon organizations (${dungeons.length} considered).`)
  return orgIdByEckeSlug
}

async function importPublicEvents(
  mark: ReturnType<typeof createAlphaSeedMarker>,
  hostId: string,
  orgId: string,
  events: EckeEventRow[],
) {
  let added = 0
  let updated = 0
  for (const row of events) {
    const [ex] = await db.select().from(schema.events).where(eq(schema.events.title, row.title)).limit(1)
    const patch = {
      startsAt: new Date(row.startsAt),
      endsAt: new Date(row.endsAt),
      location: row.location,
      description: row.description,
      ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
    }
    if (ex) {
      await db.update(schema.events).set(patch).where(eq(schema.events.id, ex.id))
      await mark({
        targetType: 'event',
        targetId: ex.id,
        isPublicSource: true,
        sourceType: 'ecke_event',
        sourceSlug: row.slug,
      })
      updated++
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
        startsAt: patch.startsAt,
        endsAt: patch.endsAt,
        category: row.category,
        tags: ['alpha-ecke', 'ecke-import', row.slug.split('-')[0] ?? 'event'],
        eventFormat: 'in-person',
        ticketPurchaseUrl: `${ECKE_SOURCE}/events/${row.slug}`,
        ticketingProvider: 'external',
        rsvpCount: 0,
        imageUrl: row.imageUrl ?? undefined,
      })
      .returning()
    if (ev) {
      await mark({
        targetType: 'event',
        targetId: ev.id,
        isPublicSource: true,
        sourceType: 'ecke_event',
        sourceSlug: row.slug,
      })
      added++
    }
  }
  console.log(`Alpha ECKE: ${added} new, ${updated} updated public events (${events.length} considered).`)
}

async function importCommunityPlaces(
  mark: ReturnType<typeof createAlphaSeedMarker>,
  submittedByUserId: string,
  dungeons: EckeDungeonRow[],
  orgIdByEckeSlug: Map<string, string>,
) {
  let added = 0
  let updated = 0
  for (const d of dungeons) {
    const slug = `alpha-ecke-${d.slug}`
    const { city, region } = parseDungeonLocation(d.location)
    const linkedOrganizationId = orgIdByEckeSlug.get(d.slug)
    const mapDescription = linkedOrganizationId
      ? `Map pin for ${d.name}. This venue is managed as an organization on Kink.Social — open the org hub for events, forums, and updates.`
      : d.description
    const patch = {
      name: d.name,
      description: mapDescription,
      city,
      region,
      country: region && region.length === 2 ? 'USA' : null,
      logoUrl: d.logoUrl ?? undefined,
      linkedOrganizationId: linkedOrganizationId ?? null,
    }
    const [ex] = await db.select().from(schema.communityPlaces).where(eq(schema.communityPlaces.slug, slug)).limit(1)
    if (ex) {
      await db.update(schema.communityPlaces).set(patch).where(eq(schema.communityPlaces.id, ex.id))
      await mark({
        targetType: 'community_place',
        targetId: ex.id,
        isPublicSource: true,
        sourceType: 'ecke_dungeon',
        sourceSlug: d.slug,
      })
      updated++
      continue
    }

    const [place] = await db
      .insert(schema.communityPlaces)
      .values({
        name: d.name,
        slug,
        category: 'dungeon_club',
        description: mapDescription,
        city,
        region,
        country: region && region.length === 2 ? 'USA' : null,
        logoUrl: d.logoUrl ?? undefined,
        linkedOrganizationId: linkedOrganizationId ?? undefined,
        status: 'published',
        submittedByUserId,
      })
      .returning()
    if (place) {
      await mark({
        targetType: 'community_place',
        targetId: place.id,
        isPublicSource: true,
        sourceType: 'ecke_dungeon',
        sourceSlug: d.slug,
      })
      added++
    }
  }
  console.log(`Alpha ECKE: ${added} new, ${updated} updated map places (${dungeons.length} considered).`)
}

async function removeLegacyEckeDungeonListingEvents() {
  const legacy = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(like(schema.events.title, '% (ECKE listing)'))
  if (legacy.length === 0) return
  const ids = legacy.map((r) => r.id)
  await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.eventId, ids))
  await db.delete(schema.events).where(inArray(schema.events.id, ids))
  console.log(`Alpha ECKE: removed ${legacy.length} legacy dungeon-as-event listings.`)
}

async function ensureAlphaVendorUser(v: EckeVendorRow, mark: ReturnType<typeof createAlphaSeedMarker>) {
  const username = `shop-${v.slug}`.slice(0, 32)
  const [ex] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (ex) {
    await mark({ targetType: 'user', targetId: ex.id, isSynthetic: true, sourceType: 'ecke_vendor_user', sourceSlug: v.slug })
    return ex.id
  }

  const hash = await bcrypt.hash(process.env.DEMO_LOGIN_PASSWORD ?? 'demo', 10)
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
    verified: false,
    trustScore: 65,
    location: v.location,
  })
  await db.insert(schema.userSettings).values({
    userId: user.id,
    privacySettings: defaultPrivacySettings,
    notificationSettings: defaultNotificationSettings,
    feedSettings: defaultFeedSettings,
  })
  await mark({ targetType: 'user', targetId: user.id, isSynthetic: true, sourceType: 'ecke_vendor_user', sourceSlug: v.slug })
  return user.id
}

async function importVendors(mark: ReturnType<typeof createAlphaSeedMarker>, vendors: EckeVendorRow[]) {
  let added = 0
  let updated = 0
  for (const v of vendors) {
    const bannerUrl = v.logoUrl ?? `https://picsum.photos/seed/alpha-v-${v.slug}/1600/420`
    const logoUrl = v.logoUrl ?? `https://picsum.photos/seed/alpha-vlogo-${v.slug}/320/320`
    const productImage =
      v.productImageUrl ?? v.logoUrl ?? `https://picsum.photos/seed/alpha-prod-${v.slug}-1/800/600`

    const [ex] = await db.select().from(schema.vendorProfiles).where(eq(schema.vendorProfiles.slug, v.slug)).limit(1)
    if (ex) {
      await db
        .update(schema.vendorProfiles)
        .set({ bannerUrl, logoUrl, bio: `${v.bio}\n\nPublic vendor listing imported for alpha display. Shop products below are synthetic demo items.` })
        .where(eq(schema.vendorProfiles.id, ex.id))
      const prods = await db.select().from(schema.products).where(eq(schema.products.vendorId, ex.id)).limit(2)
      for (const [i, prod] of prods.entries()) {
        await db
          .update(schema.products)
          .set({ primaryImageUrl: i === 0 ? productImage : v.logoUrl ?? productImage })
          .where(eq(schema.products.id, prod.id))
      }
      await mark({
        targetType: 'vendor_profile',
        targetId: ex.id,
        isPublicSource: true,
        sourceType: 'ecke_vendor',
        sourceSlug: v.slug,
      })
      updated++
      continue
    }

    const userId = await ensureAlphaVendorUser(v, mark)
    const taxonomy = resolveVendorCategoryTags({ categories: v.categories })
    const [vp] = await db
      .insert(schema.vendorProfiles)
      .values({
        userId,
        slug: v.slug,
        displayName: v.name,
        bio: `${v.bio}\n\nPublic vendor listing imported for alpha display. Shop products below are synthetic demo items.`,
        bannerUrl,
        logoUrl,
        shopHeaderLayout: 'BELOW',
        category: taxonomy.category,
        tags: taxonomy.tags,
        categories: taxonomy.categories,
        rating: 4.3,
        shipsTo: 'US',
        website: v.website ?? ECKE_SOURCE,
        verified: false,
      })
      .returning()
    if (!vp) continue

    const listingUrl = v.website ?? ECKE_SOURCE
    const products = await db
      .insert(schema.products)
      .values([
        {
          vendorId: vp.id,
          title: `${v.categories[0] ?? 'Gear'} · demo listing`,
          priceCents: 2999,
          primaryImageUrl: productImage,
          listingUrl,
        },
        {
          vendorId: vp.id,
          title: `${v.name} · convention bundle (demo)`,
          priceCents: 1499,
          primaryImageUrl: v.logoUrl ?? productImage,
          listingUrl,
        },
      ])
      .returning()

    await mark({
      targetType: 'vendor_profile',
      targetId: vp.id,
      isPublicSource: true,
      sourceType: 'ecke_vendor',
      sourceSlug: v.slug,
    })
    for (const prod of products) {
      await mark({ targetType: 'product', targetId: prod.id, isSynthetic: true, sourceType: 'alpha_vendor_product' })
    }
    added++
  }
  console.log(`Alpha ECKE: ${added} new, ${updated} updated vendor shops.`)
}

async function ensureOrgMember(
  orgId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'STAFF' | 'MEMBER',
  listed = false,
) {
  const [ex] = await db
    .select()
    .from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.organizationId, orgId), eq(schema.organizationMembers.userId, userId)))
    .limit(1)
  if (ex) return
  await db.insert(schema.organizationMembers).values({
    organizationId: orgId,
    userId,
    role,
    listedInOrgDirectory: listed,
  })
}

async function ensureAlphaPatronUser(
  mark: ReturnType<typeof createAlphaSeedMarker>,
  username: string,
  email: string,
  displayName: string,
): Promise<string> {
  const [ex] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (ex) {
    await mark({ targetType: 'user', targetId: ex.id, isSynthetic: true, sourceType: 'paf_patron', sourceSlug: username })
    return ex.id
  }
  const hash = await bcrypt.hash(process.env.DEMO_LOGIN_PASSWORD ?? 'demo', 10)
  const [user] = await db
    .insert(schema.users)
    .values({ username, email, passwordHash: hash })
    .returning()
  if (!user) throw new Error(`Could not create patron ${username}`)
  await db.insert(schema.profiles).values({
    userId: user.id,
    displayName,
    bio: 'Seeded attendee for Primal Arts Fest alpha demo.',
    visibility: 'PUBLIC',
    trustScore: 62,
  })
  await db.insert(schema.userSettings).values({
    userId: user.id,
    privacySettings: defaultPrivacySettings,
    notificationSettings: defaultNotificationSettings,
    feedSettings: defaultFeedSettings,
  })
  await mark({ targetType: 'user', targetId: user.id, isSynthetic: true, sourceType: 'paf_patron', sourceSlug: username })
  return user.id
}

/** Members, forums, chat, gallery, munch, and RSVPs for the PAF org hub overview. */
async function seedPafOrgHubActivity(
  mark: ReturnType<typeof createAlphaSeedMarker>,
  params: {
    orgId: string
    anchorEventId: string
    hostId: string
    ropeId: string
    leatherId: string
    shutterId: string
  },
) {
  const { orgId, anchorEventId, hostId, ropeId, leatherId, shutterId } = params

  await ensureOrgMember(orgId, hostId, 'OWNER', true)
  await ensureOrgMember(orgId, ropeId, 'ADMIN', true)
  await ensureOrgMember(orgId, leatherId, 'MODERATOR', true)
  await ensureOrgMember(orgId, shutterId, 'MEMBER', true)

  const patronA = await ensureAlphaPatronUser(mark, 'PafPatronA', 'paf-patron-a@demo.local', 'River Ash')
  const patronB = await ensureAlphaPatronUser(mark, 'PafPatronB', 'paf-patron-b@demo.local', 'Ember Vale')
  const patronC = await ensureAlphaPatronUser(mark, 'PafPatronC', 'paf-patron-c@demo.local', 'Slate North')
  for (const uid of [patronA, patronB, patronC]) {
    await ensureOrgMember(orgId, uid, 'MEMBER')
  }

  const hubFlags = serializeOrgFeatureFlags({
    calendarEnabled: true,
    forumsEnabled: true,
    chatEnabled: true,
    subgroupsEnabled: true,
  })
  const [orgRow] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1)
  const curCommunity =
    orgRow?.community && typeof orgRow.community === 'object' && !Array.isArray(orgRow.community) ?
      { ...(orgRow.community as Record<string, unknown>) }
    : {}
  await db
    .update(schema.organizations)
    .set({
      featureFlags: hubFlags,
      galleryPublic: true,
      community: {
        ...curCommunity,
        communityModules: [
          {
            id: 'paf-alpha-announcements',
            type: 'announcements',
            enabled: true,
            title: 'Announcements',
            items: [
              {
                title: 'Primal Arts Festival 2026 registration open',
                body: 'Demo weekend pass is on the calendar. RSVP to appear in Attending on the org overview.',
                dateLabel: 'Now open',
                link: null,
              },
              {
                title: 'Volunteer orientation this week',
                body: 'Gate, parking, and fire-watch shifts posted in Forums. Reply on the volunteer thread to claim a slot.',
                dateLabel: 'This week',
                link: null,
              },
            ],
          },
        ],
      } as Record<string, unknown>,
    })
    .where(eq(schema.organizations.id, orgId))

  let [forumCat] = await db
    .select()
    .from(schema.forumCategories)
    .where(eq(schema.forumCategories.organizationId, orgId))
    .limit(1)
  if (!forumCat) {
    const [created] = await db
      .insert(schema.forumCategories)
      .values({ organizationId: orgId, name: 'Festival general', sortOrder: 0 })
      .returning()
    forumCat = created
  }

  const forumThreads = [
    {
      title: 'Tea at NOON!',
      posts: [
        { authorId: ropeId, body: `${PAF_FORUM_MARKER} Daily tea social at the pavilion. Bring your own mug; hot water provided.` },
        { authorId: patronA, body: `${PAF_FORUM_MARKER} I'll bring chamomile to share.` },
        { authorId: leatherId, body: `${PAF_FORUM_MARKER} Reminder: quiet voices until 12:30 while workshops next door wrap.` },
      ],
    },
    {
      title: 'Volunteer sign-up · gate & parking (alpha demo)',
      posts: [
        { authorId: leatherId, body: `${PAF_FORUM_MARKER} Need two people for Thursday gate. Shift is noon–4pm.` },
        { authorId: shutterId, body: `${PAF_FORUM_MARKER} I can do parking radio for Friday afternoon.` },
        { authorId: ropeId, body: `${PAF_FORUM_MARKER} Marked you down, ShutterSeed. Check in at ops tent.` },
      ],
    },
    {
      title: 'Welcome — introduce yourself (alpha demo)',
      posts: [
        { authorId: patronB, body: `${PAF_FORUM_MARKER} First PAF for me. Rope curious, happy to meet mentors.` },
        { authorId: patronC, body: `${PAF_FORUM_MARKER} Returning from last year. Volunteering fire-watch again.` },
      ],
    },
  ]

  let forumAdded = 0
  if (forumCat) {
    for (const th of forumThreads) {
      const [ex] = await db
        .select()
        .from(schema.forumThreads)
        .where(and(eq(schema.forumThreads.organizationId, orgId), eq(schema.forumThreads.title, th.title)))
        .limit(1)
      if (ex) continue
      const [thread] = await db
        .insert(schema.forumThreads)
        .values({
          organizationId: orgId,
          categoryId: forumCat.id,
          title: th.title,
          authorId: th.posts[0]!.authorId,
          updatedAt: new Date(),
        })
        .returning()
      if (!thread) continue
      await mark({ targetType: 'forum_thread', targetId: thread.id, isSynthetic: true, sourceType: 'paf_forum' })
      for (const post of th.posts) {
        const [row] = await db
          .insert(schema.forumPosts)
          .values({ threadId: thread.id, authorId: post.authorId, body: post.body })
          .returning()
        if (row) await mark({ targetType: 'forum_post', targetId: row.id, isSynthetic: true, sourceType: 'paf_forum' })
      }
      forumAdded++
    }
  }

  let [chatChannel] = await db
    .select()
    .from(schema.orgChannels)
    .where(and(eq(schema.orgChannels.organizationId, orgId), eq(schema.orgChannels.slug, PAF_CHAT_CHANNEL_SLUG)))
    .limit(1)
  if (!chatChannel) {
    const [created] = await db
      .insert(schema.orgChannels)
      .values({
        organizationId: orgId,
        slug: PAF_CHAT_CHANNEL_SLUG,
        name: 'General Event Chat',
        kind: 'TEXT',
      })
      .returning()
    chatChannel = created
  }

  let chatAdded = 0
  if (chatChannel) {
    const [{ nChat }] = await db
      .select({ nChat: count() })
      .from(schema.orgChannelMessages)
      .where(
        and(
          eq(schema.orgChannelMessages.orgChannelId, chatChannel.id),
          like(schema.orgChannelMessages.body, `${PAF_CHAT_MARKER}%`),
        ),
      )
    if (Number(nChat) === 0) {
      const chatLines: { senderId: string; body: string }[] = [
        { senderId: ropeId, body: `${PAF_CHAT_MARKER} Welcome desk opens at noon Thursday. Badges at row A.` },
        { senderId: leatherId, body: `${PAF_CHAT_MARKER} Fire safety briefing moved to 7:30pm at main field (demo).` },
        { senderId: shutterId, body: `${PAF_CHAT_MARKER} Photo desk: release forms on the table; no flash during ritual blocks.` },
        { senderId: patronA, body: `${PAF_CHAT_MARKER} Anyone splitting a ride from BWI Friday morning?` },
        { senderId: hostId, body: `${PAF_CHAT_MARKER} Ops note: quiet camping row is north loop. Generator curfew 11pm.` },
        { senderId: patronB, body: `${PAF_CHAT_MARKER} Market opens Friday 4pm — cash helps small vendors.` },
      ]
      for (const line of chatLines) {
        const [msg] = await db
          .insert(schema.orgChannelMessages)
          .values({ orgChannelId: chatChannel.id, senderId: line.senderId, body: line.body })
          .returning()
        if (msg) await mark({ targetType: 'org_channel_message', targetId: msg.id, isSynthetic: true, sourceType: 'paf_chat' })
        chatAdded++
      }
    }
  }

  const [{ nGallery }] = await db
    .select({ nGallery: count() })
    .from(schema.organizationGalleryImages)
    .where(
      and(
        eq(schema.organizationGalleryImages.organizationId, orgId),
        like(schema.organizationGalleryImages.caption, 'Alpha PAF gallery:%'),
      ),
    )
  if (Number(nGallery) === 0) {
    const shots = [
      { url: 'https://picsum.photos/seed/paf-alpha-fire/900/600', cap: 'Alpha PAF gallery: fire circle (demo)' },
      { url: 'https://picsum.photos/seed/paf-alpha-market/900/600', cap: 'Alpha PAF gallery: artisan market (demo)' },
      { url: 'https://picsum.photos/seed/paf-alpha-workshop/900/600', cap: 'Alpha PAF gallery: workshop tent (demo)' },
    ]
    const rows = await db
      .insert(schema.organizationGalleryImages)
      .values(
        shots.map((s, i) => ({
          organizationId: orgId,
          imageUrl: s.url,
          caption: s.cap,
          sortOrder: i,
        })),
      )
      .returning()
    for (const row of rows) {
      await mark({ targetType: 'org_gallery_image', targetId: row.id, isSynthetic: true, sourceType: 'paf_gallery' })
    }
  }

  const [munchHit] = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.organizationId, orgId), eq(schema.events.title, PAF_MUNCH_TITLE)))
    .limit(1)
  if (!munchHit) {
    const soon = new Date()
    soon.setUTCDate(soon.getUTCDate() + 14)
    soon.setUTCHours(23, 0, 0, 0)
    const munchEnd = new Date(soon.getTime() + 2.5 * 60 * 60 * 1000)
    const [munch] = await db
      .insert(schema.events)
      .values({
        hostId: ropeId,
        organizationId: orgId,
        title: PAF_MUNCH_TITLE,
        description: 'Monthly corridor social munch for PAF community (alpha demo).',
        location: 'Demo public house · Chambersburg, PA (fictional)',
        startsAt: soon,
        endsAt: munchEnd,
        category: 'Munch',
        tags: ['munch', 'social', 'alpha-paf'],
        eventFormat: 'in-person',
        newcomerFriendly: true,
      })
      .returning()
    if (munch) {
      await mark({
        targetType: 'event',
        targetId: munch.id,
        isSynthetic: true,
        sourceType: 'paf_munch',
      })
    }
  }

  let rsvpAdded = 0
  for (const uid of [ropeId, leatherId, shutterId, patronA, patronB, patronC]) {
    const [exR] = await db
      .select()
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, anchorEventId), eq(schema.eventRsvps.userId, uid)))
      .limit(1)
    if (exR) continue
    await db.insert(schema.eventRsvps).values({
      eventId: anchorEventId,
      userId: uid,
      status: 'going',
    })
    rsvpAdded++
  }
  if (rsvpAdded > 0) await refreshEventRsvpCount(anchorEventId)

  console.log(
    `Alpha ECKE: PAF hub activity — ${forumAdded} forum threads, ${chatAdded} chat messages, ${rsvpAdded} new anchor RSVPs.`,
  )
}

async function importPafConvention(
  mark: ReturnType<typeof createAlphaSeedMarker>,
  actors: { braxId: string; ropeId: string; leatherId: string; shutterId: string },
  slots: PafSlot[],
): Promise<string | undefined> {
  const { braxId: hostId, ropeId, leatherId, shutterId } = actors
  const hubFlags = serializeOrgFeatureFlags({
    calendarEnabled: true,
    forumsEnabled: true,
    chatEnabled: true,
    subgroupsEnabled: true,
  })
  let [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, PAF_ORG_SLUG)).limit(1)
  const pafDates = rollEckeEventDatesToFuture('2026-05-07', '2026-05-11')
  const eckeRoot = resolveEastCoastRoot()
  const pafImage = eckeRoot ? syncEckeEventImage(eckeRoot, 'primal-arts-festival', '/images/primalarts.png') : null

  if (!org) {
    const [created] = await db
      .insert(schema.organizations)
      .values({
        slug: PAF_ORG_SLUG,
        displayName: 'Primal Arts Fest (alpha demo)',
        bio: `<p>Flagship alpha convention demo. Program slots imported from public PAF26 schedule data for UI testing. Confirm all details with <a href="${PAF_PUBLIC_SITE}">primalartsfest.com</a>.</p>`,
        bioFormat: 'html',
        ownerId: hostId,
        visibility: 'PUBLIC',
        galleryPublic: true,
        logoUrl: pafImage ?? undefined,
        featureFlags: hubFlags,
      })
      .returning()
    org = created
    if (org) {
      await db.insert(schema.organizationMembers).values({ organizationId: org.id, userId: hostId, role: 'OWNER' })
      await mark({ targetType: 'organization', targetId: org.id, isPublicSource: true, sourceType: 'paf_org' })
    }
  } else {
    await db
      .update(schema.organizations)
      .set({
        logoUrl: pafImage ?? org.logoUrl,
        featureFlags: hubFlags,
        galleryPublic: true,
      })
      .where(eq(schema.organizations.id, org.id))
    await mark({ targetType: 'organization', targetId: org.id, isPublicSource: true, sourceType: 'paf_org' })
  }
  if (!org) return undefined

  let [anchor] = await db.select().from(schema.events).where(eq(schema.events.title, PAF_ANCHOR_TITLE)).limit(1)
  if (!anchor) {
    const [ev] = await db
      .insert(schema.events)
      .values({
        hostId,
        organizationId: org.id,
        title: PAF_ANCHOR_TITLE,
        description: `Alpha demo anchor event for PAF26 program grid. Official site: ${PAF_PUBLIC_SITE}`,
        location: 'Darlington, MD',
        startsAt: new Date(pafDates.startsAt),
        endsAt: new Date(pafDates.endsAt),
        category: 'Convention',
        tags: ['alpha-ecke', 'paf26'],
        eventFormat: 'in-person',
        ticketPurchaseUrl: PAF_PUBLIC_SITE,
        ticketingProvider: 'external',
        imageUrl: pafImage ?? undefined,
      })
      .returning()
    anchor = ev
    if (anchor) {
      await mark({
        targetType: 'event',
        targetId: anchor.id,
        isPublicSource: true,
        sourceType: 'paf_anchor_event',
        sourceSlug: 'primal-arts-festival',
      })
    }
  } else {
    await db
      .update(schema.events)
      .set({
        startsAt: new Date(pafDates.startsAt),
        endsAt: new Date(pafDates.endsAt),
        ...(pafImage ? { imageUrl: pafImage } : {}),
      })
      .where(eq(schema.events.id, anchor.id))
    await mark({
      targetType: 'event',
      targetId: anchor.id,
      isPublicSource: true,
      sourceType: 'paf_anchor_event',
      sourceSlug: 'primal-arts-festival',
    })
  }
  if (!anchor) return undefined

  let [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.slug, PAF_CON_SLUG)).limit(1)
  if (!conv) {
    const [created] = await db
      .insert(schema.conventions)
      .values({
        slug: PAF_CON_SLUG,
        name: 'Primal Arts Fest 2026',
        description: 'Alpha demo convention with imported PAF26 program schedule.',
        organizationId: org.id,
        anchorEventId: anchor.id,
        timezone: 'America/New_York',
        startsAt: new Date(pafDates.startsAt),
        endsAt: new Date(pafDates.endsAt),
        settings: {},
      })
      .returning()
    conv = created
  } else {
    await db
      .update(schema.conventions)
      .set({
        anchorEventId: anchor.id,
        startsAt: new Date(pafDates.startsAt),
        endsAt: new Date(pafDates.endsAt),
      })
      .where(eq(schema.conventions.id, conv.id))
  }
  if (!conv) return undefined

  await mark({
    targetType: 'convention',
    targetId: conv.id,
    isPublicSource: true,
    sourceType: 'paf_convention',
    sourceSlug: PAF_CON_SLUG,
  })

  let slotAdded = 0
  for (const slot of slots) {
    const importKey = `alpha-ecke-paf-${slot.sortOrder}`
    const [ex] = await db
      .select()
      .from(schema.scheduleSlots)
      .where(and(eq(schema.scheduleSlots.conventionId, conv.id), eq(schema.scheduleSlots.importKey, importKey)))
      .limit(1)
    if (ex) {
      await mark({
        targetType: 'schedule_slot',
        targetId: ex.id,
        isPublicSource: true,
        sourceType: 'paf_slot',
        sourceSlug: String(slot.sortOrder),
      })
      continue
    }

    const [row] = await db
      .insert(schema.scheduleSlots)
      .values({
        conventionId: conv.id,
        startsAt: new Date(slot.startsAt),
        endsAt: new Date(slot.endsAt),
        title: slot.title,
        description: slot.description,
        trackLabel: slot.track ?? 'PAF26',
        roomLabel: slot.room,
        sortOrder: slot.sortOrder,
        importKey,
        isPublished: true,
        visibility: 'ATTENDEE',
      })
      .returning()
    if (row) {
      await mark({
        targetType: 'schedule_slot',
        targetId: row.id,
        isPublicSource: true,
        sourceType: 'paf_slot',
        sourceSlug: String(slot.sortOrder),
      })
      slotAdded++
    }
  }

  console.log(`Alpha ECKE: PAF convention ${conv.slug} with ${slotAdded} new schedule slots (${slots.length} in source).`)

  if (anchor) {
    await seedPafOrgHubActivity(mark, {
      orgId: org.id,
      anchorEventId: anchor.id,
      hostId,
      ropeId,
      leatherId,
      shutterId,
    })
  }

  return conv.id
}

/** Patch alpha/ecke community places with dungeon logos from EastCoast source data. */
async function backfillEckeCommunityPlaceLogos(
  mark: ReturnType<typeof createAlphaSeedMarker>,
  eckeRoot: string | null,
) {
  if (!eckeRoot) return
  try {
    const mod = await import(pathToFileURL(path.join(eckeRoot, 'src/data/dungeons.js')).href)
    const raw: EastCoastDungeon[] = mod.getAllDungeons?.() ?? mod.dungeons ?? []
    const bySlug = new Map(raw.map((d) => [d.slug, d]))
    const rows = await db
      .select()
      .from(schema.communityPlaces)
      .where(
        or(
          like(schema.communityPlaces.slug, 'alpha-ecke-%'),
          like(schema.communityPlaces.slug, 'ecke-%'),
        ),
      )

    let patched = 0
    for (const place of rows) {
      const sourceSlug = place.slug.replace(/^(alpha-ecke-|ecke-)/, '')
      const src = bySlug.get(sourceSlug)
      if (!src?.logo) continue
      const logoUrl = syncEckeDungeonLogo(eckeRoot, sourceSlug, src.logo)
      if (!logoUrl || logoUrl === place.logoUrl) continue
      await db
        .update(schema.communityPlaces)
        .set({ logoUrl })
        .where(eq(schema.communityPlaces.id, place.id))
      await mark({
        targetType: 'community_place',
        targetId: place.id,
        isPublicSource: true,
        sourceType: 'ecke_dungeon',
        sourceSlug,
      })
      patched++
    }
    if (patched > 0) console.log(`Alpha ECKE: backfilled ${patched} community places with dungeon logos.`)
  } catch (err) {
    console.warn('Alpha ECKE community place logo backfill skipped.', err)
  }
}

/** Patch ecke-rich-seed calendar rows that link to ECKE slugs but lack hero images. */
async function backfillEckeLinkedListingMedia(
  mark: ReturnType<typeof createAlphaSeedMarker>,
  eckeRoot: string | null,
) {
  if (!eckeRoot) return
  try {
    const mod = await import(pathToFileURL(path.join(eckeRoot, 'src/data/events.js')).href)
    const raw: EastCoastEvent[] = mod.getAllEvents?.() ?? mod.events ?? []
    const bySlug = new Map(raw.map((e) => [e.slug, e]))
    const linked = await db
      .select()
      .from(schema.events)
      .where(like(schema.events.ticketPurchaseUrl, `${ECKE_SOURCE}/events/%`))

    let patched = 0
    for (const ev of linked) {
      const slug = ev.ticketPurchaseUrl?.replace(`${ECKE_SOURCE}/events/`, '').split(/[?#]/)[0]
      if (!slug) continue
      const src = bySlug.get(slug)
      if (!src) continue
      const rolled = rollEckeEventDatesToFuture(src.date.start, src.date.end)
      const imageUrl = syncEckeEventImage(eckeRoot, slug, src.logo)
      await db
        .update(schema.events)
        .set({
          startsAt: new Date(rolled.startsAt),
          endsAt: new Date(rolled.endsAt),
          ...(imageUrl ? { imageUrl } : {}),
        })
        .where(eq(schema.events.id, ev.id))
      await mark({
        targetType: 'event',
        targetId: ev.id,
        isPublicSource: true,
        sourceType: 'ecke_event',
        sourceSlug: slug,
      })
      patched++
    }
    if (patched > 0) console.log(`Alpha ECKE: backfilled ${patched} ECKE-linked events with logos/future dates.`)
  } catch (err) {
    console.warn('Alpha ECKE linked listing backfill skipped.', err)
  }
}

async function main() {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true to run alpha ECKE seed.')
    process.exit(1)
  }
  assertAlphaSeedAllowed()

  const eastCoastRoot = resolveEastCoastRoot()
  const batch = await ensureAlphaSeedBatch({
    batchKey: ALPHA_ECKE_BATCH_KEY,
    sourceName: 'East Coast Kink Events (public listings)',
    sourceUrl: ECKE_SOURCE,
    sourceRepo: eastCoastRoot ?? 'packages/api/src/db/ecke-catalog.ts',
    notes: 'Alpha demo worldbuilding: public ECKE listings + synthetic social texture.',
  })
  const mark = createAlphaSeedMarker(batch.id)

  const actors = await resolveDemoActors()
  const { rows: events } = await loadEastCoastEvents()
  const dungeons = await loadEastCoastDungeons()
  const vendors = await loadEastCoastVendors()
  const { rows: educationArticles } = await loadEastCoastEducation()
  const pafSlots = loadPafSlots()

  console.log(`Alpha ECKE batch ${batch.batchKey} (${batch.id})`)

  await removeLegacyEckeDungeonListingEvents()
  await importPublicEvents(mark, actors.braxId, actors.orgId, events)
  await backfillEckeLinkedListingMedia(mark, eastCoastRoot)
  const dungeonOrgIds = await importDungeonOrganizations(mark, actors.braxId, dungeons)
  await importCommunityPlaces(mark, actors.braxId, dungeons, dungeonOrgIds)
  await backfillEckeCommunityPlaceLogos(mark, eastCoastRoot)
  await importVendors(mark, vendors)
  await importEckeEducation(mark, actors, educationArticles)
  const pafConventionId = await importPafConvention(mark, actors, pafSlots)

  await seedEckeRichExperience({
    ...actors,
    previewConventionId: pafConventionId ?? undefined,
    alphaMark: mark,
  })

  console.log('Alpha ECKE demo seed complete. Remove with: npm run db:clear:alpha:ecke -w @c2k/api')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
