/**
 * Seed demo data when USE_DATABASE=true (run: npm run db:seed -w @c2k/api).
 */
import './load-dev-env.js'
import {
  defaultFeedSettings,
  defaultNotificationSettings,
  defaultPrivacySettings,
  KINK_TAG_CATALOG,
  ONBOARDING_STEP_COUNT,
} from '@c2k/shared'
import bcrypt from 'bcryptjs'
import { and, asc, count, eq, ilike, inArray, like, or, sql } from 'drizzle-orm'
import { refreshEventRsvpCount } from '../lib/event-rsvp-helpers.js'
import { resolveVendorCategoryTags, backfillVendorCategoryTags } from '../lib/vendor-public-dto.js'
import { syncConventionPeopleDirectory } from '../lib/convention-people-sync.js'
import { upsertConventionRegistrant } from '../lib/convention-participation.js'
import { estimateReadingMinutes, sanitizeEducationHtml } from '../lib/sanitize-education-body.js'
import { db, schema } from './index.js'
import { syncPafSeedImagesFromLocalDisk } from './local-seed-images.js'

const ROPE_DREAMER_SHORT_BIO = 'Demo artisan shop. Jute rope, safety shears, and aftercare kits.'

const ROPE_DREAMER_DEMO_SHOP_BIO = `${ROPE_DREAMER_SHORT_BIO}

We hand-condition jute in small batches, burnish fuzz for skin-friendly ties, and ship with clear care cards. Safety shears and aftercare balms are chosen for dungeon bags and travel kits alike.

Questions about diameter, conditioning, or class bundles? Visit our shop for sizing help and bundle pricing.`

async function seedKinkTags() {
  if (KINK_TAG_CATALOG.length === 0) return

  await db
    .insert(schema.kinkTags)
    .values(
      KINK_TAG_CATALOG.map((t) => ({
        slug: t.slug,
        displayName: t.displayName,
        sortOrder: t.sortOrder,
        active: true,
      }))
    )
    .onConflictDoUpdate({
      target: schema.kinkTags.slug,
      set: {
        displayName: sql`excluded.display_name`,
        sortOrder: sql`excluded.sort_order`,
        active: true,
      },
    })

  console.log(`Synced ${KINK_TAG_CATALOG.length} kink tags from catalog.`)

  const [first] = await db.select().from(schema.kinkTags).orderBy(asc(schema.kinkTags.sortOrder)).limit(1)
  if (first) {
    await db
      .insert(schema.kinkTagAliases)
      .values({
        kinkTagId: first.id,
        source: 'legacy_fetlife',
        externalKey: '120',
      })
      .onConflictDoNothing()
    console.log('Ensured demo kink_tag_alias legacy_fetlife → first catalog tag.')
  }
}

async function ensureUserSettingsForUser(userId: string) {
  const [existing] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)).limit(1)
  if (existing) return
  await db.insert(schema.userSettings).values({
    userId,
    privacySettings: defaultPrivacySettings,
    notificationSettings: defaultNotificationSettings,
    feedSettings: defaultFeedSettings,
  })
  console.log('Inserted user_settings for user.')
}

/** Visual audit + demo flows: member routes need onboarding complete. */
const auditReadyFeedSettings = {
  ...defaultFeedSettings,
  onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
  onboardingStep: ONBOARDING_STEP_COUNT,
}

async function ensureDemoMemberOnboardingComplete(userId: string) {
  const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)).limit(1)
  if (!row) return
  const feed = row.feedSettings as Record<string, unknown>
  if (typeof feed.onboardingCompletedAt === 'string' && feed.onboardingCompletedAt.length > 0) return
  await db
    .update(schema.userSettings)
    .set({ feedSettings: auditReadyFeedSettings })
    .where(eq(schema.userSettings.userId, userId))
  console.log('Marked demo member onboarding complete for visual audit routes.')
}

/** Site-wide admin login - set C2K_PLATFORM_ADMIN_EMAILS to this email in .env.development */
export async function ensureBraxSiteAdmin(): Promise<{ id: string; email: string }> {
  const username = 'Brax'
  const email = process.env.BRAX_ADMIN_EMAIL ?? 'brax@coast2coast.kink'
  const password = process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (existing) {
    const passwordHash = await bcrypt.hash(password, 12)
    await db
      .update(schema.users)
      .set({ email, passwordHash })
      .where(eq(schema.users.id, existing.id))
    await ensureUserSettingsForUser(existing.id)
    await db
      .update(schema.profiles)
      .set({
        bio: 'Event organizer and rope educator in the Mid-Atlantic. Hosts workshops and supports community programs.',
      })
      .where(eq(schema.profiles.userId, existing.id))
    await db
      .insert(schema.platformStaff)
      .values({ userId: existing.id, role: 'SITE_ADMIN' })
      .onConflictDoUpdate({
        target: schema.platformStaff.userId,
        set: { role: 'SITE_ADMIN' },
      })
    return { id: existing.id, email: existing.email ?? email }
  }

  const hash = await bcrypt.hash(password, 12)
  const [user] = await db
    .insert(schema.users)
    .values({
      username,
      email,
      passwordHash: hash,
    })
    .returning()
  if (!user) throw new Error('insert Brax')

  const [paState] = await db
    .select({ id: schema.states.id })
    .from(schema.states)
    .where(eq(schema.states.name, 'Pennsylvania'))
    .limit(1)

  await db.insert(schema.profiles).values({
    userId: user.id,
    displayName: 'Brax',
    bio: 'Event organizer and rope educator in the Mid-Atlantic. Hosts workshops and supports community programs.',
    visibility: 'PUBLIC',
    verified: true,
    trustScore: 95,
    location: 'Philadelphia, PA',
    stateId: paState?.id ?? null,
  })
  await db.insert(schema.userSettings).values({
    userId: user.id,
    privacySettings: defaultPrivacySettings,
    notificationSettings: defaultNotificationSettings,
    feedSettings: defaultFeedSettings,
  })
  await db
    .insert(schema.platformStaff)
    .values({ userId: user.id, role: 'SITE_ADMIN' })
    .onConflictDoUpdate({
      target: schema.platformStaff.userId,
      set: { role: 'SITE_ADMIN' },
    })
  console.log(`Seeded site admin ${username} / ${email} (password from BRAX_ADMIN_PASSWORD or default).`)
  console.log(`Set C2K_PLATFORM_ADMIN_EMAILS=${email} and C2K_PLATFORM_MODERATOR_USER_IDS=${user.id} in .env.development`)
  return { id: user.id, email }
}

async function getOrCreateDemoUser(): Promise<{ id: string }> {
  const username = 'RopeDreamer'
  const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (existingUser) {
    await ensureUserSettingsForUser(existingUser.id)
    await ensureDemoMemberOnboardingComplete(existingUser.id)
    return existingUser
  }

  const demo = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
  const hash = await bcrypt.hash(demo, 10)

  const [user] = await db
    .insert(schema.users)
    .values({
      username,
      email: 'rope@demo.local',
      passwordHash: hash,
    })
    .returning()
  if (!user) throw new Error('insert user')
  const [paState] = await db
    .select({ id: schema.states.id })
    .from(schema.states)
    .where(eq(schema.states.name, 'Pennsylvania'))
    .limit(1)

  await db.insert(schema.profiles).values({
    userId: user.id,
    displayName: 'Rope Dreamer',
    bio: 'Rigger and rope vendor. Teaches fundamentals on the Mid-Atlantic circuit.',
    visibility: 'PUBLIC',
    verified: true,
    trustScore: 72,
    location: 'Chambersburg, PA',
    stateId: paState?.id ?? null,
  })
  await db.insert(schema.userSettings).values({
    userId: user.id,
    privacySettings: defaultPrivacySettings,
    notificationSettings: defaultNotificationSettings,
    feedSettings: auditReadyFeedSettings,
  })
  console.log('Seeded demo user RopeDreamer / password from DEMO_LOGIN_PASSWORD')
  return user
}

/** First-time onboarding screenshots — keep onboarding incomplete. */
async function getOrCreateOnboardingFreshUser(): Promise<{ id: string }> {
  const username = 'OnboardingFresh'
  const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (existingUser) {
    await ensureUserSettingsForUser(existingUser.id)
    await db
      .update(schema.profiles)
      .set({
        bio: 'New to the community — still setting up a profile.',
        visibility: 'PRIVATE',
      })
      .where(eq(schema.profiles.userId, existingUser.id))
    return existingUser
  }

  const demo = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
  const hash = await bcrypt.hash(demo, 10)

  const [user] = await db
    .insert(schema.users)
    .values({
      username,
      email: 'onboarding-fresh@demo.local',
      passwordHash: hash,
    })
    .returning()
  if (!user) throw new Error('insert user')
  await db.insert(schema.profiles).values({
    userId: user.id,
    displayName: 'Onboarding Fresh',
    bio: 'New to the community — still setting up a profile.',
    visibility: 'PRIVATE',
  })
  await db.insert(schema.userSettings).values({
    userId: user.id,
    privacySettings: defaultPrivacySettings,
    notificationSettings: defaultNotificationSettings,
    feedSettings: defaultFeedSettings,
  })
  console.log('Seeded OnboardingFresh / password from DEMO_LOGIN_PASSWORD (onboarding incomplete)')
  return user
}

function formatEventDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

async function seedDemoEvents(hostId: string) {
  const anyEv = await db.select().from(schema.events).limit(1)
  if (anyEv.length > 0) {
    console.log('Events already present; skipping event seed.')
    return
  }
  const soon = new Date()
  soon.setDate(soon.getDate() + 7)
  const later = new Date()
  later.setDate(later.getDate() + 21)
  await db.insert(schema.events).values([
    {
      hostId,
      title: 'I-81 Southern PA Munch',
      description: 'Low-key social munch for folks along the I-81 corridor.',
      location: 'Chambersburg, PA',
      startsAt: soon,
      category: 'Munch',
      tags: ['munch', 'social'],
      eventFormat: 'in-person',
      rsvpCount: 24,
    },
    {
      hostId,
      title: 'Rope Fundamentals Workshop',
      description: 'Hands-on fundamentals and negotiation.',
      location: 'Frederick, MD',
      startsAt: later,
      category: 'Workshop',
      tags: ['rope', 'education'],
      eventFormat: 'in-person',
      rsvpCount: 18,
    },
    {
      hostId,
      title: 'Virtual Office Hours · Consent & Scenes',
      description: 'Open Q&A on consent frameworks and aftercare.',
      location: 'Online (link after RSVP)',
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 75 * 60 * 1000),
      category: 'Educational',
      tags: ['consent', 'online'],
      eventFormat: 'virtual',
      virtualSessionStyle: 'education',
      virtualAgenda:
        '0:00 · Welcome & land acknowledgments\n0:10 · Consent frameworks\n0:35 · Open Q&A\n1:05 · Wrap & resources',
      materialsUrl: 'https://example.com/demo-c2k-consent-handout',
      recordingPolicy: 'shared_with_registrants',
      eventTimezone: 'America/New_York',
      rsvpCount: 56,
    },
  ])
  console.log(`Seeded demo events (${formatEventDate(soon)} and friends).`)
}

/** Idempotent: adds blended-virtual demos for existing DBs that already had event seed. */
async function ensureBlendedVirtualDemoEvents(hostId: string) {
  const munchTitle = 'Virtual Munch · Mid-Atlantic social'
  const [haveMunch] = await db.select().from(schema.events).where(eq(schema.events.title, munchTitle)).limit(1)
  if (!haveMunch) {
    const start = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
    await db.insert(schema.events).values({
      hostId,
      title: munchTitle,
      description:
        'Small-group social video hangout (~12). Cameras optional; chat-friendly. Link visible after RSVP.',
      location: 'Online (link after RSVP)',
      startsAt: start,
      endsAt: new Date(start.getTime() + 90 * 60 * 1000),
      category: 'Munch',
      tags: ['virtual', 'munch', 'social'],
      eventFormat: 'virtual',
      virtualSessionStyle: 'social',
      eventTimezone: 'America/New_York',
      rsvpCount: 8,
    })
    console.log(`Seeded ${munchTitle}`)
  }

  const classTitle = 'Virtual Class · Negotiation mini-lab'
  const [haveClass] = await db.select().from(schema.events).where(eq(schema.events.title, classTitle)).limit(1)
  if (!haveClass) {
    const start = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
    await db.insert(schema.events).values({
      hostId,
      title: classTitle,
      description: 'Short presenter-led block + Q&A. Uses blended virtual (education) fields in the UI.',
      location: 'Online (link after RSVP)',
      startsAt: start,
      endsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
      category: 'Educational',
      tags: ['virtual', 'class', 'negotiation'],
      eventFormat: 'virtual',
      virtualSessionStyle: 'education',
      virtualAgenda: '0:00 · Intros\n0:15 · Negotiation frames\n0:45 · Paired prompts\n1:15 · Debrief',
      materialsUrl: 'https://example.com/demo-c2k-negotiation-worksheet',
      recordingPolicy: 'live_only',
      eventTimezone: 'America/Los_Angeles',
      rsvpCount: 22,
    })
    console.log(`Seeded ${classTitle}`)
  }
}

async function getOrCreateLeatherDemoUserId(): Promise<string> {
  const [ex] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, 'LeatherCraftDemo'))
    .limit(1)
  if (ex) return ex.id

  const demo = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
  const hash = await bcrypt.hash(demo, 10)
  const [leatherUser] = await db
    .insert(schema.users)
    .values({
      username: 'LeatherCraftDemo',
      email: 'leathercraft@demo.local',
      passwordHash: hash,
    })
    .returning()
  if (!leatherUser) throw new Error('insert LeatherCraftDemo')
  await db.insert(schema.profiles).values({
    userId: leatherUser.id,
    displayName: 'Leather Craft Demo',
    bio: 'Second demo account for vendor listings.',
    visibility: 'PUBLIC',
  })
  await ensureUserSettingsForUser(leatherUser.id)
  return leatherUser.id
}

async function getOrCreateShutterDemoUserId(): Promise<string> {
  const username = 'ShutterSeed'
  const [ex] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (ex) {
    await ensureUserSettingsForUser(ex.id)
    return ex.id
  }
  const demo = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
  const hash = await bcrypt.hash(demo, 10)
  const [u] = await db
    .insert(schema.users)
    .values({
      username,
      email: 'shutter@demo.local',
      passwordHash: hash,
    })
    .returning()
  if (!u) throw new Error('insert ShutterSeed')
  await db.insert(schema.profiles).values({
    userId: u.id,
    displayName: 'Shutter Seed',
    bio: 'Demo house photographer account for convention staff / contributor rows.',
    visibility: 'PUBLIC',
  })
  await ensureUserSettingsForUser(u.id)
  console.log('Seeded demo user ShutterSeed / password from DEMO_LOGIN_PASSWORD')
  return u.id
}

async function getOrCreateTrustedRoleApplicantDemoUserId(): Promise<string> {
  const username = 'TrustedRoleApplicantDemo'
  const [ex] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (ex) {
    await ensureUserSettingsForUser(ex.id)
    return ex.id
  }
  const demo = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
  const hash = await bcrypt.hash(demo, 10)
  const [u] = await db
    .insert(schema.users)
    .values({
      username,
      email: 'trusted-role-applicant@demo.local',
      passwordHash: hash,
    })
    .returning()
  if (!u) throw new Error('insert TrustedRoleApplicantDemo')
  await db.insert(schema.profiles).values({
    userId: u.id,
    displayName: 'Quinn Patel',
    bio: 'Demo trusted-role applicant. Submits volunteer coordinator application for organizer review.',
    visibility: 'PUBLIC',
  })
  await ensureUserSettingsForUser(u.id)
  console.log('Seeded demo user TrustedRoleApplicantDemo / password from DEMO_LOGIN_PASSWORD')
  return u.id
}

/** Minimal presenter row so /presenters/LeatherCraftDemo works for rich convention links. */
async function ensureLeatherDemoPresenterProfileForPreview(leatherUserId: string) {
  const [existing] = await db
    .select()
    .from(schema.presenterProfiles)
    .where(eq(schema.presenterProfiles.userId, leatherUserId))
    .limit(1)
  if (existing) return
  await db.insert(schema.presenterProfiles).values({
    userId: leatherUserId,
    headline: 'Demo impact & leather educator',
    bioShort: 'Impact fundamentals, toy care, and dungeon etiquette.',
    bio: 'Leather artisan and presenter at regional events.',
    links: { Website: 'https://example.com/leathercraft-demo' },
    profileKind: 'PRES',
    expertiseTags: ['impact', 'leather', 'dungeon'],
    directoryVisibility: 'PUBLIC',
  })
  await db.insert(schema.presenterOfferings).values({
    userId: leatherUserId,
    title: 'Impact toys 101',
    tease: 'Striking surfaces, negotiation, and warm-up patterns for pick-up and partner play.',
    durationMinutes: 90,
    level: 'Beginner-friendly',
    format: 'Workshop',
    tags: ['impact', 'safety'],
    isPublic: true,
    sortOrder: 0,
  })
  console.log('Seeded LeatherCraftDemo presenter profile + offering for preview convention.')
}

async function seedDemoVendors(primaryUserId: string) {
  const anyV = await db.select().from(schema.vendorProfiles).limit(1)
  if (anyV.length > 0) {
    console.log('Vendor profiles already present; skipping vendor seed.')
    return
  }
  const secondUserId = await getOrCreateLeatherDemoUserId()
  const ropeFields = resolveVendorCategoryTags({ categories: ['Rope', 'Safety', 'Aftercare'] })
  const leatherFields = resolveVendorCategoryTags({ categories: ['Leather', 'Impact'] })

  await db.insert(schema.vendorProfiles).values([
    {
      userId: primaryUserId,
      slug: 'rope-dreamer-supply',
      displayName: 'Rope Dreamer Supply',
      bio: ROPE_DREAMER_DEMO_SHOP_BIO,
      bannerUrl: 'https://picsum.photos/seed/c2k-rds-banner/1600/420',
      logoUrl: 'https://picsum.photos/seed/c2k-rds-logo/320/320',
      shopHeaderLayout: 'BELOW',
      category: ropeFields.category,
      tags: ropeFields.tags,
      categories: ropeFields.categories,
      rating: 4.8,
      shipsTo: 'US',
      website: 'https://example.com/rope-dreamer-supply',
      verified: true,
    },
    {
      userId: secondUserId,
      slug: 'mid-atlantic-leatherworks',
      displayName: 'Mid-Atlantic Leatherworks',
      bio: 'Custom collars, cuffs, and impact toys.',
      category: leatherFields.category,
      tags: leatherFields.tags,
      categories: leatherFields.categories,
      rating: 4.6,
      shipsTo: 'International',
      website: 'https://example.com/mid-atlantic-leatherworks',
      verified: false,
    },
  ])
  console.log('Seeded demo vendor profiles.')
}

async function ensureVendorCategoryTagsBackfill() {
  const rows = await db.select().from(schema.vendorProfiles)
  let updated = 0
  for (const row of rows) {
    const patch = backfillVendorCategoryTags(row)
    if (!patch) continue
    await db.update(schema.vendorProfiles).set(patch).where(eq(schema.vendorProfiles.id, row.id))
    updated++
  }
  if (updated > 0) console.log(`Backfilled category/tags on ${updated} vendor profile(s).`)
}

async function ensureVendorCoOwnersSeed() {
  const pairs: Array<{ slug: string; coOwnerUsername: string }> = [
    { slug: 'rope-dreamer-supply', coOwnerUsername: 'LeatherCraftDemo' },
    { slug: 'bastille-and-bags', coOwnerUsername: 'RopeDreamer' },
  ]
  let added = 0
  for (const { slug, coOwnerUsername } of pairs) {
    const [vp] = await db
      .select({ id: schema.vendorProfiles.id, userId: schema.vendorProfiles.userId })
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.slug, slug))
      .limit(1)
    if (!vp) continue
    const [co] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, coOwnerUsername))
      .limit(1)
    if (!co || co.id === vp.userId) continue
    const [ex] = await db
      .select({ id: schema.vendorCoOwners.id })
      .from(schema.vendorCoOwners)
      .where(
        and(eq(schema.vendorCoOwners.vendorProfileId, vp.id), eq(schema.vendorCoOwners.userId, co.id)),
      )
      .limit(1)
    if (ex) continue
    await db.insert(schema.vendorCoOwners).values({ vendorProfileId: vp.id, userId: co.id })
    added++
  }
  if (added > 0) console.log(`Seeded ${added} vendor co-owner link(s).`)
}

/** Backfill demo banner/logo/layout for the canonical demo shop (idempotent). */
async function ensureDemoVendorBranding() {
  const [v] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.slug, 'rope-dreamer-supply'))
    .limit(1)
  if (!v) return
  if (v.bannerUrl) {
    console.log('rope-dreamer-supply already has a banner; skip demo branding backfill.')
    return
  }
  await db
    .update(schema.vendorProfiles)
    .set({
      bannerUrl: 'https://picsum.photos/seed/c2k-rds-banner/1600/420',
      logoUrl: 'https://picsum.photos/seed/c2k-rds-logo/320/320',
      shopHeaderLayout: 'BELOW',
    })
    .where(eq(schema.vendorProfiles.id, v.id))
  console.log('Ensured demo shop branding (banner, logo, BELOW layout) for rope-dreamer-supply.')
}

async function ensureDemoVendorCatalog() {
  const [v] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.slug, 'rope-dreamer-supply'))
    .limit(1)
  if (!v) return

  if (!v.bio || v.bio === ROPE_DREAMER_SHORT_BIO) {
    await db
      .update(schema.vendorProfiles)
      .set({ bio: ROPE_DREAMER_DEMO_SHOP_BIO })
      .where(eq(schema.vendorProfiles.id, v.id))
    console.log('Updated rope-dreamer-supply with longer demo bio.')
  }

  const [pc] = await db
    .select({ n: count() })
    .from(schema.products)
    .where(eq(schema.products.vendorId, v.id))
  if (Number(pc?.n ?? 0) > 0) {
    console.log('rope-dreamer-supply already has native products; skip demo product seed.')
    return
  }

  const shopUrl = v.website?.trim() || 'https://example.com/shop'
  await db.insert(schema.products).values([
    {
      vendorId: v.id,
      title: '6mm jute starter hank (8 m)',
      priceCents: 4299,
      primaryImageUrl: 'https://picsum.photos/seed/rds-prod-jute/800/600',
      listingUrl: shopUrl,
    },
    {
      vendorId: v.id,
      title: 'Safety shears. Orange grip',
      priceCents: 1199,
      primaryImageUrl: 'https://picsum.photos/seed/rds-prod-shears/800/600',
      listingUrl: shopUrl,
    },
    {
      vendorId: v.id,
      title: 'Aftercare balm (travel tin)',
      priceCents: 899,
      primaryImageUrl: 'https://picsum.photos/seed/rds-prod-balm/800/600',
      listingUrl: shopUrl,
    },
    {
      vendorId: v.id,
      title: 'Bamboo-silk blindfold',
      priceCents: 2499,
      primaryImageUrl: 'https://picsum.photos/seed/rds-prod-blindfold/800/600',
      listingUrl: shopUrl,
    },
  ])
  console.log('Seeded demo native products for rope-dreamer-supply.')
}

async function seedDemoOrganization(hostId: string) {
  const [ex] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (ex) {
    console.log('Demo organization already present; skipping org seed.')
    return
  }
  const [org] = await db
    .insert(schema.organizations)
    .values({
      slug: 'demo-east-collective',
      displayName: 'Kink Social Network',
      bio: 'Pilot org for Kink Social alpha. Calendar, forums, hub chat, and convention tooling. Public listings inspired by regional event calendars (not affiliated with third-party listing sites).',
      ownerId: hostId,
      visibility: 'PUBLIC',
    })
    .returning()
  if (!org) return
  await db.insert(schema.organizationMembers).values({
    organizationId: org.id,
    userId: hostId,
    role: 'OWNER',
  })
  await db.insert(schema.forumCategories).values({
    organizationId: org.id,
    name: 'General',
    sortOrder: 0,
  })
  await db.insert(schema.orgChannels).values({
    organizationId: org.id,
    slug: 'general',
    name: 'general',
    kind: 'TEXT',
  })
  const [firstEvent] = await db.select({ id: schema.events.id }).from(schema.events).limit(1)
  if (firstEvent) {
    await db
      .update(schema.events)
      .set({
        organizationId: org.id,
        ticketPurchaseUrl: 'https://www.eventbrite.com/e/example-demo-tickets',
        ticketingProvider: 'eventbrite',
      })
      .where(eq(schema.events.id, firstEvent.id))
  }
  const [v] = await db.select({ id: schema.vendorProfiles.id }).from(schema.vendorProfiles).limit(1)
  if (v) {
    await db.insert(schema.organizationFeaturedVendors).values({
      organizationId: org.id,
      vendorProfileId: v.id,
      sortOrder: 0,
      label: 'Featured (seed)',
    })
  }
  console.log('Seeded demo organization demo-east-collective (+ channel, category, optional event link, featured vendor).')
}

/** RopeDreamer + LeatherCraftDemo keep organizer/door QA paths when Brax owns the org. */
async function ensureDemoOrgStaffMembers(orgOwnerId: string) {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (!org) return
  const ropeId = await getOrCreateDemoUser().then((u) => u.id)
  const leatherId = await getOrCreateLeatherDemoUserId()
  for (const { userId, role } of [
    { userId: orgOwnerId, role: 'OWNER' as const },
    { userId: ropeId, role: 'MODERATOR' as const },
    { userId: leatherId, role: 'MODERATOR' as const },
  ]) {
    const [ex] = await db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(eq(schema.organizationMembers.organizationId, org.id), eq(schema.organizationMembers.userId, userId)),
      )
      .limit(1)
    if (!ex) {
      await db.insert(schema.organizationMembers).values({
        organizationId: org.id,
        userId,
        role,
      })
    }
  }
}

/** Anchored convention + slots on the first org-linked event (idempotent) for unified calendar / Playwright. */
async function seedDemoAnchoredConventionProgram() {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (!org) {
    console.log('No demo-east-collective org; skip anchored convention seed.')
    return
  }
  const [ev] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.organizationId, org.id))
    .orderBy(asc(schema.events.startsAt))
    .limit(1)
  if (!ev) {
    console.log('No org-linked event; skip anchored convention seed.')
    return
  }
  const [existing] = await db
    .select()
    .from(schema.conventions)
    .where(eq(schema.conventions.anchorEventId, ev.id))
    .limit(1)
  if (existing) {
    console.log('Anchored demo convention already present; skipping convention seed.')
    return
  }
  const starts = ev.startsAt
  const ends = ev.endsAt ?? new Date(starts.getTime() + 24 * 60 * 60 * 1000)
  const [conv] = await db
    .insert(schema.conventions)
    .values({
      slug: 'seed-demo-con-program',
      name: 'Demo program (seed)',
      description: 'Anchored to the first org-linked demo event for unified calendar QA and e2e.',
      organizationId: org.id,
      anchorEventId: ev.id,
      timezone: 'America/New_York',
      startsAt: starts,
      endsAt: ends,
      settings: {
        publicProgramListing: true,
        venueProfile: 'hotel_takeover',
        hotelBlocks: [{ label: 'Convention host hotel', url: 'https://example.com/hotel', code: 'KINK' }],
      },
    })
    .returning()
  if (!conv) return
  const slotAStart = new Date(starts.getTime() + 60 * 60 * 1000)
  const slotAEnd = new Date(starts.getTime() + 2 * 60 * 60 * 1000)
  const slotBStart = new Date(starts.getTime() + 3 * 60 * 60 * 1000)
  const slotBEnd = new Date(starts.getTime() + 4 * 60 * 60 * 1000)
  const [rope] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)
  const [firstOffering] = rope
    ? await db
        .select()
        .from(schema.presenterOfferings)
        .where(eq(schema.presenterOfferings.userId, rope.id))
        .orderBy(asc(schema.presenterOfferings.sortOrder))
        .limit(1)
    : [undefined]

  await db.insert(schema.scheduleSlots).values([
    {
      conventionId: conv.id,
      startsAt: slotAStart,
      endsAt: slotAEnd,
      title: 'Seed: Welcome circle',
      description: 'Seed slot for day-grouped agenda UI.',
      location: 'Lobby',
      sortOrder: 0,
      trackLabel: 'Main',
      roomLabel: 'Lobby',
      importKey: 'seed-welcome',
    },
    {
      conventionId: conv.id,
      startsAt: slotBStart,
      endsAt: slotBEnd,
      title: 'Seed: Demo workshop',
      description: 'Linked to RopeDreamer offering for presenter picker QA.',
      location: 'Room A',
      sortOrder: 1,
      trackLabel: 'Main',
      roomLabel: 'Ballroom A',
      importKey: 'seed-workshop',
      presenterOfferingId: firstOffering?.id,
    },
  ])
  await db
    .update(schema.events)
    .set({
      dressCode: 'Casual leather welcome',
      expectedCostText: '$10 suggested donation',
    })
    .where(eq(schema.events.id, ev.id))
  console.log('Seeded anchored convention seed-demo-con-program + schedule slots.')
}

/** Idempotent: track/room + offering link + volunteer shifts + public program settings for demo convention (new or legacy DBs). */
async function ensureDemoConventionProgramExtras() {
  const [conv] = await db
    .select()
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, 'seed-demo-con-program'))
    .limit(1)
  if (!conv) return

  const prev = (conv.settings ?? {}) as Record<string, unknown>
  const hotelBlocks = Array.isArray(prev.hotelBlocks) && prev.hotelBlocks.length > 0 ? prev.hotelBlocks : [
    { label: 'Convention host hotel', url: 'https://example.com/hotel', code: 'KINK' },
  ]
  await db
    .update(schema.conventions)
    .set({
      settings: {
        ...prev,
        publicProgramListing: true,
        venueProfile: 'hotel_takeover',
        hotelBlocks,
      },
    })
    .where(eq(schema.conventions.id, conv.id))

  const [rope] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)
  const [firstOffering] = rope
    ? await db
        .select()
        .from(schema.presenterOfferings)
        .where(eq(schema.presenterOfferings.userId, rope.id))
        .orderBy(asc(schema.presenterOfferings.sortOrder))
        .limit(1)
    : [undefined]

  const slots = await db
    .select()
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conv.id))
    .orderBy(asc(schema.scheduleSlots.sortOrder))

  for (const s of slots) {
    const title = s.title ?? ''
    if (title.includes('Welcome')) {
      await db
        .update(schema.scheduleSlots)
        .set({
          trackLabel: s.trackLabel ?? 'Main',
          roomLabel: s.roomLabel ?? 'Lobby',
          importKey: s.importKey ?? 'seed-welcome',
          updatedAt: new Date(),
        })
        .where(eq(schema.scheduleSlots.id, s.id))
    } else if (title.toLowerCase().includes('workshop')) {
      await db
        .update(schema.scheduleSlots)
        .set({
          trackLabel: s.trackLabel ?? 'Main',
          roomLabel: s.roomLabel ?? 'Ballroom A',
          importKey: s.importKey ?? 'seed-workshop',
          presenterOfferingId: s.presenterOfferingId ?? firstOffering?.id,
          description: s.description ?? 'Linked to RopeDreamer offering for presenter picker QA.',
          updatedAt: new Date(),
        })
        .where(eq(schema.scheduleSlots.id, s.id))
    }
  }

  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conv.id))
  if (Number(n) === 0) {
    const t0 = conv.startsAt.getTime()
    await db.insert(schema.conventionVolunteerShifts).values([
      {
        conventionId: conv.id,
        title: 'Seed: Registration desk',
        description: 'Check badges and swag.',
        startsAt: new Date(t0),
        endsAt: new Date(t0 + 3 * 60 * 60 * 1000),
        location: 'Lobby',
        capacityMax: 4,
        sortOrder: 0,
      },
      {
        conventionId: conv.id,
        title: 'Seed: Dungeon monitor assist',
        description: 'Roving support. Seed row for volunteer UI.',
        startsAt: new Date(t0 + 5 * 60 * 60 * 1000),
        endsAt: new Date(t0 + 9 * 60 * 60 * 1000),
        location: 'Play floor',
        capacityMax: 2,
        sortOrder: 1,
      },
    ])
    console.log('Seeded demo volunteer shifts for seed-demo-con-program.')
  }

  const [{ nSlotStaff }] = await db
    .select({ nSlotStaff: count() })
    .from(schema.scheduleSlotStaff)
    .innerJoin(schema.scheduleSlots, eq(schema.scheduleSlots.id, schema.scheduleSlotStaff.scheduleSlotId))
    .where(eq(schema.scheduleSlots.conventionId, conv.id))
  if (Number(nSlotStaff) === 0) {
    const workshop = slots.find((s) => (s.title ?? '').toLowerCase().includes('workshop'))
    if (workshop) {
      const leatherId = await getOrCreateLeatherDemoUserId()
      const end = new Date(workshop.endsAt).getTime()
      const staffStart = new Date(end - 15 * 60 * 1000)
      const staffEnd = new Date(workshop.endsAt)
      await db.insert(schema.scheduleSlotStaff).values({
        scheduleSlotId: workshop.id,
        userId: leatherId,
        roleLabel: 'Room turnover',
        station: 'Reset chairs / mats',
        notes: 'After workshop block.',
        startsAt: staffStart,
        endsAt: staffEnd,
        updatedAt: new Date(),
      })
    }
  }

  const [{ nDuties }] = await db
    .select({ nDuties: count() })
    .from(schema.conventionStaffDuties)
    .where(eq(schema.conventionStaffDuties.conventionId, conv.id))
  if (Number(nDuties) === 0) {
    const leatherId = await getOrCreateLeatherDemoUserId()
    const t0 = conv.startsAt.getTime()
    await db.insert(schema.conventionStaffDuties).values({
      conventionId: conv.id,
      userId: leatherId,
      roleLabel: 'Floater',
      station: 'Badge check assist',
      location: 'Main Hall',
      notes: 'Seed standalone duty for crew grid / my-schedule QA.',
      startsAt: new Date(t0 + 4 * 60 * 60 * 1000),
      endsAt: new Date(t0 + 6 * 60 * 60 * 1000),
      importKey: 'seed-floater',
      updatedAt: new Date(),
    })
  }
}

const PREVIEW_RICH_ANCHOR_TITLE = 'Coast-to-Coast Kink Weekend'
const PREVIEW_RICH_CON_SLUG = 'preview-c2k-weekend'

async function upsertPreviewAccessGrant(
  conventionId: string,
  userId: string,
  role: 'ATTENDEE' | 'STAFF' | 'MODERATOR',
  paidConfirmed: boolean,
  attendingConfirmed: boolean,
  staffPreAccess: boolean,
) {
  const [existing] = await db
    .select()
    .from(schema.conventionAccessGrants)
    .where(and(eq(schema.conventionAccessGrants.conventionId, conventionId), eq(schema.conventionAccessGrants.userId, userId)))
    .limit(1)
  if (existing) {
    await db
      .update(schema.conventionAccessGrants)
      .set({ role, paidConfirmed, attendingConfirmed, staffPreAccess })
      .where(eq(schema.conventionAccessGrants.id, existing.id))
    return
  }
  await db.insert(schema.conventionAccessGrants).values({
    conventionId,
    userId,
    role,
    paidConfirmed,
    attendingConfirmed,
    staffPreAccess,
  })
}

async function ensurePreviewRegistrationCategories(conventionId: string) {
  const existing = await db
    .select()
    .from(schema.conventionRegistrationCategories)
    .where(eq(schema.conventionRegistrationCategories.conventionId, conventionId))
    .orderBy(asc(schema.conventionRegistrationCategories.sortOrder))

  const specs = [
    {
      name: 'Weekend pass',
      description: 'General admission. Full weekend access, vendor hall, and socials.',
      sortOrder: 0,
      expectedHours: 0,
      priceCents: 12500,
      roleKind: 'attendee' as const,
      grantsStaffAccess: false,
    },
    {
      name: 'Presenter comp',
      description: 'Faculty comp. Program sessions assigned in Command Bridge.',
      sortOrder: 1,
      expectedHours: 0,
      priceCents: 0,
      compCode: 'FACULTY',
      accessCode: 'FACULTY',
      roleKind: 'presenter' as const,
      grantsStaffAccess: true,
    },
    {
      name: 'Staff / volunteer comp',
      description: 'Volunteer comp · 8 service hours required before badge pickup.',
      sortOrder: 2,
      expectedHours: 8,
      priceCents: 0,
      compCode: 'VOL-STAFF',
      accessCode: 'VOL-STAFF',
      roleKind: 'volunteer' as const,
      grantsStaffAccess: true,
    },
  ] as const

  const ids: Record<(typeof specs)[number]['name'], string> = {} as Record<string, string>

  for (const spec of specs) {
    const hit = existing.find((c) => c.name === spec.name)
    if (hit) {
      await db
        .update(schema.conventionRegistrationCategories)
        .set({
          description: spec.description,
          sortOrder: spec.sortOrder,
          expectedHours: spec.expectedHours,
          priceCents: spec.priceCents,
          compCode: 'compCode' in spec ? spec.compCode : null,
          accessCode: 'accessCode' in spec ? spec.accessCode : null,
          roleKind: spec.roleKind,
          grantsStaffAccess: spec.grantsStaffAccess,
          updatedAt: new Date(),
        })
        .where(eq(schema.conventionRegistrationCategories.id, hit.id))
      ids[spec.name] = hit.id
    } else {
      const [row] = await db
        .insert(schema.conventionRegistrationCategories)
        .values({
          conventionId,
          name: spec.name,
          description: spec.description,
          sortOrder: spec.sortOrder,
          expectedHours: spec.expectedHours,
          priceCents: spec.priceCents,
          compCode: 'compCode' in spec ? spec.compCode : null,
          accessCode: 'accessCode' in spec ? spec.accessCode : null,
          roleKind: spec.roleKind,
          grantsStaffAccess: spec.grantsStaffAccess,
        })
        .returning()
      ids[spec.name] = row!.id
    }
  }

  return {
    weekendPassId: ids['Weekend pass']!,
    presenterCompId: ids['Presenter comp']!,
    staffCompId: ids['Staff / volunteer comp']!,
  }
}

async function ensurePreviewRegistrationForm(conventionId: string) {
  let [form] = await db
    .select()
    .from(schema.conventionRegistrationForms)
    .where(eq(schema.conventionRegistrationForms.conventionId, conventionId))
    .limit(1)

  if (!form) {
    const [created] = await db
      .insert(schema.conventionRegistrationForms)
      .values({
        conventionId,
        introHtml: '<p>Tell us a little about your weekend so we can support you on site.</p>',
      })
      .returning()
    form = created!
  }

  const questionSpecs = [
    { label: 'Emergency contact name', fieldType: 'text', required: true, sortOrder: 0 },
    { label: 'Emergency contact phone', fieldType: 'text', required: true, sortOrder: 1 },
    { label: 'Accessibility or accommodation notes', fieldType: 'textarea', required: false, sortOrder: 2 },
    { label: 'How did you hear about the event?', fieldType: 'select', required: false, sortOrder: 3, options: ['Friend', 'FetLife', 'Vendor', 'Previous year', 'Other'] },
  ]

  const questionIds: string[] = []
  const existingQs = await db
    .select()
    .from(schema.conventionRegistrationQuestions)
    .where(eq(schema.conventionRegistrationQuestions.formId, form.id))
    .orderBy(asc(schema.conventionRegistrationQuestions.sortOrder))

  for (const spec of questionSpecs) {
    const hit = existingQs.find((q) => q.label === spec.label)
    if (hit) {
      questionIds.push(hit.id)
    } else {
      const [row] = await db
        .insert(schema.conventionRegistrationQuestions)
        .values({
          formId: form.id,
          label: spec.label,
          fieldType: spec.fieldType,
          required: spec.required,
          sortOrder: spec.sortOrder,
          options: 'options' in spec ? spec.options : [],
        })
        .returning()
      questionIds.push(row!.id)
    }
  }

  return { formId: form.id, questionIds }
}

async function ensurePreviewTrustedRoleAndApplicant(conventionId: string) {
  const applicantId = await getOrCreateTrustedRoleApplicantDemoUserId()
  const applySlug = 'volunteer-coordinator'

  let [role] = await db
    .select()
    .from(schema.conventionTrustedRoles)
    .where(
      and(
        eq(schema.conventionTrustedRoles.conventionId, conventionId),
        eq(schema.conventionTrustedRoles.slug, applySlug),
      ),
    )
    .limit(1)
  if (!role) {
    const [created] = await db
      .insert(schema.conventionTrustedRoles)
      .values({
        conventionId,
        slug: applySlug,
        applySlug,
        title: 'Volunteer Coordinator',
        description: 'Coordinates volunteer shifts, check-in desk, and runner crew.',
        status: 'published',
        introText:
          'Tell us a little about your past coordination experience and what shifts you can cover. We review every application within a week.',
        confirmationText: 'Thanks! We will follow up by email within 7 days.',
        sortOrder: 0,
      })
      .returning()
    role = created!
  } else {
    await db
      .update(schema.conventionTrustedRoles)
      .set({
        status: 'published',
        roleKind: 'volunteer',
        applySlug,
        title: 'Volunteer Coordinator',
        description: 'Coordinates volunteer shifts, check-in desk, and runner crew.',
        introText:
          'Tell us a little about your past coordination experience and what shifts you can cover. We review every application within a week.',
        confirmationText: 'Thanks! We will follow up by email within 7 days.',
        updatedAt: new Date(),
      })
      .where(eq(schema.conventionTrustedRoles.id, role.id))
  }

  const questionSpecs = [
    { label: 'Prior coordination or staff lead experience', type: 'long_text', required: true, sortOrder: 0 },
    { label: 'What shifts can you cover?', type: 'text', required: true, sortOrder: 1 },
  ]
  const existingQs = await db
    .select()
    .from(schema.conventionTrustedRoleQuestions)
    .where(eq(schema.conventionTrustedRoleQuestions.roleId, role.id))
  const qIds: Record<string, string> = {}
  for (const spec of questionSpecs) {
    const hit = existingQs.find((q) => q.label === spec.label)
    if (hit) {
      qIds[spec.label] = hit.id
    } else {
      const [row] = await db
        .insert(schema.conventionTrustedRoleQuestions)
        .values({
          roleId: role.id,
          label: spec.label,
          type: spec.type,
          required: spec.required,
          sortOrder: spec.sortOrder,
        })
        .returning()
      qIds[spec.label] = row!.id
    }
  }

  const [profile] = await db
    .select({ displayName: schema.profiles.displayName, email: schema.users.email })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, applicantId))
    .limit(1)
  const applicantName = profile?.displayName ?? 'Quinn Patel'
  const applicantEmail = profile?.email ?? 'trusted-role-applicant@demo.local'

  const [existingApp] = await db
    .select()
    .from(schema.conventionVettingApplications)
    .where(
      and(
        eq(schema.conventionVettingApplications.conventionId, conventionId),
        eq(schema.conventionVettingApplications.applicantUserId, applicantId),
        eq(schema.conventionVettingApplications.trustedRoleId, role.id),
      ),
    )
    .limit(1)
  if (!existingApp) {
    await db.insert(schema.conventionVettingApplications).values({
      conventionId,
      applicantUserId: applicantId,
      applicantName,
      applicantEmail,
      roleApplied: role.title,
      trustedRoleId: role.id,
      status: 'pending',
      payload: {
        [qIds['Prior coordination or staff lead experience']!]:
          'Led volunteer crew at two previous regional events; comfortable triaging walk-ins and routing radio traffic.',
        [qIds['What shifts can you cover?']!]: 'Friday evening check-in + Sunday teardown.',
      },
      organizerNotes: 'Demo trusted-role application for organizer review pipeline.',
    })
  }

  console.log('Seeded preview trusted role (volunteer-coordinator) and TrustedRoleApplicantDemo application.')
}

async function ensurePreviewParticipationSettings(conventionId: string) {
  const [conv] = await db
    .select()
    .from(schema.conventions)
    .where(eq(schema.conventions.id, conventionId))
    .limit(1)
  if (!conv) return

  const [volRole] = await db
    .select({ id: schema.conventionTrustedRoles.id })
    .from(schema.conventionTrustedRoles)
    .where(
      and(
        eq(schema.conventionTrustedRoles.conventionId, conventionId),
        eq(schema.conventionTrustedRoles.slug, 'volunteer-coordinator'),
      ),
    )
    .limit(1)

  const prev = (conv.settings ?? {}) as Record<string, unknown>
  const prevPart =
    typeof prev.participation === 'object' && prev.participation ? (prev.participation as Record<string, unknown>) : {}
  const prevPresenter =
    typeof prevPart.presenterApply === 'object' && prevPart.presenterApply ?
      (prevPart.presenterApply as Record<string, unknown>)
    : {}
  const prevVendor =
    typeof prevPart.vendorApply === 'object' && prevPart.vendorApply ?
      (prevPart.vendorApply as Record<string, unknown>)
    : {}

  const participation = {
    ...prevPart,
    presenterApply: { ...prevPresenter, enabled: true },
    vendorApply: { ...prevVendor, enabled: true },
    volunteerRoleId: volRole?.id ?? prevPart.volunteerRoleId ?? null,
  }

  await db
    .update(schema.conventions)
    .set({
      settings: { ...prev, participation },
    })
    .where(eq(schema.conventions.id, conventionId))

  console.log('Seeded preview participation settings (presenter + vendor apply open, volunteer role linked).')
}

async function upsertRegistrantAnswers(registrantId: string, answers: Record<string, string>) {
  for (const [questionId, value] of Object.entries(answers)) {
    await db
      .insert(schema.conventionRegistrantAnswers)
      .values({ registrantId, questionId, value })
      .onConflictDoUpdate({
        target: [schema.conventionRegistrantAnswers.registrantId, schema.conventionRegistrantAnswers.questionId],
        set: { value },
      })
  }
}

async function reconcilePreviewPeopleRoles(
  conventionId: string,
  presenterUserId: string,
  staffUserId: string,
  attendeeUserId: string,
) {
  const slotIds = (
    await db
      .select({ id: schema.scheduleSlots.id })
      .from(schema.scheduleSlots)
      .where(eq(schema.scheduleSlots.conventionId, conventionId))
  ).map((s) => s.id)

  if (slotIds.length > 0) {
    await db
      .delete(schema.scheduleSlotPresenters)
      .where(
        and(
          eq(schema.scheduleSlotPresenters.userId, staffUserId),
          inArray(schema.scheduleSlotPresenters.scheduleSlotId, slotIds),
        ),
      )
    await db
      .delete(schema.scheduleSlotStaff)
      .where(
        and(eq(schema.scheduleSlotStaff.userId, attendeeUserId), inArray(schema.scheduleSlotStaff.scheduleSlotId, slotIds)),
      )
    await db
      .delete(schema.scheduleSlotStaff)
      .where(
        and(
          eq(schema.scheduleSlotStaff.userId, presenterUserId),
          inArray(schema.scheduleSlotStaff.scheduleSlotId, slotIds),
        ),
      )
  }

  await db
    .delete(schema.conventionStaffDuties)
    .where(
      and(
        eq(schema.conventionStaffDuties.conventionId, conventionId),
        or(
          eq(schema.conventionStaffDuties.userId, presenterUserId),
          eq(schema.conventionStaffDuties.userId, attendeeUserId),
        ),
      ),
    )

  const [producerDuty] = await db
    .select()
    .from(schema.conventionStaffDuties)
    .where(
      and(
        eq(schema.conventionStaffDuties.conventionId, conventionId),
        eq(schema.conventionStaffDuties.importKey, 'preview-c2k-producer'),
      ),
    )
    .limit(1)
  if (producerDuty) {
    await db
      .update(schema.conventionStaffDuties)
      .set({ userId: staffUserId, updatedAt: new Date() })
      .where(eq(schema.conventionStaffDuties.id, producerDuty.id))
  }

  await db
    .delete(schema.conventionStaffDuties)
    .where(
      and(
        eq(schema.conventionStaffDuties.conventionId, conventionId),
        eq(schema.conventionStaffDuties.importKey, 'preview-c2k-photo-desk'),
      ),
    )

  const volShifts = await db
    .select()
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conventionId))

  for (const shift of volShifts) {
    await db
      .delete(schema.conventionVolunteerShiftSignups)
      .where(
        and(
          eq(schema.conventionVolunteerShiftSignups.shiftId, shift.id),
          eq(schema.conventionVolunteerShiftSignups.userId, presenterUserId),
        ),
      )
    await db
      .delete(schema.conventionVolunteerShiftSignups)
      .where(
        and(
          eq(schema.conventionVolunteerShiftSignups.shiftId, shift.id),
          eq(schema.conventionVolunteerShiftSignups.userId, attendeeUserId),
        ),
      )
  }

  const [staffProfile] = await db
    .select({ displayName: schema.profiles.displayName, username: schema.users.username })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, staffUserId))
    .limit(1)
  const staffName = staffProfile?.displayName ?? staffProfile?.username ?? 'Leather Craft Demo'

  const regShift = volShifts.find((v) => v.title.includes('registration desk'))
  const greeterShift = volShifts.find((v) => v.title.includes('greeter'))
  const tearShift = volShifts.find((v) => v.title.includes('teardown'))

  if (regShift) {
    await db
      .update(schema.conventionVolunteerShifts)
      .set({ personId: staffUserId, personName: staffName, role: 'Registration desk lead' })
      .where(eq(schema.conventionVolunteerShifts.id, regShift.id))
    const [su] = await db
      .select()
      .from(schema.conventionVolunteerShiftSignups)
      .where(
        and(eq(schema.conventionVolunteerShiftSignups.shiftId, regShift.id), eq(schema.conventionVolunteerShiftSignups.userId, staffUserId)),
      )
      .limit(1)
    if (!su) {
      await db.insert(schema.conventionVolunteerShiftSignups).values({ shiftId: regShift.id, userId: staffUserId })
    }
  }

  if (greeterShift) {
    await db
      .update(schema.conventionVolunteerShifts)
      .set({ personId: staffUserId, personName: staffName, role: 'Newbie greeter' })
      .where(eq(schema.conventionVolunteerShifts.id, greeterShift.id))
  }

  if (tearShift) {
    await db
      .update(schema.conventionVolunteerShifts)
      .set({ personId: staffUserId, personName: staffName, role: 'Teardown crew lead' })
      .where(eq(schema.conventionVolunteerShifts.id, tearShift.id))
    const [su] = await db
      .select()
      .from(schema.conventionVolunteerShiftSignups)
      .where(
        and(eq(schema.conventionVolunteerShiftSignups.shiftId, tearShift.id), eq(schema.conventionVolunteerShiftSignups.userId, staffUserId)),
      )
      .limit(1)
    if (!su) {
      await db.insert(schema.conventionVolunteerShiftSignups).values({ shiftId: tearShift.id, userId: staffUserId })
    }
  }
}

async function ensurePreviewPeopleSeed(
  conventionId: string,
  presenterUserId: string,
  staffUserId: string,
  attendeeUserId: string,
) {
  const { weekendPassId, presenterCompId, staffCompId } = await ensurePreviewRegistrationCategories(conventionId)
  const { questionIds } = await ensurePreviewRegistrationForm(conventionId)
  const [qEmergencyName, qEmergencyPhone, qAccessibility, qHeardAbout] = questionIds

  await db
    .update(schema.profiles)
    .set({ pronouns: 'they/them' })
    .where(eq(schema.profiles.userId, presenterUserId))
  await db
    .update(schema.profiles)
    .set({ pronouns: 'she/her' })
    .where(eq(schema.profiles.userId, staffUserId))
  await db
    .update(schema.profiles)
    .set({ pronouns: 'he/they' })
    .where(eq(schema.profiles.userId, attendeeUserId))

  await upsertPreviewAccessGrant(conventionId, presenterUserId, 'ATTENDEE', true, true, false)
  await upsertPreviewAccessGrant(conventionId, staffUserId, 'STAFF', true, true, true)
  await upsertPreviewAccessGrant(conventionId, attendeeUserId, 'ATTENDEE', true, true, false)

  await reconcilePreviewPeopleRoles(conventionId, presenterUserId, staffUserId, attendeeUserId)

  const presenter = await upsertConventionRegistrant({
    conventionId,
    userId: presenterUserId,
    categoryId: presenterCompId,
    badgeName: 'Rope Dreamer',
    pronouns: 'they/them',
    externalId: 'FAC-ROPE-2026',
    notes:
      'Faculty. Teaches Rope 201, opening circle, and safety briefing. Green room access. No volunteer hours required.',
  })
  await db
    .update(schema.conventionRegistrants)
    .set({ checkedInAt: null, checkInToken: 'preview-rope-checkin', checkedInTiming: null })
    .where(eq(schema.conventionRegistrants.id, presenter.row.id))
  if (qEmergencyName && qEmergencyPhone && qAccessibility && qHeardAbout) {
    await upsertRegistrantAnswers(presenter.row.id, {
      [qEmergencyName]: 'Jordan Ellis',
      [qEmergencyPhone]: '717-555-0142',
      [qAccessibility]: 'Prefer ground-floor green room; no strobes in classroom.',
      [qHeardAbout]: 'Previous year',
    })
  }

  const staff = await upsertConventionRegistrant({
    conventionId,
    userId: staffUserId,
    categoryId: staffCompId,
    badgeName: 'Morgan Lee',
    pronouns: 'she/her',
    externalId: 'VOL-LCW-0042',
    notes:
      'Ops staff. Registration desk lead, DM on play party block, producer walk-through. DM cert on file through 2027.',
  })
  await db
    .update(schema.conventionRegistrants)
    .set({ checkedInAt: null, checkInToken: 'preview-leather-checkin', checkedInTiming: null })
    .where(eq(schema.conventionRegistrants.id, staff.row.id))
  if (qEmergencyName && qEmergencyPhone && qAccessibility && qHeardAbout) {
    await upsertRegistrantAnswers(staff.row.id, {
      [qEmergencyName]: 'Sam Rivera',
      [qEmergencyPhone]: '302-555-0198',
      [qAccessibility]: 'Radio headset for floor ops.',
      [qHeardAbout]: 'Friend',
    })
  }

  const attendee = await upsertConventionRegistrant({
    conventionId,
    userId: attendeeUserId,
    categoryId: weekendPassId,
    badgeName: 'Alex Mercer',
    pronouns: 'he/they',
    externalId: 'TKT-SHUT-7782',
    notes: 'First-time attendee. Asked for pronoun ribbon at registration. Prefers aisle seating in classes.',
  })
  await db
    .update(schema.conventionRegistrants)
    .set({
      checkedInAt: new Date('2026-06-12T18:45:00.000Z'),
      checkInToken: 'preview-shutter-checkin',
      checkedInTiming: 'on_time',
    })
    .where(eq(schema.conventionRegistrants.id, attendee.row.id))
  if (qEmergencyName && qEmergencyPhone && qAccessibility && qHeardAbout) {
    await upsertRegistrantAnswers(attendee.row.id, {
      [qEmergencyName]: 'Taylor Mercer',
      [qEmergencyPhone]: '410-555-0166',
      [qAccessibility]: 'Mobility: can manage stairs slowly; please reserve aisle seat in Main Hall.',
      [qHeardAbout]: 'FetLife',
    })
  }

  await ensurePreviewTrustedRoleAndApplicant(conventionId)
  await ensurePreviewParticipationSettings(conventionId)
  await syncConventionPeopleDirectory(conventionId)
  console.log(
    'Seeded preview people: RopeDreamer (presenter), LeatherCraftDemo (staff), ShutterSeed (attendee), TrustedRoleApplicantDemo (applicant) with full signup packages.',
  )
}

/**
 * Full-surface demo: multi-day program, presenters + slot staff + standalone duties,
 * volunteer shifts with a signup, access grants (staff vs attendee), anchor event contributors (vendors / sponsor / photo),
 * and RSVPs - all idempotent for `npm run db:seed`.
 */
async function ensureRichPreviewConvention(hostId: string) {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (!org) {
    console.log('No demo-east-collective org; skip rich preview convention seed.')
    return
  }

  const shutterId = await getOrCreateShutterDemoUserId()
  const leatherId = await getOrCreateLeatherDemoUserId()
  await ensureLeatherDemoPresenterProfileForPreview(leatherId)

  const [rope] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)
  if (!rope) return

  const [ropeOffering] = await db
    .select()
    .from(schema.presenterOfferings)
    .where(eq(schema.presenterOfferings.userId, rope.id))
    .orderBy(asc(schema.presenterOfferings.sortOrder))
    .limit(1)

  const [leatherOffering] = await db
    .select()
    .from(schema.presenterOfferings)
    .where(eq(schema.presenterOfferings.userId, leatherId))
    .orderBy(asc(schema.presenterOfferings.sortOrder))
    .limit(1)

  let [anchor] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.title, PREVIEW_RICH_ANCHOR_TITLE))
    .limit(1)
  if (!anchor) {
    const startsAt = new Date('2026-06-12T20:00:00.000Z')
    const endsAt = new Date('2026-06-15T04:00:00.000Z')
    const [ins] = await db
      .insert(schema.events)
      .values({
        hostId,
        organizationId: org.id,
        title: PREVIEW_RICH_ANCHOR_TITLE,
        description:
          'Seeded long-weekend hotel takeover preview: classes, volunteers, ops staff, photographers, and vendor-style contributor rows for localhost UI.',
        location: 'Wilmington, DE (demo)',
        startsAt,
        endsAt,
        category: 'Convention',
        tags: ['convention', 'weekend'],
        eventFormat: 'in-person',
        ticketPurchaseUrl: 'https://example.com/preview-c2k-weekend-tickets',
        ticketingProvider: 'external',
        rsvpCount: 0,
        dressCode: 'Leather / lingerie / creative black optional',
        expectedCostText: 'Weekend pass (demo)',
      })
      .returning()
    anchor = ins
  }
  if (!anchor) return

  let [conv] = await db
    .select()
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, PREVIEW_RICH_CON_SLUG))
    .limit(1)
  if (!conv) {
    const [c] = await db
      .insert(schema.conventions)
      .values({
        slug: PREVIEW_RICH_CON_SLUG,
        name: 'Coast-to-Coast Kink Weekend',
        description:
          'Rich seed: multi-track schedule, presenters, photographers, ops staff on slots, volunteer desk + teardown shifts, and contributor/vendor links on the calendar anchor.',
        organizationId: org.id,
        anchorEventId: anchor.id,
        timezone: 'America/New_York',
        startsAt: anchor.startsAt,
        endsAt: anchor.endsAt ?? anchor.startsAt,
        settings: {
          publicProgramListing: true,
          venueProfile: 'hotel_takeover',
          hotelBlocks: [
            { label: 'Preview Tower (demo block)', url: 'https://example.com/hotel-c2k-preview', code: 'C2KPRE' },
          ],
        },
      })
      .returning()
    conv = c
  }
  if (!conv) return

  const conventionId = conv.id

  const t0 = conv.startsAt.getTime()
  const atHour = (h: number) => new Date(t0 + h * 60 * 60 * 1000)

  const [{ previewSlotCount }] = await db
    .select({ previewSlotCount: count() })
    .from(schema.scheduleSlots)
    .where(and(eq(schema.scheduleSlots.conventionId, conventionId), like(schema.scheduleSlots.importKey, 'preview-c2k-%')))

  if (Number(previewSlotCount) === 0) {
    await db.insert(schema.scheduleSlots).values([
      {
        conventionId,
        startsAt: atHour(0),
        endsAt: atHour(2),
        title: 'Registration & welcome desk',
        description: 'Badges, pronoun ribbons, and safer-kink quick sheets.',
        location: 'Main Lobby',
        linkUrl: 'https://example.com/demo/preview-welcome-packet.pdf',
        sortOrder: 0,
        trackLabel: 'Ops',
        roomLabel: 'Lobby',
        importKey: 'preview-c2k-reg',
      },
      {
        conventionId,
        startsAt: atHour(2),
        endsAt: atHour(3.5),
        title: 'Opening circle & land acknowledgement',
        description: 'Housekeeping, safer spaces overview, and photographer boundaries.',
        location: 'Main Hall',
        sortOrder: 1,
        trackLabel: 'Main',
        roomLabel: 'Main Hall',
        importKey: 'preview-c2k-open',
      },
      {
        conventionId,
        startsAt: atHour(3.5),
        endsAt: atHour(5.5),
        title: 'Safer kink scaffold (class)',
        description: 'Negotiation frames, check-ins, and dungeon etiquette. Seeded class block.',
        location: 'Education · Meridian',
        sortOrder: 2,
        trackLabel: 'Education',
        roomLabel: 'Meridian',
        importKey: 'preview-c2k-safety',
        presenterOfferingId: ropeOffering?.id,
      },
      {
        conventionId,
        startsAt: atHour(5.5),
        endsAt: atHour(8),
        title: 'Friday social lounge',
        description: 'Low-pressure meet-and-greet; vendor tables open late.',
        location: 'Main Lounge',
        sortOrder: 3,
        trackLabel: 'Social',
        roomLabel: 'Lounge',
        importKey: 'preview-c2k-fri-lounge',
      },
      {
        conventionId,
        startsAt: atHour(18),
        endsAt: atHour(19),
        title: 'Saturday. Coffee & codes of conduct',
        description: 'Morning announcements and accessibility reminders.',
        location: 'Meridian Room',
        sortOrder: 4,
        trackLabel: 'Education',
        roomLabel: 'Meridian',
        importKey: 'preview-c2k-sat-coffee',
        presenterOfferingId: ropeOffering?.id,
      },
      {
        conventionId,
        startsAt: atHour(19),
        endsAt: atHour(21),
        title: 'Rope suspension lab (201)',
        description: 'Intermediate ties and lift lines. Demo hardware provided.',
        location: 'Workshop Studio A',
        sortOrder: 5,
        trackLabel: 'Intensive',
        roomLabel: 'Studio A',
        importKey: 'preview-c2k-rope201',
        presenterOfferingId: ropeOffering?.id,
      },
      {
        conventionId,
        startsAt: atHour(19),
        endsAt: atHour(21),
        title: 'Impact toys 101',
        description: 'Striking surfaces, warm-ups, and aftercare. Parallel track.',
        location: 'Hall B',
        sortOrder: 6,
        trackLabel: 'Education',
        roomLabel: 'Hall B',
        importKey: 'preview-c2k-impact',
        presenterOfferingId: leatherOffering?.id,
      },
      {
        conventionId,
        startsAt: atHour(21),
        endsAt: atHour(22.5),
        title: 'Vendor hall + photographer briefing',
        description: 'Tabling layout, roaming photo consent tags, and red-zone rules.',
        location: 'Vendor Meridian',
        sortOrder: 7,
        trackLabel: 'Community',
        roomLabel: 'Meridian',
        importKey: 'preview-c2k-vendor-photo',
      },
      {
        conventionId,
        startsAt: atHour(22.5),
        endsAt: atHour(26.5),
        title: 'Dungeon party block',
        description: 'DM-led floor; photographers on boundary rotation (seed).',
        location: 'Main Play Hall',
        sortOrder: 8,
        trackLabel: 'Play',
        roomLabel: 'Play Hall',
        importKey: 'preview-c2k-party',
      },
      {
        conventionId,
        startsAt: atHour(42),
        endsAt: atHour(44),
        title: 'Sunday. Recovery & mobility',
        description: 'Gentle movement before travel. Mats provided.',
        location: 'Movement Studio',
        sortOrder: 9,
        trackLabel: 'Wellness',
        roomLabel: 'Yoga',
        importKey: 'preview-c2k-yoga',
      },
      {
        conventionId,
        startsAt: atHour(44),
        endsAt: atHour(46.5),
        title: 'Closing circle & gratitude',
        description: 'Announcements, lost & found, and volunteer shout-outs.',
        location: 'Main Hall',
        sortOrder: 10,
        trackLabel: 'Main',
        roomLabel: 'Main Hall',
        importKey: 'preview-c2k-close',
      },
      {
        conventionId,
        startsAt: atHour(46.5),
        endsAt: atHour(50),
        title: 'Thank-you brunch & travel safe',
        description: 'Last coffee, sticker swap, and rideshare board.',
        location: 'Garden Tent',
        sortOrder: 11,
        trackLabel: 'Social',
        roomLabel: 'Garden',
        importKey: 'preview-c2k-brunch',
      },
    ])
    console.log(`Seeded preview schedule slots (${PREVIEW_RICH_CON_SLUG}).`)
  }

  const PREVIEW_LOCATION_NAMES = [
    'Lobby',
    'Main Hall',
    'Meridian',
    'Lounge',
    'Studio A',
    'Hall B',
    'Play Hall',
    'Yoga',
    'Garden',
  ]
  const [{ previewLocCount }] = await db
    .select({ previewLocCount: count() })
    .from(schema.conventionLocations)
    .where(eq(schema.conventionLocations.conventionId, conventionId))
  if (Number(previewLocCount) === 0) {
    await db.insert(schema.conventionLocations).values(
      PREVIEW_LOCATION_NAMES.map((name, i) => ({
        conventionId,
        name,
        sortOrder: i,
      })),
    )
    console.log(`Seeded preview convention locations (${PREVIEW_RICH_CON_SLUG}).`)
  }

  const previewSlots = await db
    .select()
    .from(schema.scheduleSlots)
    .where(and(eq(schema.scheduleSlots.conventionId, conventionId), like(schema.scheduleSlots.importKey, 'preview-c2k-%')))

  const byImport = new Map<string, (typeof previewSlots)[0]>()
  for (const s of previewSlots) {
    if (s.importKey) byImport.set(s.importKey, s)
  }

  async function ensureSlotPresenter(importKey: string, userId: string, sortOrder: number) {
    const slot = byImport.get(importKey)
    if (!slot) return
    const [ex] = await db
      .select()
      .from(schema.scheduleSlotPresenters)
      .where(
        and(eq(schema.scheduleSlotPresenters.scheduleSlotId, slot.id), eq(schema.scheduleSlotPresenters.userId, userId))
      )
      .limit(1)
    if (ex) return
    await db.insert(schema.scheduleSlotPresenters).values({ scheduleSlotId: slot.id, userId, sortOrder })
  }

  async function ensureSlotStaffRow(
    importKey: string,
    userId: string,
    roleLabel: string,
    station: string | null,
    notes: string | null,
    startsAt: Date,
    endsAt: Date
  ) {
    const slot = byImport.get(importKey)
    if (!slot) return
    const [ex] = await db
      .select({ id: schema.scheduleSlotStaff.id })
      .from(schema.scheduleSlotStaff)
      .where(
        and(
          eq(schema.scheduleSlotStaff.scheduleSlotId, slot.id),
          eq(schema.scheduleSlotStaff.userId, userId),
          eq(schema.scheduleSlotStaff.roleLabel, roleLabel)
        )
      )
      .limit(1)
    if (ex) return
    await db.insert(schema.scheduleSlotStaff).values({
      scheduleSlotId: slot.id,
      userId,
      roleLabel,
      station,
      notes,
      startsAt,
      endsAt,
      updatedAt: new Date(),
    })
  }

  await ensureSlotPresenter('preview-c2k-safety', rope.id, 0)
  await ensureSlotPresenter('preview-c2k-sat-coffee', rope.id, 0)
  await ensureSlotPresenter('preview-c2k-rope201', rope.id, 0)
  await ensureSlotPresenter('preview-c2k-impact', rope.id, 0)
  await ensureSlotPresenter('preview-c2k-yoga', rope.id, 0)
  await ensureSlotPresenter('preview-c2k-open', rope.id, 0)
  await ensureSlotPresenter('preview-c2k-close', rope.id, 0)

  const safety = byImport.get('preview-c2k-safety')
  if (safety) {
    await ensureSlotStaffRow(
      'preview-c2k-safety',
      leatherId,
      'Room monitor',
      'Door / headcount',
      'Ops coverage for education block.',
      safety.startsAt,
      safety.endsAt
    )
  }
  const rope201 = byImport.get('preview-c2k-rope201')
  if (rope201) {
    await ensureSlotStaffRow(
      'preview-c2k-rope201',
      leatherId,
      'Kit assistant',
      'Floor mats & shears restock',
      'Support role during intensive.',
      rope201.startsAt,
      rope201.endsAt
    )
  }
  const party = byImport.get('preview-c2k-party')
  if (party) {
    await ensureSlotStaffRow(
      'preview-c2k-party',
      leatherId,
      'DM lead',
      'Play floor A',
      'Primary DM for party block.',
      party.startsAt,
      party.endsAt
    )
  }

  const [{ dutyN }] = await db
    .select({ dutyN: count() })
    .from(schema.conventionStaffDuties)
    .where(
      and(
        eq(schema.conventionStaffDuties.conventionId, conventionId),
        eq(schema.conventionStaffDuties.importKey, 'preview-c2k-producer')
      )
    )
  if (Number(dutyN) === 0) {
    await db.insert(schema.conventionStaffDuties).values([
      {
        conventionId,
        userId: leatherId,
        roleLabel: 'Producer',
        station: 'Walk the building',
        location: 'Hotel',
        notes: 'Standalone duty. Appears on crew grid / merged calendar.',
        startsAt: atHour(1),
        endsAt: atHour(2.5),
        importKey: 'preview-c2k-producer',
        updatedAt: new Date(),
      },
    ])
    console.log('Seeded preview standalone staff duty (producer).')
  }

  const [{ volN }] = await db
    .select({ volN: count() })
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conventionId))
  if (Number(volN) === 0) {
    await db.insert(schema.conventionVolunteerShifts).values([
      {
        conventionId,
        title: 'Volunteer. Registration desk',
        description: 'Badge pickup, pronoun ribbons, and lost-and-found triage.',
        startsAt: atHour(0),
        endsAt: atHour(3),
        location: 'Main Lobby',
        capacityMax: 6,
        sortOrder: 0,
      },
      {
        conventionId,
        title: 'Volunteer. Newbie greeter',
        description: 'Float near Meridian with "ask me" sash. Seed row without signups.',
        startsAt: atHour(18),
        endsAt: atHour(22),
        location: 'Meridian Room',
        capacityMax: 4,
        sortOrder: 1,
      },
      {
        conventionId,
        title: 'Volunteer. Teardown & strike',
        description: 'Break down vendor pipe/drape and return radios.',
        startsAt: atHour(44),
        endsAt: atHour(50),
        location: 'Whole venue',
        capacityMax: 8,
        sortOrder: 2,
      },
    ])
    console.log('Seeded preview volunteer shifts.')
  }

  await ensurePreviewPeopleSeed(conventionId, rope.id, leatherId, shutterId)

  const [{ docN }] = await db
    .select({ docN: count() })
    .from(schema.conventionDocuments)
    .where(
      and(
        eq(schema.conventionDocuments.conventionId, conventionId),
        eq(schema.conventionDocuments.title, 'Attendee quick guide')
      )
    )
  if (Number(docN) === 0) {
    await db.insert(schema.conventionDocuments).values({
      conventionId,
      title: 'Attendee quick guide',
      type: 'general',
      url: 'https://example.com/demo/preview-attendee-guide.pdf',
      visibility: 'ATTENDEE',
      sortOrder: 0,
      createdByUserId: rope.id,
    })
    console.log('Seeded preview convention document link.')
  }

  const [vRope] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.slug, 'rope-dreamer-supply'))
    .limit(1)
  const [vLeather] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.slug, 'mid-atlantic-leatherworks'))
    .limit(1)

  const [{ contribN }] = await db
    .select({ contribN: count() })
    .from(schema.eventContributors)
    .where(eq(schema.eventContributors.eventId, anchor.id))
  if (Number(contribN) === 0) {
    const rows = [
      ...(vRope ?
        [
          {
            eventId: anchor.id,
            kind: 'vendor' as const,
            vendorProfileId: vRope.id,
            label: vRope.displayName,
            description: 'Tabling partner. Rope, shears, aftercare kits (seed).',
            sortOrder: 0,
          },
        ]
      : []),
      ...(vLeather ?
        [
          {
            eventId: anchor.id,
            kind: 'vendor' as const,
            vendorProfileId: vLeather.id,
            label: vLeather.displayName,
            description: 'Leather goods & impact toys on the vendor floor (seed).',
            sortOrder: 1,
          },
        ]
      : []),
      {
        eventId: anchor.id,
        kind: 'sponsor' as const,
        label: 'Bad Dragon (demo sponsor)',
        description: 'Fictional sponsor row for contributor UI.',
        sortOrder: 2,
      },
      {
        eventId: anchor.id,
        kind: 'playspace' as const,
        label: 'Velvet Labyrinth build crew',
        description: 'Pipe, drape, and furniture strike team (seed).',
        sortOrder: 3,
      },
      {
        eventId: anchor.id,
        kind: 'presenter_support' as const,
        userId: shutterId,
        label: 'Official event photography',
        description: 'House photographers. See briefing slot on the program.',
        sortOrder: 4,
      },
      {
        eventId: anchor.id,
        kind: 'other' as const,
        label: 'ASL Bridges (demo partner)',
        description: 'Interpreter coordination for main hall blocks (seed).',
        sortOrder: 5,
      },
    ]
    await db.insert(schema.eventContributors).values(rows)
    console.log('Seeded preview anchor event_contributors (vendors, sponsor, playspace, photo, partner).')
  }

  for (const uid of [rope.id, leatherId, shutterId]) {
    const [r] = await db
      .select()
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, anchor.id), eq(schema.eventRsvps.userId, uid)))
      .limit(1)
    if (!r) {
      await db.insert(schema.eventRsvps).values({ eventId: anchor.id, userId: uid, status: 'going' })
    }
  }

  console.log(
    `Rich preview convention ready: /conventions/${PREVIEW_RICH_CON_SLUG} (anchor event id ${anchor.id}).`
  )
}

/** Stable token for seeded share link (48 hex chars, matches API generator length). */
const DANCECARD_SEED_SHARE_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef'

const DEMO_2MUTUAL_HOST_1 = 'DEMO-2mutual: host block A'
const DEMO_2MUTUAL_HOST_2 = 'DEMO-2mutual: host block B'
const DEMO_2MUTUAL_HOST_3 = 'DEMO-2mutual: host block C'
const DEMO_2MUTUAL_GUEST_1 = 'DEMO-2mutual: guest trim (first gap)'
const DEMO_2MUTUAL_GUEST_2 = 'DEMO-2mutual: guest trim (second gap)'

/**
 * Idempotent dancecard v2 demo on preview-c2k-weekend:
 * - RopeDreamer (host) busy almost the whole convention except two windows: [t0+12h, t0+16h] and [t0+48h, t0+53h].
 * - LeatherCraftDemo busy inside those windows except two 1h mutual pockets: [t0+15h, t0+16h] and [t0+48h, t0+49h].
 * - Buffers set to 0 for both so the overlay matches the grid.
 * - Public share link + optional pending booking in the first mutual hour.
 *
 * View as LeatherCraftDemo on: /conventions/preview-c2k-weekend/dancecard/s/<token> - bright green = exactly those two slots.
 * Host share token unchanged: 0123456789abcdef0123456789abcdef0123456789abcdef
 */
async function ensureDancecardDemoMockData() {
  const [conv] = await db
    .select()
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, PREVIEW_RICH_CON_SLUG))
    .limit(1)
  if (!conv) {
    console.log('No preview convention; skip dancecard demo seed.')
    return
  }
  const [rope] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)
  const [leather] = await db.select().from(schema.users).where(eq(schema.users.username, 'LeatherCraftDemo')).limit(1)
  if (!rope || !leather) {
    console.log('Missing RopeDreamer or LeatherCraftDemo; skip dancecard demo seed.')
    return
  }

  const [already] = await db
    .select({ id: schema.dancecardEntries.id })
    .from(schema.dancecardEntries)
    .where(
      and(
        eq(schema.dancecardEntries.conventionId, conv.id),
        eq(schema.dancecardEntries.userId, rope.id),
        eq(schema.dancecardEntries.title, DEMO_2MUTUAL_HOST_1),
      ),
    )
    .limit(1)
  if (already) {
    return
  }

  await db.delete(schema.dancecardBookingRequests).where(
    and(
      eq(schema.dancecardBookingRequests.conventionId, conv.id),
      eq(schema.dancecardBookingRequests.hostUserId, rope.id),
      eq(schema.dancecardBookingRequests.guestUserId, leather.id),
      or(
        like(schema.dancecardBookingRequests.description, 'Seed:%'),
        like(schema.dancecardBookingRequests.description, 'DEMO-2mutual%'),
      ),
    ),
  )

  await db.delete(schema.dancecardEntries).where(
    and(
      eq(schema.dancecardEntries.conventionId, conv.id),
      or(eq(schema.dancecardEntries.userId, rope.id), eq(schema.dancecardEntries.userId, leather.id)),
      or(
        like(schema.dancecardEntries.title, 'Seed dancecard:%'),
        like(schema.dancecardEntries.title, 'DEMO-2mutual%'),
        eq(schema.dancecardEntries.notes, 'seed:dancecard-mock'),
        eq(schema.dancecardEntries.notes, 'seed:demo-2mutual'),
      ),
    ),
  )

  const t0 = conv.startsAt.getTime()
  const tEnd = conv.endsAt.getTime()

  async function upsertBufferZero(userId: string) {
    const [ex] = await db
      .select({ id: schema.conventionDancecardPrefs.id })
      .from(schema.conventionDancecardPrefs)
      .where(
        and(
          eq(schema.conventionDancecardPrefs.conventionId, conv.id),
          eq(schema.conventionDancecardPrefs.userId, userId),
        ),
      )
      .limit(1)
    if (ex) {
      await db
        .update(schema.conventionDancecardPrefs)
        .set({ bufferMinutes: 0, updatedAt: new Date() })
        .where(eq(schema.conventionDancecardPrefs.id, ex.id))
    } else {
      await db.insert(schema.conventionDancecardPrefs).values({
        conventionId: conv.id,
        userId,
        bufferMinutes: 0,
        updatedAt: new Date(),
      })
    }
  }
  await upsertBufferZero(rope.id)
  await upsertBufferZero(leather.id)

  const hostAEnd = new Date(t0 + 12 * 60 * 60 * 1000)
  const hostBStart = new Date(t0 + 16 * 60 * 60 * 1000)
  const hostBEnd = new Date(t0 + 48 * 60 * 60 * 1000)
  const hostCStart = new Date(t0 + 53 * 60 * 60 * 1000)
  const hostCEnd = new Date(tEnd)
  const leather2End = new Date(Math.min(tEnd, t0 + 53 * 60 * 60 * 1000))

  const rows: (typeof schema.dancecardEntries.$inferInsert)[] = [
    {
      conventionId: conv.id,
      userId: rope.id,
      title: DEMO_2MUTUAL_HOST_1,
      startsAt: conv.startsAt,
      endsAt: hostAEnd,
      sourceKind: 'manual',
      notes: 'seed:demo-2mutual',
    },
    {
      conventionId: conv.id,
      userId: rope.id,
      title: DEMO_2MUTUAL_HOST_2,
      startsAt: hostBStart,
      endsAt: hostBEnd,
      sourceKind: 'manual',
      notes: 'seed:demo-2mutual',
    },
    {
      conventionId: conv.id,
      userId: leather.id,
      title: DEMO_2MUTUAL_GUEST_1,
      startsAt: new Date(t0 + 12 * 60 * 60 * 1000),
      endsAt: new Date(t0 + 15 * 60 * 60 * 1000),
      sourceKind: 'manual',
      notes: 'seed:demo-2mutual',
    },
  ]
  if (hostCStart.getTime() < tEnd) {
    rows.push({
      conventionId: conv.id,
      userId: rope.id,
      title: DEMO_2MUTUAL_HOST_3,
      startsAt: hostCStart,
      endsAt: hostCEnd,
      sourceKind: 'manual',
      notes: 'seed:demo-2mutual',
    })
  }
  const leather2Start = new Date(t0 + 49 * 60 * 60 * 1000)
  if (leather2Start.getTime() < leather2End.getTime()) {
    rows.push({
      conventionId: conv.id,
      userId: leather.id,
      title: DEMO_2MUTUAL_GUEST_2,
      startsAt: leather2Start,
      endsAt: leather2End,
      sourceKind: 'manual',
      notes: 'seed:demo-2mutual',
    })
  }

  await db.insert(schema.dancecardEntries).values(rows)

  const [existingShare] = await db
    .select()
    .from(schema.conventionDancecardShareLinks)
    .where(eq(schema.conventionDancecardShareLinks.token, DANCECARD_SEED_SHARE_TOKEN))
    .limit(1)
  if (!existingShare) {
    await db.insert(schema.conventionDancecardShareLinks).values({
      conventionId: conv.id,
      ownerUserId: rope.id,
      token: DANCECARD_SEED_SHARE_TOKEN,
      label: 'Seed demo (2 mutual slots)',
    })
    console.log(
      `Seeded dancecard share link (public): /conventions/${PREVIEW_RICH_CON_SLUG}/dancecard/s/${DANCECARD_SEED_SHARE_TOKEN}`,
    )
  }

  const bookingDesc = 'DEMO-2mutual: pending in first slot'
  const [existingBooking] = await db
    .select()
    .from(schema.dancecardBookingRequests)
    .where(
      and(eq(schema.dancecardBookingRequests.conventionId, conv.id), eq(schema.dancecardBookingRequests.description, bookingDesc)),
    )
    .limit(1)
  if (!existingBooking) {
    const bStart = new Date(t0 + 15 * 60 * 60 * 1000)
    const bEnd = new Date(t0 + 15.5 * 60 * 60 * 1000)
    if (bEnd.getTime() <= tEnd) {
      await db.insert(schema.dancecardBookingRequests).values({
        conventionId: conv.id,
        hostUserId: rope.id,
        guestUserId: leather.id,
        startsAt: bStart,
        endsAt: bEnd,
        description: bookingDesc,
        status: 'PENDING',
        updatedAt: new Date(),
      })
    }
  }

  console.log(
    `Dancecard 2-mutual-slot demo: host gaps 12–16h and 48–53h from convention start; guest trims → mutual 15–16h and 48–49h only. Share: /conventions/${PREVIEW_RICH_CON_SLUG}/dancecard/s/${DANCECARD_SEED_SHARE_TOKEN} (view as LeatherCraftDemo).`,
  )
}

/**
 * Public multi-day events inspired by listings on https://eastcoastkinkevents.com (calendar-style blurbs; not affiliated).
 * Idempotent: skips rows that already exist with the same title.
 */
const ECK_SOURCE = 'https://eastcoastkinkevents.com'

type EckCalendarRow = {
  title: string
  description: string
  location: string
  startsAt: Date
  endsAt: Date
  category: string
  tags: string[]
  ticketPurchaseUrl: string
}

/** Upcoming listings mirrored from eastcoastkinkevents.com (May–Jul 2026) - C2K is not affiliated. */
const ECK_CALENDAR_DEMO_EVENTS: EckCalendarRow[] = [
  {
    title: 'Camp Crucible',
    description:
      'Multi-day outdoor-capable gathering in Maryland. Classes, dungeons, and community programming. Confirm dates and registration on the listing site.',
    location: 'Darlington, MD',
    startsAt: new Date('2026-05-23T14:00:00.000Z'),
    endsAt: new Date('2026-05-31T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'convention', 'maryland'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/camp-crucible`,
  },
  {
    title: 'Kink Odyssey · Spring 2026',
    description:
      'Spring retreat-style weekend in upstate New York. Education tracks and social space; verify ticket tiers on the organiser listing.',
    location: 'Greenwich, NY',
    startsAt: new Date('2026-05-27T14:00:00.000Z'),
    endsAt: new Date('2026-05-31T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'convention', 'education'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/kink-odyssey-spring-2026`,
  },
  {
    title: "Naughty N'at",
    description:
      'Pittsburgh-area kink weekend. Parties, classes, and vendor market. Check the public listing for hotel blocks and policies.',
    location: 'Pittsburgh, PA',
    startsAt: new Date('2026-05-28T14:00:00.000Z'),
    endsAt: new Date('2026-05-31T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'convention', 'pennsylvania'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/naughty-nat`,
  },
  {
    title: 'Twisted Tryst',
    description:
      'Ohio regional weekend with workshops and play parties. Confirm schedule and accessibility notes with hosts.',
    location: 'Athens, OH',
    startsAt: new Date('2026-06-11T14:00:00.000Z'),
    endsAt: new Date('2026-06-14T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'convention', 'midwest'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/twisted-tryst`,
  },
  {
    title: 'Dark Odyssey Fusion',
    description:
      'Maryland fusion weekend. Ritual, education, and dungeon space. Policies and registration on the organiser site.',
    location: 'Darlington, MD',
    startsAt: new Date('2026-06-23T14:00:00.000Z'),
    endsAt: new Date('2026-06-29T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'convention', 'maryland'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/dark-odyssey-fusion`,
  },
  {
    title: 'TESFest',
    description:
      'Central New Jersey education-focused weekend. Large class grid and community hospitality suites.',
    location: 'Piscataway, NJ',
    startsAt: new Date('2026-07-02T14:00:00.000Z'),
    endsAt: new Date('2026-07-05T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'education', 'new-jersey'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/tesfest`,
  },
  {
    title: "Naughty in N'Awlins",
    description:
      'New Orleans kink weekend · French Quarter-adjacent programming and parties; confirm venues on the listing.',
    location: 'New Orleans, LA',
    startsAt: new Date('2026-07-08T14:00:00.000Z'),
    endsAt: new Date('2026-07-12T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'convention', 'louisiana'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/naughty-in-nawlins`,
  },
  {
    title: 'Chicago Fetish Weekend 2026',
    description:
      'Windy City fetish weekend. Hotel programming, vendor hall, and parties. Confirm dates on chicagofetishweekend.com via the listing.',
    location: 'Chicago, IL',
    startsAt: new Date('2026-07-09T14:00:00.000Z'),
    endsAt: new Date('2026-07-12T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'convention', 'illinois'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/chicago-fetish-weekend-2026`,
  },
  {
    title: 'Elevation Rope 2026',
    description:
      'Rope-focused intensive in western North Carolina. Multi-day tying tracks and peer practice.',
    location: 'Horse Shoe, NC',
    startsAt: new Date('2026-07-16T14:00:00.000Z'),
    endsAt: new Date('2026-07-21T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'rope', 'education'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/elevation-rope-2026`,
  },
  {
    title: 'Whips and Wine',
    description:
      'Eastern Pennsylvania weekend pairing classes with social programming. Verify ticket sales on the listing.',
    location: 'Eastern Pennsylvania, PA',
    startsAt: new Date('2026-07-17T14:00:00.000Z'),
    endsAt: new Date('2026-07-19T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'pennsylvania', 'weekend'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/whips-and-wine`,
  },
  {
    title: 'FetCamp',
    description:
      'Northern Massachusetts outdoor-friendly camp. Workshops, dungeons, and community cabins; confirm packing list with hosts.',
    location: 'Northern Massachusetts, MA',
    startsAt: new Date('2026-07-17T14:00:00.000Z'),
    endsAt: new Date('2026-07-19T04:00:00.000Z'),
    category: 'Convention',
    tags: ['eck-calendar', 'convention', 'massachusetts'],
    ticketPurchaseUrl: `${ECK_SOURCE}/events/fetcamp`,
  },
  {
    title: 'I-81 Corridor Munch (C2K local)',
    description:
      'Low-key social munch for folks along the I-81 corridor. Hosted on C2K for home/discovery testing.',
    location: 'Chambersburg, PA',
    startsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    category: 'Munch',
    tags: ['munch', 'social', 'c2k-local'],
    ticketPurchaseUrl: `${ECK_SOURCE}/`,
  },
]

async function ensureEckInspiredCalendarEvents(hostId: string) {
  let added = 0
  for (const row of ECK_CALENDAR_DEMO_EVENTS) {
    const [ex] = await db.select().from(schema.events).where(eq(schema.events.title, row.title)).limit(1)
    if (ex) continue
    await db.insert(schema.events).values({
      hostId,
      title: row.title,
      description: row.description,
      location: row.location,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      category: row.category,
      tags: row.tags,
      eventFormat: 'in-person',
      rsvpCount: 0,
      ticketPurchaseUrl: row.ticketPurchaseUrl,
      ticketingProvider: 'external',
    })
    added += 1
  }
  if (added > 0) {
    console.log(`Seeded ${added} East Coast–style calendar demo events (${ECK_SOURCE}).`)
  }
}

/** RSVP “going” on Demo East’s first org event so logged-in demo user looks like an attendee on the event page. */
async function ensureSeedUserRsvpOnOrgEvent() {
  const [rope] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)
  if (!rope) return
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, 'demo-east-collective')).limit(1)
  if (!org) return
  const [ev] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.organizationId, org.id))
    .orderBy(asc(schema.events.startsAt))
    .limit(1)
  if (!ev) return
  const [ex] = await db
    .select()
    .from(schema.eventRsvps)
    .where(and(eq(schema.eventRsvps.eventId, ev.id), eq(schema.eventRsvps.userId, rope.id)))
    .limit(1)
  if (ex) return
  await db.insert(schema.eventRsvps).values({
    eventId: ev.id,
    userId: rope.id,
    status: 'going',
  })
  console.log('Seeded RopeDreamer RSVP (going) on first Demo East org event.')
}

/**
 * Second demo convention: program listing is not public; RopeDreamer has a paid+attending grant to view slots like a ticketed attendee.
 */
async function ensureGatedConventionWithAttendeeGrant(hostId: string) {
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, 'demo-east-collective')).limit(1)
  if (!org) return

  const anchorTitle = 'Demo: Gated program anchor (C2K seed)'
  let [ev] = await db.select().from(schema.events).where(eq(schema.events.title, anchorTitle)).limit(1)
  if (!ev) {
    const start = new Date('2026-05-15T15:00:00.000Z')
    const end = new Date('2026-05-17T18:00:00.000Z')
    const [ins] = await db
      .insert(schema.events)
      .values({
        hostId,
        organizationId: org.id,
        title: anchorTitle,
        description: 'Anchor calendar row for a demo convention with attendee-only program listing (build QA).',
        location: 'Philadelphia, PA (demo)',
        startsAt: start,
        endsAt: end,
        category: 'Convention',
        tags: ['gated-program', 'education'],
        eventFormat: 'in-person',
        rsvpCount: 0,
      })
      .returning()
    ev = ins
  }
  if (!ev) return

  const gatedSlug = 'seed-demo-con-gated'
  let [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.slug, gatedSlug)).limit(1)
  if (!conv) {
    const [c] = await db
      .insert(schema.conventions)
      .values({
        slug: gatedSlug,
        name: 'Demo: Attendee-gated program (seed)',
        description:
          'Program grid is hidden from anonymous visitors; log in as RopeDreamer (demo attendee grant) to load slots.',
        organizationId: org.id,
        anchorEventId: ev.id,
        timezone: 'America/New_York',
        startsAt: ev.startsAt,
        endsAt: ev.endsAt ?? ev.startsAt,
        settings: {
          publicProgramListing: false,
          venueProfile: 'hotel_takeover',
        },
      })
      .returning()
    conv = c
  }
  if (!conv) return

  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conv.id))
  if (Number(n) === 0) {
    const t0 = conv.startsAt.getTime()
    await db.insert(schema.scheduleSlots).values([
      {
        conventionId: conv.id,
        startsAt: new Date(t0 + 2 * 60 * 60 * 1000),
        endsAt: new Date(t0 + 4 * 60 * 60 * 1000),
        title: 'Gated seed: Opening ceremonies',
        description: 'Visible only with attendee/staff access when public listing is off.',
        trackLabel: 'Main',
        roomLabel: 'Hall A',
        importKey: 'gated-open',
        sortOrder: 0,
      },
      {
        conventionId: conv.id,
        startsAt: new Date(t0 + 5 * 60 * 60 * 1000),
        endsAt: new Date(t0 + 7 * 60 * 60 * 1000),
        title: 'Gated seed: VIP workshop block',
        trackLabel: 'Intensive',
        roomLabel: 'Studio 2',
        importKey: 'gated-vip',
        sortOrder: 1,
      },
    ])
    console.log('Seeded schedule slots for seed-demo-con-gated.')
  }

  const [rope] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)
  if (!rope) return
  const [existingGrant] = await db
    .select()
    .from(schema.conventionAccessGrants)
    .where(and(eq(schema.conventionAccessGrants.conventionId, conv.id), eq(schema.conventionAccessGrants.userId, rope.id)))
    .limit(1)
  if (!existingGrant) {
    await db.insert(schema.conventionAccessGrants).values({
      conventionId: conv.id,
      userId: rope.id,
      role: 'ATTENDEE',
      paidConfirmed: true,
      attendingConfirmed: true,
    })
    console.log('Seeded attendee access grant for RopeDreamer on seed-demo-con-gated.')
  }
}

const DEMO_ORG_HUB_THREAD_TITLE = 'Seed: Welcome thread'

const DEMO_EAST_WELCOME_HTML =
  '<p><strong>Welcome.</strong> This page highlights who we are, who to contact, and our featured partners. Use the <strong>tabs above</strong> for forums, chat, and the org calendar. Each event has its own page for schedules and RSVPs.</p><p><em>Staff:</em> edit this message and the modules below from <strong>Edit community page</strong>.</p>'

const DEMO_NEW_MEMBER_CHECKLIST_ITEMS = [
  { label: 'Read community guidelines', href: 'https://example.com/c2k-guidelines', note: 'Site-wide baseline' },
  { label: 'Say hi in the welcome forum thread', href: null, note: null },
  {
    label: 'Browse the Calendar tab for munches and ticketed nights',
    href: null,
    note: 'RSVPs and schedules live there, not on this page',
  },
  { label: 'Complete your profile & directory opt-in', href: null, note: 'Optional but helps people recognize you' },
] as const

const LEGACY_COMMUNITY_MODULE_IDS = new Set(['house-rules', 'event-host-focus', 'event-highlights'])

/** Drop legacy org-overview venue etiquette richtext (expectations live on event pages). */
function keepCommunityModuleRowForDemoSeed(m: unknown): boolean {
  if (!m || typeof m !== 'object') return true
  const o = m as Record<string, unknown>
  if (typeof o.id === 'string' && LEGACY_COMMUNITY_MODULE_IDS.has(o.id)) return false
  if (o.type === 'richtext') {
    const title = typeof o.title === 'string' ? o.title.toLowerCase() : ''
    const html = typeof o.html === 'string' ? o.html.toLowerCase() : ''
    if ((title.includes('play-space') || title.includes('play space')) && title.includes('etiquette')) return false
    if (title.includes('house') && title.includes('play') && title.includes('etiquette')) return false
    if (html.includes('dungeon monitors') && html.includes('red/yellow/green')) return false
  }
  return true
}

/** Rich forum/chat/gallery/reviews for demo-east-collective (idempotent). */
async function ensureDemoOrgHubContent() {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (!org) {
    console.log('No demo-east-collective org; skip org hub demo content.')
    return
  }

  const [marker] = await db
    .select({ id: schema.forumThreads.id })
    .from(schema.forumThreads)
    .where(
      and(
        eq(schema.forumThreads.organizationId, org.id),
        eq(schema.forumThreads.title, DEMO_ORG_HUB_THREAD_TITLE)
      )
    )
    .limit(1)
  if (marker) {
    console.log('Demo org hub content already present; skipping hub demo seed.')
    return
  }

  const [rope] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)
  if (!rope) {
    console.log('RopeDreamer missing; skip org hub demo content.')
    return
  }
  const leatherId = await getOrCreateLeatherDemoUserId()
  const demoPw = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
  const hash = await bcrypt.hash(demoPw, 10)

  async function ensureUser(username: string, email: string, displayName: string): Promise<string> {
    const [ex] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
    if (ex) return ex.id
    const [u] = await db
      .insert(schema.users)
      .values({ username, email, passwordHash: hash })
      .returning()
    if (!u) throw new Error(`insert ${username}`)
    await db.insert(schema.profiles).values({
      userId: u.id,
      displayName,
      bio: 'Community member exploring local events and groups.',
      visibility: 'PUBLIC',
    })
    await ensureUserSettingsForUser(u.id)
    return u.id
  }

  const patronA = await ensureUser('EastPatronA', 'east-patron-a@demo.local', 'East Patron A')
  const patronB = await ensureUser('EastPatronB', 'east-patron-b@demo.local', 'East Patron B')

  await db
    .update(schema.organizations)
    .set({
      bio: `<p><strong>Demo East Collective</strong> hosts munches, workshops, and occasional full programs in the Mid-Atlantic.</p>
<p>The <strong>Calendar</strong> tab lists what&apos;s coming; each event links to schedules when a program is attached.</p>
<ul><li>Member tools: gallery (unless marked public), chat, forums</li><li>Programs and presenters live on convention pages</li></ul>`,
      bioFormat: 'html',
      galleryPublic: true,
    })
    .where(eq(schema.organizations.id, org.id))

  const [leatherMem] = await db
    .select()
    .from(schema.organizationMembers)
    .where(
      and(eq(schema.organizationMembers.organizationId, org.id), eq(schema.organizationMembers.userId, leatherId))
    )
    .limit(1)
  if (!leatherMem) {
    await db.insert(schema.organizationMembers).values({
      organizationId: org.id,
      userId: leatherId,
      role: 'MODERATOR',
    })
  }

  const [cat] = await db
    .select()
    .from(schema.forumCategories)
    .where(eq(schema.forumCategories.organizationId, org.id))
    .limit(1)

  const [thread] = await db
    .insert(schema.forumThreads)
    .values({
      organizationId: org.id,
      categoryId: cat?.id ?? null,
      title: DEMO_ORG_HUB_THREAD_TITLE,
      authorId: rope.id,
    })
    .returning()
  if (!thread) return

  await db.insert(schema.forumPosts).values([
    {
      threadId: thread.id,
      authorId: rope.id,
      body: 'Welcome! Introduce yourself and say what you are looking forward to this season.',
    },
    {
      threadId: thread.id,
      authorId: leatherId,
      body: 'Thanks for posting. +1 on using the compact “Forums & chat” strip on Overview (under Welcome) to jump back here.',
    },
  ])
  await db
    .update(schema.forumThreads)
    .set({ updatedAt: new Date() })
    .where(eq(schema.forumThreads.id, thread.id))

  const [ch] = await db
    .select()
    .from(schema.orgChannels)
    .where(eq(schema.orgChannels.organizationId, org.id))
    .limit(1)
  if (ch) {
    await db.insert(schema.orgChannelMessages).values([
      {
        orgChannelId: ch.id,
        senderId: rope.id,
        body: 'See you at the next munch. Check the calendar tab for dates.',
      },
      {
        orgChannelId: ch.id,
        senderId: leatherId,
        body: 'Reminder: parking details are on the event page.',
      },
    ])
  }

  await db.insert(schema.organizationGalleryImages).values([
    {
      organizationId: org.id,
      imageUrl: 'https://picsum.photos/seed/c2korg1/800/450',
      caption: 'Seed image 1',
      sortOrder: 0,
    },
    {
      organizationId: org.id,
      imageUrl: 'https://picsum.photos/seed/c2korg2/800/450',
      caption: 'Seed image 2',
      sortOrder: 1,
    },
    {
      organizationId: org.id,
      imageUrl: 'https://picsum.photos/seed/c2korg3/800/450',
      caption: null,
      sortOrder: 2,
    },
  ])

  await db.insert(schema.organizationReviews).values([
    {
      organizationId: org.id,
      authorId: patronA,
      rating: 5,
      body: 'Seeded review: welcoming crowd and clear expectations.',
    },
    {
      organizationId: org.id,
      authorId: patronB,
      rating: 4,
      body: 'Great events. Would love more weekend options.',
    },
  ])
  await db
    .update(schema.organizations)
    .set({ rating: 4.5, reviewCount: 2 })
    .where(eq(schema.organizations.id, org.id))

  await db
    .update(schema.organizations)
    .set({
      community: {
        welcomeHtml: DEMO_EAST_WELCOME_HTML,
        faq: [
          {
            q: 'How do people find me?',
            a: 'Introduce yourself in the welcome forum thread and say hi in chat. Key contacts and staff appear under Personnel on Overview.',
          },
          {
            q: 'Where are introductions?',
            a: 'Use the welcome thread in Forums. Overview has a small “Forums & chat” preview under Welcome so you can jump back in.',
          },
        ],
        links: [{ label: 'Platform guidelines (example)', url: 'https://example.com/c2k-guidelines' }],
        recapThreadId: thread.id,
      },
    })
    .where(eq(schema.organizations.id, org.id))

  await db
    .update(schema.organizationMembers)
    .set({ listedInOrgDirectory: true, volunteerTags: ['greeter'] })
    .where(
      and(eq(schema.organizationMembers.organizationId, org.id), eq(schema.organizationMembers.userId, leatherId))
    )

  console.log(
    'Seeded demo org hub content (rich bio, gallery, forum, chat, reviews, moderator member, community shell, recap thread) for demo-east-collective.'
  )
}

/** Stackable Overview sections (`community.communityModules`); idempotent. */
async function ensureDemoOrgCommunityModules() {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (!org) return
  const cur =
    org.community && typeof org.community === 'object' && !Array.isArray(org.community) ?
      { ...(org.community as Record<string, unknown>) }
    : {}
  if (Array.isArray(cur.communityModules) && (cur.communityModules as unknown[]).length > 0) return

  const demoModules = [
    {
      id: 'announcements',
      type: 'announcements' as const,
      title: 'Community notes',
      items: [
        {
          title: 'Introduce yourself',
          body: 'New? Drop a short intro in the welcome thread. Regulars watch that space.',
          dateLabel: 'Ongoing',
          link: null,
        },
      ],
    },
    {
      id: 'new-member',
      type: 'checklist' as const,
      title: 'Your first week here',
      items: [...DEMO_NEW_MEMBER_CHECKLIST_ITEMS],
    },
    {
      id: 'contacts',
      type: 'contacts' as const,
      title: 'Who to contact',
      rows: [
        {
          role: 'Safety / consent concerns',
          detail: 'safety@example.com (demo)',
          href: 'mailto:safety@example.com',
        },
        {
          role: 'Accessibility',
          detail: 'access@example.com (demo)',
          href: 'mailto:access@example.com',
        },
        {
          role: 'General questions',
          detail: 'Use Forums → #general or Chat',
          href: null,
        },
      ],
    },
    {
      id: 'library',
      type: 'documents' as const,
      title: 'Documents & forms',
      items: [
        { label: 'Consent & etiquette PDF (demo)', url: 'https://example.com/demo/org-consent.pdf', kind: 'pdf' as const },
        { label: 'Venue map (demo)', url: 'https://example.com/demo/venue-map', kind: 'link' as const },
      ],
    },
    {
      id: 'volunteer',
      type: 'volunteer' as const,
      title: 'Volunteer with us',
      bodyHtml: '<p>Door, setup, teardown, and newbie hosts. No experience required. Shadow a shift first.</p>',
      signupUrl: 'https://example.com/volunteer',
    },
    {
      id: 'vendors',
      type: 'featured_vendors' as const,
      title: 'Featured partners',
      maxItems: 6,
      emptyMessage: 'No partners featured yet.',
    },
    {
      id: 'safety-reporting',
      type: 'reporting' as const,
      title: 'Safety & reporting',
      introHtml:
        '<p>Something wrong at an event or online? Use <strong>Report to moderators</strong> (in-app) for staff review. For emergencies, contact local authorities first.</p>',
      reportUrl: null,
      policyHtml:
        '<p>Reports go to org moderators. We may not reply individually; repeated or severe issues can lead to removal from the org. Retaliation for reporting is grounds for immediate action.</p>',
    },
  ]

  await db
    .update(schema.organizations)
    .set({
      community: { ...cur, communityModules: demoModules } as unknown as typeof org.community,
    })
    .where(eq(schema.organizations.id, org.id))
  console.log('Seeded demo community page modules for demo-east-collective.')
}

/**
 * Fix older demo DB rows: drop venue-etiquette / event-highlight modules, refresh welcome + checklist copy.
 * Safe to run every seed; only updates demo-east-collective when drift is detected.
 */
async function normalizeDemoEastCollectiveCommunity() {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  if (!org) return

  const cur =
    org.community && typeof org.community === 'object' && !Array.isArray(org.community) ?
      { ...(org.community as Record<string, unknown>) }
    : {}
  let changed = false

  if (typeof cur.welcomeHtml === 'string') {
    if (
      cur.welcomeHtml.includes('RSVP on upcoming') ||
      cur.welcomeHtml.includes('Start here:</strong> Say hi') ||
      cur.welcomeHtml.includes('House &amp; play-space') ||
      cur.welcomeHtml.includes('House & play-space')
    ) {
      cur.welcomeHtml = DEMO_EAST_WELCOME_HTML
      changed = true
    }
  }

  if (Array.isArray(cur.faq)) {
    const faq = [...(cur.faq as { q: string; a: string }[])]
    let faqChanged = false
    for (let i = 0; i < faq.length; i++) {
      const row = faq[i]
      if (!row) continue
      if (row.q === 'Where are introductions?') {
        if (
          row.a.includes('activity on Overview links back') ||
          row.a.includes('Recent in forums & chat')
        ) {
          faq[i] = {
            ...row,
            a: 'Use the welcome thread in Forums. Overview has a small “Forums & chat” preview under Welcome so you can jump back in.',
          }
          faqChanged = true
        }
      }
      if (row.q === 'How do I show up in the member directory?') {
        faq[i] = {
          q: 'How do people find me?',
          a: 'Introduce yourself in the welcome forum thread and say hi in chat. Key contacts and staff appear under Personnel on Overview.',
        }
        faqChanged = true
      }
    }
    if (faqChanged) {
      cur.faq = faq
      changed = true
    }
  }

  const modules = cur.communityModules
  if (Array.isArray(modules)) {
    const afterLegacy = modules.filter(keepCommunityModuleRowForDemoSeed)
    const legacyRemoved = afterLegacy.length !== modules.length

    let checklistFixed = false
    const nextMods = afterLegacy.map((m) => {
      if (!m || typeof m !== 'object') return m
      const mod = m as { id?: string; type?: string; items?: unknown[] }
      if (mod.id !== 'new-member' || mod.type !== 'checklist' || !Array.isArray(mod.items)) return m
      const hasOldRsvpStep = mod.items.some(
        (it: unknown) =>
          it &&
          typeof it === 'object' &&
          'label' in it &&
          typeof (it as { label: string }).label === 'string' &&
          (it as { label: string }).label.includes('RSVP to one upcoming')
      )
      if (!hasOldRsvpStep) return m
      checklistFixed = true
      return { ...mod, items: [...DEMO_NEW_MEMBER_CHECKLIST_ITEMS] }
    })

    if (legacyRemoved || checklistFixed) {
      cur.communityModules = nextMods
      changed = true
    }
  }

  if (!changed) return

  await db
    .update(schema.organizations)
    .set({ community: cur as unknown as typeof org.community })
    .where(eq(schema.organizations.id, org.id))
  console.log('Normalized demo-east-collective community (welcome / modules / FAQ drift).')
}

const DEMO_PRESENTER_LINKS: Record<string, string> = {
  Website: 'https://example.com/rope-education-demo',
  'Link tree (demo)': 'https://example.com/links-demo',
}

const DEMO_RUNNER_MATERIALS: { label: string; url: string }[] = [
  { label: 'Room setup checklist (demo)', url: 'https://example.com/demo/rope-workshop-checklist' },
  { label: 'Participant handout PDF (demo)', url: 'https://example.com/demo/negotiation-handout.pdf' },
]

async function ensureDemoPresenterGalleryTeachingAndMaterials(userId: string) {
  const [galleryN] = await db
    .select({ n: count() })
    .from(schema.presenterGalleryImages)
    .where(eq(schema.presenterGalleryImages.userId, userId))
  if (Number(galleryN?.n ?? 0) === 0) {
    await db.insert(schema.presenterGalleryImages).values([
      {
        userId,
        imageUrl: 'https://picsum.photos/seed/c2k-rope-demo-1/600/600',
        caption: 'Demo gallery image. Teaching floor work (seed data).',
        sortOrder: 0,
      },
      {
        userId,
        imageUrl: 'https://picsum.photos/seed/c2k-rope-demo-2/600/600',
        caption: 'Demo gallery image. Negotiation workshop setup (seed data).',
        sortOrder: 1,
      },
    ])
    console.log('Seeded demo presenter gallery images for RopeDreamer.')
  }

  const [creditN] = await db
    .select({ n: count() })
    .from(schema.presenterTeachingCredits)
    .where(eq(schema.presenterTeachingCredits.presenterUserId, userId))
  if (Number(creditN?.n ?? 0) === 0) {
    await db.insert(schema.presenterTeachingCredits).values([
      {
        presenterUserId: userId,
        title: 'Negotiation 101',
        eventName: 'Demo East Collective weekend (seed)',
        eventDate: '2025-09-14',
        detailUrl: 'https://example.com/demo/event-negotiation-101',
        verified: false,
      },
      {
        presenterUserId: userId,
        title: 'Floor rope fundamentals',
        eventName: 'Regional rope meetup (seed)',
        eventDate: '2024-11-02',
        verified: false,
      },
    ])
    console.log('Seeded demo teaching log entries for RopeDreamer.')
  }

  const offerings = await db
    .select()
    .from(schema.presenterOfferings)
    .where(eq(schema.presenterOfferings.userId, userId))
  const needsMaterials = offerings.find(
    (o) => !Array.isArray(o.runnerMaterials) || o.runnerMaterials.length === 0
  )
  if (needsMaterials) {
    await db
      .update(schema.presenterOfferings)
      .set({ runnerMaterials: DEMO_RUNNER_MATERIALS, updatedAt: new Date() })
      .where(eq(schema.presenterOfferings.id, needsMaterials.id))
    console.log('Seeded demo runner materials on RopeDreamer offering.')
  }
}

async function ensureDemoEducationArticles(userId: string) {
  const [existingSlug] = await db
    .select({ slug: schema.educationArticles.slug })
    .from(schema.educationArticles)
    .where(eq(schema.educationArticles.slug, 'negotiation-101-basics'))
    .limit(1)
  if (existingSlug) {
    console.log('Demo education articles already seeded; skip.')
    return
  }

  const offerings = await db
    .select({ id: schema.presenterOfferings.id })
    .from(schema.presenterOfferings)
    .where(eq(schema.presenterOfferings.userId, userId))
    .limit(1)
  const linkedOfferingIds = offerings[0]?.id ? [offerings[0].id] : []

  const publishedAt = new Date('2025-08-01T12:00:00.000Z')
  const articles: (typeof schema.educationArticles.$inferInsert)[] = [
    {
      authorUserId: userId,
      presenterProfileUserId: userId,
      slug: 'negotiation-101-basics',
      title: 'Negotiation 101: Basics for pick-up play',
      excerpt:
        'A practical framework for naming limits, desires, and aftercare before a scene. Seeded demo article for the education hub.',
      bodyJson: {},
      bodyHtml: sanitizeEducationHtml(
        '<h2>Start with vocabulary</h2><p>Use the same words for hard limits, soft limits, and desires. Write them down if nerves run high.</p><h2>Check-in scripts</h2><p>Practice short scripts for munches and private negotiation. Demo seed copy only.</p>',
      ),
      heroImageUrl: 'https://picsum.photos/seed/c2k-edu-negotiation/1200/630',
      categories: ['Beginner', 'Safety'],
      difficulty: 'Beginner',
      contentWarnings: ['Discussion of BDSM negotiation'],
      readingMinutes: 4,
      linkedOfferingIds,
      visibility: 'PUBLIC',
      listInEducation: true,
      publicationStatus: 'PUBLISHED',
      publishedAt,
    },
    {
      authorUserId: userId,
      presenterProfileUserId: userId,
      slug: 'rope-floor-fundamentals',
      title: 'Floor rope fundamentals',
      excerpt: 'Body mechanics, frictions, and safety shears. A beginner-friendly rope primer (demo seed).',
      bodyJson: {},
      bodyHtml: sanitizeEducationHtml(
        '<p>Keep rope flat against skin, watch circulation, and keep shears within reach. This article is fictional demo content.</p>',
      ),
      heroImageUrl: 'https://picsum.photos/seed/c2k-edu-rope/1200/630',
      categories: ['Beginner', 'Gear'],
      difficulty: 'Beginner',
      contentWarnings: ['Rope bondage'],
      readingMinutes: 3,
      linkedOfferingIds: [],
      visibility: 'PUBLIC',
      listInEducation: true,
      publicationStatus: 'PUBLISHED',
      publishedAt: new Date('2025-08-15T12:00:00.000Z'),
    },
    {
      authorUserId: userId,
      presenterProfileUserId: userId,
      slug: 'consent-check-ins-with-video',
      title: 'Consent check-ins that actually stick',
      excerpt: 'Short mid-scene check-ins and aftercare prompts. Includes a demo embed slot.',
      bodyJson: {},
      bodyHtml: sanitizeEducationHtml(
        '<p>Pause, breathe, ask one clear question. Demo embed below (YouTube allowlist):</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe><p>Replace with your own workshop recording in production.</p>',
      ),
      heroImageUrl: null,
      categories: ['Safety', 'Psychology'],
      difficulty: 'All levels',
      contentWarnings: ['Consent discussion'],
      readingMinutes: estimateReadingMinutes(
        '<p>Pause, breathe, ask one clear question.</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
      ),
      linkedOfferingIds: [],
      visibility: 'PUBLIC',
      listInEducation: true,
      publicationStatus: 'PUBLISHED',
      publishedAt: new Date('2025-09-01T12:00:00.000Z'),
    },
    {
      authorUserId: userId,
      presenterProfileUserId: userId,
      slug: 'event-etiquette-at-munches',
      title: 'Event etiquette at munches',
      excerpt: 'How to introduce yourself, read the room, and respect venue staff. Demo community education copy.',
      bodyJson: {},
      bodyHtml: sanitizeEducationHtml(
        '<p>Arrive on time, pay your tab, and treat the venue like a guest in someone else home. Ask before photographing anyone.</p>',
      ),
      heroImageUrl: 'https://picsum.photos/seed/c2k-edu-munch/1200/630',
      categories: ['Event Etiquette'],
      difficulty: 'Beginner',
      contentWarnings: ['Social situations'],
      readingMinutes: 2,
      linkedOfferingIds: [],
      visibility: 'PUBLIC',
      listInEducation: true,
      publicationStatus: 'PUBLISHED',
      publishedAt: new Date('2025-09-10T12:00:00.000Z'),
    },
    {
      authorUserId: userId,
      presenterProfileUserId: userId,
      slug: 'advanced-negotiation-draft',
      title: 'Advanced negotiation (draft. Not on hub)',
      excerpt: 'Work-in-progress draft for author preview only.',
      bodyJson: {},
      bodyHtml: sanitizeEducationHtml('<p>Draft body. Not listed in the public education hub.</p>'),
      heroImageUrl: null,
      categories: ['Advanced'],
      difficulty: 'Advanced',
      contentWarnings: ['Draft content'],
      readingMinutes: 1,
      linkedOfferingIds: [],
      visibility: 'PUBLIC',
      listInEducation: false,
      publicationStatus: 'DRAFT',
      publishedAt: null,
    },
  ]

  await db.insert(schema.educationArticles).values(articles)
  console.log(`Seeded ${articles.length} demo education articles for RopeDreamer (4 published on hub).`)
}

async function ensureDemoEducationSeries(userId: string) {
  const [existing] = await db
    .select({ id: schema.educationArticleSeries.id })
    .from(schema.educationArticleSeries)
    .where(eq(schema.educationArticleSeries.slug, 'kink-101'))
    .limit(1)
  if (existing) {
    console.log('Demo education series kink-101 already seeded; skip.')
    return
  }

  const slugs = ['negotiation-101-basics', 'consent-check-ins-with-video', 'event-etiquette-at-munches']
  const articleRows = await db
    .select({ id: schema.educationArticles.id, slug: schema.educationArticles.slug })
    .from(schema.educationArticles)
    .where(and(eq(schema.educationArticles.authorUserId, userId), inArray(schema.educationArticles.slug, slugs)))

  const bySlug = new Map(articleRows.map((r) => [r.slug, r.id]))
  const articleIds = slugs.map((s) => bySlug.get(s)).filter(Boolean) as string[]
  if (articleIds.length < 3) {
    console.log('Demo education series skipped. Need 3 published demo articles first.')
    return
  }

  const [series] = await db
    .insert(schema.educationArticleSeries)
    .values({
      authorUserId: userId,
      title: 'Kink 101',
      slug: 'kink-101',
      description: 'A short beginner path: negotiation, consent check-ins, and munch etiquette.',
    })
    .returning()

  await db.insert(schema.educationArticleSeriesItems).values(
    articleIds.map((articleId, i) => ({
      seriesId: series!.id,
      articleId,
      sortOrder: i + 1,
    })),
  )
  console.log('Seeded demo education series kink-101 (3 parts).')
}

async function seedDemoPresenterCatalog(userId: string) {
  const [existing] = await db
    .select()
    .from(schema.presenterProfiles)
    .where(eq(schema.presenterProfiles.userId, userId))
    .limit(1)
  if (!existing) {
    await db.insert(schema.presenterProfiles).values({
      userId,
      headline: 'Rope & negotiation educator',
      bioShort: 'Workshops on rope fundamentals, consent check-ins, and negotiation for scenes.',
      bio: 'Educator profile for directory and convention linking. Update your bio anytime in Settings → Presenter catalog.',
      links: DEMO_PRESENTER_LINKS,
      profileKind: 'BOTH',
      expertiseTags: ['rope', 'negotiation', 'consent'],
      directoryVisibility: 'PUBLIC',
    })
    await db.insert(schema.presenterOfferings).values({
      userId,
      title: 'Negotiation for pick-up play',
      tease: 'A 60-minute structured format: boundaries, limits, desires, and aftercare expectations. For munches or cons.',
      outline:
        '1) Framing & vocabulary\n2) Self-assessment worksheet\n3) Paired practice with scripts\n4) Q&A',
      durationMinutes: 60,
      level: 'All levels',
      format: 'Workshop',
      tags: ['negotiation', 'consent', 'social'],
      runnerMaterials: DEMO_RUNNER_MATERIALS,
      isPublic: true,
      sortOrder: 0,
    })
    console.log('Seeded demo presenter profile + offering for RopeDreamer.')
  } else if (!existing.links || Object.keys(existing.links).length === 0) {
    await db
      .update(schema.presenterProfiles)
      .set({ links: DEMO_PRESENTER_LINKS, updatedAt: new Date() })
      .where(eq(schema.presenterProfiles.userId, userId))
    console.log('Updated RopeDreamer presenter profile with demo social links.')
  }

  await ensureDemoPresenterGalleryTeachingAndMaterials(userId)
  await ensureDemoEducationArticles(userId)
  await ensureDemoEducationSeries(userId)
}

/** Public site blurbs only - fictional C2K seed, not affiliated with the real festival. */
const PAF_PUBLIC_SITE = 'https://www.primalartsfest.com/'
const PAF_ORG_SLUG = 'primal-arts-festival'
const PAF_CON_SLUG = 'primal-arts-fest-2026'
const PAF_ANCHOR_TITLE = 'Primal Arts Fest 2026 (C2K demo seed)'
/** Org-calendar row for Overview “monthly munch” preview (idempotent by title + org). */
const PAF_ORG_MONTHLY_MUNCH_TITLE = 'PAF seed: Monthly Corridor Munch (demo)'
/** Extra forum thread so Overview “Forums & chat” always shows a clear community row (idempotent by title). */
const PAF_OVERVIEW_COMMUNITY_THREAD = 'PAF seed: Welcome. Introduce yourself (demo)'
const PAF_FORUM_MARKER = 'PAF seed: volunteer & parking coordination'
/** 48-char hex token for dancecard share URL (same length as other seed tokens). */
const PAF_DANCECARD_SHARE_TOKEN = 'fedcba9876543210fedcba9876543210fedcba9876543210'
const PAF_SOURCE_NOTE =
  'Fictional C2K seed inspired by public themes from primalartsfest.com. Not affiliated. Program is synthetic (not imported from external spreadsheets).'

/**
 * Second full-surface org hub: Primal Arts Fest–inspired camping weekender (synthetic program).
 * Idempotent: skips entirely when convention `primal-arts-fest-2026` already exists.
 * Includes: org bio/forums/chat, anchor event + vendors on calendar, multi-day schedule with
 * presenters + photographer slot staff, volunteer shift, access grants, ISO posts + board pins,
 * and a dancecard share link + sample busy blocks.
 */
async function ensurePrimalArtsFestivalDemo(hostId: string) {
  const [dupConv] = await db.select().from(schema.conventions).where(eq(schema.conventions.slug, PAF_CON_SLUG)).limit(1)
  if (dupConv) {
    console.log('Primal Arts Fest demo already present; skip PAF seed.')
    return
  }

  const [rope] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)
  if (!rope) {
    console.log('RopeDreamer missing; skip PAF seed.')
    return
  }
  const leatherId = await getOrCreateLeatherDemoUserId()
  const shutterId = await getOrCreateShutterDemoUserId()
  await ensureLeatherDemoPresenterProfileForPreview(leatherId)

  const [ropeOffering] = await db
    .select()
    .from(schema.presenterOfferings)
    .where(eq(schema.presenterOfferings.userId, rope.id))
    .orderBy(asc(schema.presenterOfferings.sortOrder))
    .limit(1)
  const [leatherOffering] = await db
    .select()
    .from(schema.presenterOfferings)
    .where(eq(schema.presenterOfferings.userId, leatherId))
    .orderBy(asc(schema.presenterOfferings.sortOrder))
    .limit(1)

  let [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, PAF_ORG_SLUG)).limit(1)
  if (!org) {
    const [o] = await db
      .insert(schema.organizations)
      .values({
        slug: PAF_ORG_SLUG,
        displayName: 'Primal Arts Fest (demo)',
        bio: `<p><strong>${PAF_SOURCE_NOTE}</strong></p>
<p>Four-day, 21+ <strong>camping-style</strong> gathering (demo venue): fire &amp; flow, workshops, artisan market, sacred sexuality &amp; kink education. Built on <strong>consent</strong> and risk-aware practice. Blurbs echo themes from <a href="${PAF_PUBLIC_SITE}" rel="noopener noreferrer">primalartsfest.com</a>; this org is for <strong>C2K UI testing only</strong>.</p>
<ul><li>Open the <strong>Calendar</strong> tab for the seeded weekend pass event.</li><li><strong>Forums</strong> and <strong>Chat</strong> include sample festival-ops chatter.</li><li>Program + ISO + dancecard live on the linked convention page.</li></ul>`,
        bioFormat: 'html',
        ownerId: hostId,
        visibility: 'PUBLIC',
        galleryPublic: true,
      })
      .returning()
    org = o!
    if (!org) return
    await db.insert(schema.organizationMembers).values([
      { organizationId: org.id, userId: hostId, role: 'OWNER' },
      { organizationId: org.id, userId: leatherId, role: 'MODERATOR' },
      { organizationId: org.id, userId: shutterId, role: 'MEMBER' },
    ])
    await db.insert(schema.forumCategories).values({
      organizationId: org.id,
      name: 'Festival general',
      sortOrder: 0,
    })
    await db.insert(schema.orgChannels).values({
      organizationId: org.id,
      slug: 'general',
      name: 'general',
      kind: 'TEXT',
    })
    const [vRope] = await db
      .select()
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.slug, 'rope-dreamer-supply'))
      .limit(1)
    const [vLeather] = await db
      .select()
      .from(schema.vendorProfiles)
      .where(eq(schema.vendorProfiles.slug, 'mid-atlantic-leatherworks'))
      .limit(1)
    if (vRope) {
      await db.insert(schema.organizationFeaturedVendors).values({
        organizationId: org.id,
        vendorProfileId: vRope.id,
        sortOrder: 0,
        label: 'Artisan rope & aftercare (seed)',
      })
    }
    if (vLeather) {
      await db.insert(schema.organizationFeaturedVendors).values({
        organizationId: org.id,
        vendorProfileId: vLeather.id,
        sortOrder: 1,
        label: 'Leather & impact booth (seed)',
      })
    }
    console.log(`Seeded organization ${PAF_ORG_SLUG}.`)
  }

  const [cat] = await db
    .select()
    .from(schema.forumCategories)
    .where(eq(schema.forumCategories.organizationId, org.id))
    .limit(1)
  const [marker] = await db
    .select({ id: schema.forumThreads.id })
    .from(schema.forumThreads)
    .where(and(eq(schema.forumThreads.organizationId, org.id), eq(schema.forumThreads.title, PAF_FORUM_MARKER)))
    .limit(1)
  if (!marker && cat) {
    const [thread] = await db
      .insert(schema.forumThreads)
      .values({
        organizationId: org.id,
        categoryId: cat.id,
        title: PAF_FORUM_MARKER,
        authorId: rope.id,
      })
      .returning()
    if (thread) {
      await db.insert(schema.forumPosts).values([
        {
          threadId: thread.id,
          authorId: rope.id,
          body: 'PAF seed forum: Gate opens at noon Thursday (demo). Volunteers: check in here for parking assignments.',
        },
        {
          threadId: thread.id,
          authorId: leatherId,
          body: 'PAF seed forum: Photo policy. House photographers wear lime vests; ask before shooting near fire circle.',
        },
        {
          threadId: thread.id,
          authorId: rope.id,
          body: 'PAF seed forum: Quiet camping row is north loop. Generator curfew 11pm demo time.',
        },
      ])
      await db.update(schema.forumThreads).set({ updatedAt: new Date() }).where(eq(schema.forumThreads.id, thread.id))
    }
  }

  const [ch] = await db.select().from(schema.orgChannels).where(eq(schema.orgChannels.organizationId, org.id)).limit(1)
  if (ch) {
    const [{ nChat }] = await db
      .select({ nChat: count() })
      .from(schema.orgChannelMessages)
      .where(
        and(eq(schema.orgChannelMessages.orgChannelId, ch.id), like(schema.orgChannelMessages.body, 'PAF seed chat:%')),
      )
    if (Number(nChat) === 0) {
      await db.insert(schema.orgChannelMessages).values([
        {
          orgChannelId: ch.id,
          senderId: rope.id,
          body: 'PAF seed chat: Welcome desk is row A. Badges + safer-knot ribbons until 8pm.',
        },
        {
          orgChannelId: ch.id,
          senderId: leatherId,
          body: 'PAF seed chat: Fire safety briefing moved to 7:30 at main field (demo).',
        },
        {
          orgChannelId: ch.id,
          senderId: shutterId,
          body: 'PAF seed chat: Photo desk. Release forms on the table; no flash during ritual blocks.',
        },
        {
          orgChannelId: ch.id,
          senderId: rope.id,
          body: 'PAF seed chat: Market opens Friday 4pm. Vendor power strips are first-come (seed).',
        },
      ])
    }
  }

  const startsAt = new Date('2026-09-10T20:00:00.000Z')
  const endsAt = new Date('2026-09-14T04:00:00.000Z')
  let [anchor] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.title, PAF_ANCHOR_TITLE))
    .limit(1)
  if (!anchor) {
    const [ins] = await db
      .insert(schema.events)
      .values({
        hostId,
        organizationId: org.id,
        title: PAF_ANCHOR_TITLE,
        description: `Demo anchor for a four-day camping festival: workshops (kink education, movement, spirituality), fire & flow, artisan market, and volunteer shifts. ${PAF_SOURCE_NOTE}`,
        location: 'Demo 200-acre campground, Midwest USA (fictional)',
        startsAt,
        endsAt,
        category: 'Convention',
        tags: ['paf-seed', 'camping', 'festival', 'demo'],
        eventFormat: 'in-person',
        ticketPurchaseUrl: PAF_PUBLIC_SITE,
        ticketingProvider: 'external',
        rsvpCount: 0,
        dressCode: 'Camping casual; ritual blocks may suggest darker tones (demo).',
        expectedCostText: 'Tiered passes (demo. See public site for real-world pricing).',
      })
      .returning()
    anchor = ins
  }
  if (!anchor) return

  const [vRope] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.slug, 'rope-dreamer-supply'))
    .limit(1)
  const [vLeather] = await db
    .select()
    .from(schema.vendorProfiles)
    .where(eq(schema.vendorProfiles.slug, 'mid-atlantic-leatherworks'))
    .limit(1)
  const [{ contribN }] = await db
    .select({ contribN: count() })
    .from(schema.eventContributors)
    .where(eq(schema.eventContributors.eventId, anchor.id))
  if (Number(contribN) === 0) {
    await db.insert(schema.eventContributors).values([
      ...(vRope ?
        [
          {
            eventId: anchor.id,
            kind: 'vendor' as const,
            vendorProfileId: vRope.id,
            label: `${vRope.displayName} (market)`,
            description: 'Jute, shears, aftercare. Demo tabling partner.',
            sortOrder: 0,
          },
        ]
      : []),
      ...(vLeather ?
        [
          {
            eventId: anchor.id,
            kind: 'vendor' as const,
            vendorProfileId: vLeather.id,
            label: `${vLeather.displayName} (market)`,
            description: 'Leather goods & impact toys. Demo tabling partner.',
            sortOrder: 1,
          },
        ]
      : []),
      {
        eventId: anchor.id,
        kind: 'sponsor' as const,
        label: 'Demo fire fuel partner (fictional)',
        description: 'Sponsor-style row for contributor strip UI.',
        sortOrder: 2,
      },
      {
        eventId: anchor.id,
        kind: 'presenter_support' as const,
        userId: shutterId,
        label: 'House photography pool',
        description: 'Photographers on rotation. See program staff rows on fire & market blocks.',
        sortOrder: 3,
      },
    ])
  }

  for (const uid of [rope.id, leatherId, shutterId]) {
    const [r] = await db
      .select()
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, anchor.id), eq(schema.eventRsvps.userId, uid)))
      .limit(1)
    if (!r) {
      await db.insert(schema.eventRsvps).values({ eventId: anchor.id, userId: uid, status: 'going' })
    }
  }

  const [conv] = await db
    .insert(schema.conventions)
    .values({
      slug: PAF_CON_SLUG,
      name: 'Primal Arts Fest 2026 (demo program)',
      description: `Synthetic multi-track schedule: rituals, workshops, market, and photographer staffing. ${PAF_SOURCE_NOTE}`,
      organizationId: org.id,
      anchorEventId: anchor.id,
      timezone: 'America/Chicago',
      startsAt: anchor.startsAt,
      endsAt: anchor.endsAt ?? anchor.startsAt,
      settings: {
        publicProgramListing: true,
        isoBoardEnabled: true,
        venueProfile: 'camping',
        programStaffAttendeeRoles: ['photo', 'photographer', 'official'],
        hotelBlocks: [{ label: 'On-site camping (demo)', url: PAF_PUBLIC_SITE, code: 'PAF-DEMO' }],
        safetyReportingNote: 'Consent-first demo copy. Escalate to festival ops (seed only).',
        accessibilityVenueNotes: 'Main paths graded gravel in this demo dataset; ask ops for golf-cart escort (fictional).',
      },
    })
    .returning()
  if (!conv) return
  const conventionId = conv.id
  const t0 = conv.startsAt.getTime()
  const atHour = (h: number) => new Date(t0 + h * 60 * 60 * 1000)

  await db.insert(schema.scheduleSlots).values([
    {
      conventionId,
      startsAt: atHour(0),
      endsAt: atHour(3),
      title: 'PAF demo: Arrival, waivers & camp map pickup',
      description: 'Land acknowledgement + consent culture primer (synthetic block).',
      location: 'Main pavilion',
      sortOrder: 0,
      trackLabel: 'Ops',
      roomLabel: 'Pavilion',
      importKey: 'paf-seed-arrival',
    },
    {
      conventionId,
      startsAt: atHour(4),
      endsAt: atHour(6),
      title: 'PAF demo: Opening fire circle (photography boundaries)',
      description: 'House photographers introduce vests + no-flash zones; ritual safety overview.',
      location: 'Fire field',
      sortOrder: 1,
      trackLabel: 'Ritual',
      roomLabel: 'Fire field',
      importKey: 'paf-seed-fire-open',
    },
    {
      conventionId,
      startsAt: atHour(8),
      endsAt: atHour(10),
      title: 'PAF demo: Risk-aware scenes & negotiation (201)',
      description: 'Kink education track. Negotiation frames before play parties.',
      location: 'Teaching tent A',
      sortOrder: 2,
      trackLabel: 'Education',
      roomLabel: 'Tent A',
      importKey: 'paf-seed-neg201',
      presenterOfferingId: ropeOffering?.id,
    },
    {
      conventionId,
      startsAt: atHour(12),
      endsAt: atHour(14.5),
      title: 'PAF demo: Impact toys & body mechanics',
      description: 'Practical skills. Warm-ups, aim, and check-ins (demo class).',
      location: 'Teaching tent B',
      sortOrder: 3,
      trackLabel: 'Education',
      roomLabel: 'Tent B',
      importKey: 'paf-seed-impact',
      presenterOfferingId: leatherOffering?.id,
    },
    {
      conventionId,
      startsAt: atHour(18),
      endsAt: atHour(21),
      title: 'PAF demo: Artisan market + body art consults',
      description: 'Market stroll; tattoo & modification consults by appointment (demo).',
      location: 'Vendor row',
      sortOrder: 4,
      trackLabel: 'Market',
      roomLabel: 'Vendor meadow',
      importKey: 'paf-seed-market',
    },
    {
      conventionId,
      startsAt: atHour(30),
      endsAt: atHour(32),
      title: 'PAF demo: Sacred sexuality discussion salon',
      description: 'Facilitated circle. Opt-in shares; no graphic demos (seed).',
      location: 'Sanctuary tent',
      sortOrder: 5,
      trackLabel: 'Discussion',
      roomLabel: 'Sanctuary',
      importKey: 'paf-seed-salon',
    },
    {
      conventionId,
      startsAt: atHour(40),
      endsAt: atHour(44),
      title: 'PAF demo: Flow & fire performance rehearsal',
      description: 'Performer-only block on schedule; attendees see title only (demo).',
      location: 'Fire field',
      sortOrder: 6,
      trackLabel: 'Performance',
      roomLabel: 'Fire field',
      importKey: 'paf-seed-flow-rehearse',
    },
    {
      conventionId,
      startsAt: atHour(52),
      endsAt: atHour(56),
      title: 'PAF demo: Closing gratitude & strike briefing',
      description: 'Leave-no-trace walkthrough + volunteer sign-ups for strike (seed).',
      location: 'Pavilion',
      sortOrder: 7,
      trackLabel: 'Ops',
      roomLabel: 'Pavilion',
      importKey: 'paf-seed-close',
    },
  ])

  const pafSlots = await db
    .select()
    .from(schema.scheduleSlots)
    .where(and(eq(schema.scheduleSlots.conventionId, conventionId), like(schema.scheduleSlots.importKey, 'paf-seed-%')))
  const byImport = new Map<string, (typeof pafSlots)[0]>()
  for (const s of pafSlots) {
    if (s.importKey) byImport.set(s.importKey, s)
  }

  async function pafPresenter(key: string, userId: string, sortOrder: number) {
    const slot = byImport.get(key)
    if (!slot) return
    const [ex] = await db
      .select()
      .from(schema.scheduleSlotPresenters)
      .where(
        and(eq(schema.scheduleSlotPresenters.scheduleSlotId, slot.id), eq(schema.scheduleSlotPresenters.userId, userId)),
      )
      .limit(1)
    if (ex) return
    await db.insert(schema.scheduleSlotPresenters).values({ scheduleSlotId: slot.id, userId, sortOrder })
  }

  async function pafStaff(
    key: string,
    userId: string,
    roleLabel: string,
    station: string | null,
    notes: string | null,
    startsAt: Date,
    endsAt: Date
  ) {
    const slot = byImport.get(key)
    if (!slot) return
    const [ex] = await db
      .select({ id: schema.scheduleSlotStaff.id })
      .from(schema.scheduleSlotStaff)
      .where(
        and(
          eq(schema.scheduleSlotStaff.scheduleSlotId, slot.id),
          eq(schema.scheduleSlotStaff.userId, userId),
          eq(schema.scheduleSlotStaff.roleLabel, roleLabel),
        ),
      )
      .limit(1)
    if (ex) return
    await db.insert(schema.scheduleSlotStaff).values({
      scheduleSlotId: slot.id,
      userId,
      roleLabel,
      station,
      notes,
      startsAt,
      endsAt,
      updatedAt: new Date(),
    })
  }

  await pafPresenter('paf-seed-neg201', rope.id, 0)
  await pafPresenter('paf-seed-impact', leatherId, 0)

  const fireSlot = byImport.get('paf-seed-fire-open')
  if (fireSlot) {
    await pafStaff(
      'paf-seed-fire-open',
      shutterId,
      'Photographer',
      'House pool lead',
      'PAF seed: lime-vest rotation + boundary flags.',
      fireSlot.startsAt,
      fireSlot.endsAt,
    )
  }
  const marketSlot = byImport.get('paf-seed-market')
  if (marketSlot) {
    await pafStaff(
      'paf-seed-market',
      shutterId,
      'Photographer',
      'Vendor row rove',
      'PAF seed: booth hero shots + attendee opt-in wristband check.',
      marketSlot.startsAt,
      marketSlot.endsAt,
    )
  }

  const [{ volN }] = await db
    .select({ volN: count() })
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conventionId))
  if (Number(volN) === 0) {
    await db.insert(schema.conventionVolunteerShifts).values({
      conventionId,
      title: 'PAF demo: Gate & parking (volunteer)',
      description: 'Wave cars, check wristbands, hand maps (seed row).',
      startsAt: atHour(0),
      endsAt: atHour(4),
      location: 'Front gate',
      capacityMax: 8,
      sortOrder: 0,
    })
  }

  async function pafAccess(
    userId: string,
    role: 'ATTENDEE' | 'STAFF' | 'MODERATOR',
    paidConfirmed: boolean,
    attendingConfirmed: boolean,
    staffPreAccess: boolean
  ) {
    const [g] = await db
      .select()
      .from(schema.conventionAccessGrants)
      .where(and(eq(schema.conventionAccessGrants.conventionId, conventionId), eq(schema.conventionAccessGrants.userId, userId)))
      .limit(1)
    if (g) return
    await db.insert(schema.conventionAccessGrants).values({
      conventionId,
      userId,
      role,
      paidConfirmed,
      attendingConfirmed,
      staffPreAccess,
    })
  }
  await pafAccess(rope.id, 'MODERATOR', true, true, false)
  await pafAccess(leatherId, 'STAFF', true, true, false)
  await pafAccess(shutterId, 'ATTENDEE', true, true, false)

  const now = new Date()
  const ropeIsoBody =
    'PAF ISO seed: Seeking duet partners for slow-fire rope lab + aftercare swaps. Evenings preferred; sober-friendly.'
  const leatherIsoBody =
    'PAF ISO seed: Looking for impact switch practice before the big Saturday market. Negotiate hard limits first.'
  for (const row of [
    { userId: rope.id, body: ropeIsoBody },
    { userId: leatherId, body: leatherIsoBody },
  ] as const) {
    await db
      .insert(schema.userIsoPosts)
      .values({
        userId: row.userId,
        body: row.body,
        visibility: 'PUBLIC',
        acceptDmsViaIso: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.userIsoPosts.userId,
        set: { body: row.body, visibility: 'PUBLIC', acceptDmsViaIso: true, updatedAt: now },
      })
    const [exListing] = await db
      .select()
      .from(schema.conventionIsoListings)
      .where(and(eq(schema.conventionIsoListings.conventionId, conventionId), eq(schema.conventionIsoListings.userId, row.userId)))
      .limit(1)
    if (!exListing) {
      await db.insert(schema.conventionIsoListings).values({ conventionId, userId: row.userId })
    }
  }

  const tEnd = conv.endsAt.getTime()
  const busyStart = new Date(t0 + 6 * 60 * 60 * 1000)
  const busyEnd = new Date(Math.min(tEnd, t0 + 10 * 60 * 60 * 1000))
  if (busyEnd.getTime() > busyStart.getTime()) {
    await db.insert(schema.dancecardEntries).values([
      {
        conventionId,
        userId: rope.id,
        title: 'PAF seed: Host. Registration + ops overlap',
        startsAt: busyStart,
        endsAt: busyEnd,
        sourceKind: 'manual',
        notes: 'seed:paf-dancecard',
      },
      {
        conventionId,
        userId: leatherId,
        title: 'PAF seed: Guest. Market booth coverage',
        startsAt: new Date(t0 + 18 * 60 * 60 * 1000),
        endsAt: new Date(Math.min(tEnd, t0 + 22 * 60 * 60 * 1000)),
        sourceKind: 'manual',
        notes: 'seed:paf-dancecard',
      },
    ])
  }

  const [exShare] = await db
    .select()
    .from(schema.conventionDancecardShareLinks)
    .where(eq(schema.conventionDancecardShareLinks.token, PAF_DANCECARD_SHARE_TOKEN))
    .limit(1)
  if (!exShare) {
    await db.insert(schema.conventionDancecardShareLinks).values({
      conventionId,
      ownerUserId: rope.id,
      token: PAF_DANCECARD_SHARE_TOKEN,
      label: 'PAF demo dancecard (seed)',
    })
  }

  console.log(
    `Primal Arts Fest demo ready: /orgs/${PAF_ORG_SLUG}. Program /conventions/${PAF_CON_SLUG}. Dancecard /conventions/${PAF_CON_SLUG}/dancecard/s/${PAF_DANCECARD_SHARE_TOKEN}`,
  )
}

/**
 * Idempotent extras for PAF orgs that were seeded before overview modules / gallery stills existed,
 * or to refresh demo RSVP density and convention role for RopeDreamer (attendee-style grant).
 */
async function ensurePafOrgHubOverviewExtras() {
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, PAF_ORG_SLUG)).limit(1)
  if (!org) return

  const [ropePaf] = await db.select().from(schema.users).where(eq(schema.users.username, 'RopeDreamer')).limit(1)

  const localAssets = syncPafSeedImagesFromLocalDisk()
  if (localAssets) {
    const orgPatch: { bannerUrl?: string | null; logoUrl?: string | null } = {}
    if (localAssets.bannerUrl) orgPatch.bannerUrl = localAssets.bannerUrl
    if (localAssets.logoUrl) orgPatch.logoUrl = localAssets.logoUrl
    if (Object.keys(orgPatch).length > 0) {
      await db.update(schema.organizations).set(orgPatch).where(eq(schema.organizations.id, org.id))
      console.log('Updated PAF org banner/logo from local seed images.')
    }
    if (localAssets.gallery.length > 0) {
      await db.delete(schema.organizationGalleryImages).where(
        and(
          eq(schema.organizationGalleryImages.organizationId, org.id),
          or(
            like(schema.organizationGalleryImages.caption, 'PAF seed gallery:%'),
            like(schema.organizationGalleryImages.imageUrl, '/seed/paf/gallery-%'),
            like(schema.organizationGalleryImages.imageUrl, '/api/public-seed/paf/gallery-%'),
          ),
        ),
      )
      await db.insert(schema.organizationGalleryImages).values(
        localAssets.gallery.map((g) => ({
          organizationId: org.id,
          imageUrl: g.imageUrl,
          caption: g.caption,
          sortOrder: g.sortOrder,
        })),
      )
      console.log(`Refreshed PAF org gallery (${localAssets.gallery.length} images from local seed).`)
    }
  }

  const demoPw = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
  const hash = await bcrypt.hash(demoPw, 10)

  async function ensurePatron(username: string, email: string, displayName: string): Promise<string> {
    const [ex] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1)
    if (ex) {
      await ensureUserSettingsForUser(ex.id)
      return ex.id
    }
    const [u] = await db.insert(schema.users).values({ username, email, passwordHash: hash }).returning()
    if (!u) throw new Error(`insert ${username}`)
    await db.insert(schema.profiles).values({
      userId: u.id,
      displayName,
      bio: 'Seeded RSVP for Primal Arts Fest demo.',
      visibility: 'PUBLIC',
    })
    await ensureUserSettingsForUser(u.id)
    return u.id
  }

  const cur =
    org.community && typeof org.community === 'object' && !Array.isArray(org.community) ?
      { ...(org.community as Record<string, unknown>) }
    : {}
  const modulesRaw = Array.isArray(cur.communityModules) ? [...(cur.communityModules as unknown[])] : []
  const annId = 'paf-overview-announcements'
  const communityAnnouncements = {
    id: annId,
    type: 'announcements' as const,
    enabled: true,
    title: 'Announcements',
    items: [
      {
        title: 'Event: Primal Arts Festival 2026 registration open!',
        body: 'Reserve your spot for the September demo weekend. Say hi in Forums after you RSVP.',
        dateLabel: 'Now open',
        link: null,
      },
      {
        title: 'Early bird rates end soon!',
        body: 'Demo early-bird pricing is limited; standard weekend tiers follow (seed timeline).',
        dateLabel: 'Limited time',
        link: null,
      },
    ],
  }
  const withoutAnn = modulesRaw.filter((m) => !(m && typeof m === 'object' && (m as { id?: string }).id === annId))
  const nextModules = [communityAnnouncements, ...withoutAnn]
  await db
    .update(schema.organizations)
    .set({ community: { ...cur, communityModules: nextModules } as unknown as typeof org.community })
    .where(eq(schema.organizations.id, org.id))
  console.log('Synced PAF org overview announcements (community-facing).')

  const [pafForumCat] = await db
    .select()
    .from(schema.forumCategories)
    .where(eq(schema.forumCategories.organizationId, org.id))
    .limit(1)
  if (ropePaf && pafForumCat) {
    const [welcomeHit] = await db
      .select()
      .from(schema.forumThreads)
      .where(
        and(
          eq(schema.forumThreads.organizationId, org.id),
          eq(schema.forumThreads.title, PAF_OVERVIEW_COMMUNITY_THREAD),
        ),
      )
      .limit(1)
    if (!welcomeHit) {
      const [th] = await db
        .insert(schema.forumThreads)
        .values({
          organizationId: org.id,
          categoryId: pafForumCat.id,
          title: PAF_OVERVIEW_COMMUNITY_THREAD,
          authorId: ropePaf.id,
          updatedAt: new Date(),
        })
        .returning()
      if (th) {
        await db.insert(schema.forumPosts).values({
          threadId: th.id,
          authorId: ropePaf.id,
          body: 'Say hi before the weekend. This thread is for quick intros and questions. (Seed post for org Overview preview.)',
        })
        await db.update(schema.forumThreads).set({ updatedAt: new Date() }).where(eq(schema.forumThreads.id, th.id))
      }
      console.log('Seeded PAF community welcome forum thread for Overview activity.')
    }
  }

  if (ropePaf) {
    const [munchHit] = await db
      .select()
      .from(schema.events)
      .where(and(eq(schema.events.organizationId, org.id), eq(schema.events.title, PAF_ORG_MONTHLY_MUNCH_TITLE)))
      .limit(1)
    if (!munchHit) {
      const soon = new Date()
      soon.setUTCDate(soon.getUTCDate() + 14)
      soon.setUTCHours(19, 0, 0, 0)
      const endsAt = new Date(soon.getTime() + 2.5 * 60 * 60 * 1000)
      await db.insert(schema.events).values({
        hostId: ropePaf.id,
        organizationId: org.id,
        title: PAF_ORG_MONTHLY_MUNCH_TITLE,
        description: 'Monthly corridor social munch. Rotate venues on the forum (synthetic org calendar row).',
        location: 'Demo public house · Chambersburg (fictional)',
        startsAt: soon,
        endsAt,
        category: 'Munch',
        tags: ['munch', 'social', 'paf-org-calendar'],
        eventFormat: 'in-person',
        newcomerFriendly: true,
        expectedCostText: 'Cash bar; separate checks (seed).',
      })
      console.log('Seeded PAF org monthly munch for overview calendar.')
    }
  }

  const [{ nPafG }] = await db
    .select({ nPafG: count() })
    .from(schema.organizationGalleryImages)
    .where(
      and(
        eq(schema.organizationGalleryImages.organizationId, org.id),
        like(schema.organizationGalleryImages.caption, 'PAF seed gallery:%'),
      ),
    )
  if (!localAssets?.gallery?.length && Number(nPafG ?? 0) === 0) {
    const shots: { url: string; cap: string }[] = [
      {
        url: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=900&q=80',
        cap: 'PAF seed gallery: fire circle evening (demo)',
      },
      {
        url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80',
        cap: 'PAF seed gallery: campsite glow (demo)',
      },
      {
        url: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=900&q=80',
        cap: 'PAF seed gallery: forest path between workshops (demo)',
      },
      {
        url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
        cap: 'PAF seed gallery: night sky over field (demo)',
      },
      {
        url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=900&q=80',
        cap: 'PAF seed gallery: festival lights (demo)',
      },
      {
        url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80',
        cap: 'PAF seed gallery: workshop tent (demo)',
      },
    ]
    await db.insert(schema.organizationGalleryImages).values(
      shots.map((s, i) => ({
        organizationId: org.id,
        imageUrl: s.url,
        caption: s.cap,
        sortOrder: i,
      })),
    )
    console.log('Seeded PAF organization gallery stills.')
  }

  const [anchor] = await db.select().from(schema.events).where(eq(schema.events.title, PAF_ANCHOR_TITLE)).limit(1)
  if (!anchor) return

  let addedRsvp = false
  for (const [un, em, dn] of [
    ['PafPatronA', 'paf-patron-a@demo.local', 'River Ash'],
    ['PafPatronB', 'paf-patron-b@demo.local', 'Ember Vale'],
    ['PafPatronC', 'paf-patron-c@demo.local', 'Slate North'],
  ] as const) {
    const uid = await ensurePatron(un, em, dn)
    const [exR] = await db
      .select()
      .from(schema.eventRsvps)
      .where(and(eq(schema.eventRsvps.eventId, anchor.id), eq(schema.eventRsvps.userId, uid)))
      .limit(1)
    if (!exR) {
      await db.insert(schema.eventRsvps).values({ eventId: anchor.id, userId: uid, status: 'going' })
      addedRsvp = true
    }
  }
  if (addedRsvp) {
    await refreshEventRsvpCount(anchor.id)
    console.log('Seeded extra PAF anchor RSVPs for attendee facepile.')
  }

  const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.slug, PAF_CON_SLUG)).limit(1)
  if (ropePaf && conv) {
    const [grant] = await db
      .select()
      .from(schema.conventionAccessGrants)
      .where(and(eq(schema.conventionAccessGrants.conventionId, conv.id), eq(schema.conventionAccessGrants.userId, ropePaf.id)))
      .limit(1)
    if (grant && grant.role !== 'ATTENDEE') {
      await db
        .update(schema.conventionAccessGrants)
        .set({ role: 'ATTENDEE' })
        .where(and(eq(schema.conventionAccessGrants.conventionId, conv.id), eq(schema.conventionAccessGrants.userId, ropePaf.id)))
      console.log('Set RopeDreamer PAF convention grant to ATTENDEE (demo attendee preview).')
    }
  }

  for (const [username, seed] of [
    ['RopeDreamer', 'c2k-paf-rope'],
    ['LeatherCraftDemo', 'c2k-paf-leather'],
    ['ShutterSeed', 'c2k-paf-shutter'],
    ['PafPatronA', 'c2k-paf-pa'],
    ['PafPatronB', 'c2k-paf-pb'],
    ['PafPatronC', 'c2k-paf-pc'],
  ] as const) {
    const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username)).limit(1)
    if (!u) continue
    const avatarUrl = `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(seed)}`
    await db.update(schema.profiles).set({ avatarUrl }).where(eq(schema.profiles.userId, u.id))
  }
  console.log('Set generic demo avatar URLs for PAF anchor RSVPs / patrons.')
}

/** Preserve prior mod+ access: grant org MODERATORs all command domains on each org convention. */
async function ensureModeratorCommandGrants() {
  const orgConventions = await db
    .select({
      conventionId: schema.conventions.id,
      organizationId: schema.conventions.organizationId,
    })
    .from(schema.conventions)
    .where(sql`${schema.conventions.organizationId} IS NOT NULL`)

  let upserted = 0
  for (const row of orgConventions) {
    if (!row.organizationId) continue
    const moderators = await db
      .select({ userId: schema.organizationMembers.userId })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, row.organizationId),
          eq(schema.organizationMembers.role, 'MODERATOR'),
        ),
      )
    for (const mod of moderators) {
      await db
        .insert(schema.conventionCommandGrants)
        .values({
          conventionId: row.conventionId,
          userId: mod.userId,
          canRegistration: true,
          canStaffOps: true,
          canScheduler: true,
          note: 'Seed: legacy org MODERATOR full command access',
        })
        .onConflictDoUpdate({
          target: [schema.conventionCommandGrants.conventionId, schema.conventionCommandGrants.userId],
          set: {
            canRegistration: true,
            canStaffOps: true,
            canScheduler: true,
          },
        })
      upserted++
    }
  }
  if (upserted > 0) {
    console.log(`Ensured command grants for ${upserted} org MODERATOR convention pairs.`)
  }
}

/** Remove Playwright smoke posts left in local Postgres (body prefix `e2e-`). */
/** Regional “nearby people” requires profiles.state_id (not just location text). */
async function ensureDemoProfileStateIds() {
  const [pa] = await db
    .select({ id: schema.states.id })
    .from(schema.states)
    .where(eq(schema.states.name, 'Pennsylvania'))
    .limit(1)
  if (!pa) {
    console.log('PA state missing. Run npm run db:seed:locations -w @c2k/api for regional people suggestions.')
    return
  }
  const demoUsernames = ['Brax', 'RopeDreamer', 'ShutterSeed', 'LeatherCraftDemo', 'TrustedRoleApplicantDemo'] as const
  const users = await db
    .select({ userId: schema.users.id })
    .from(schema.users)
    .where(inArray(schema.users.username, [...demoUsernames]))
  let updated = 0
  for (const { userId } of users) {
    const [row] = await db
      .update(schema.profiles)
      .set({ stateId: pa.id })
      .where(and(eq(schema.profiles.userId, userId), sql`${schema.profiles.stateId} IS NULL`))
      .returning({ userId: schema.profiles.userId })
    if (row) updated++
  }
  if (updated > 0) {
    console.log(`Set stateId=PA on ${updated} demo profile(s) for regional suggestions.`)
  }
}

async function cleanupE2eFeedPosts() {
  const removed = await db
    .delete(schema.feedPosts)
    .where(like(schema.feedPosts.body, 'e2e-%'))
    .returning({ id: schema.feedPosts.id })
  if (removed.length > 0) {
    console.log(`Removed ${removed.length} e2e test feed post(s) from local database.`)
  }
}

const PASS4_PUBLIC_GROUP_SLUG = 'pass4-public-test-group'
const PASS4_APPROVAL_GROUP_SLUG = 'pass4-approval-test-group'
const PASS4_PUBLIC_EVENT_TITLE = 'Pass4 Public Event'
const PASS4_PRIVATE_EVENT_TITLE = 'Pass4 Private Event'
const PASS4_GROUP_PRIVATE_EVENT_TITLE = 'Pass4 Group Private Event'
const PASS4_ORG_PRIVATE_EVENT_TITLE = 'Pass4 Org Private Event'

/** Idempotent Playwright Pass 4 fixtures — neutral alpha names; safe for local/dev/test only. */
async function ensurePass4TestFixtures(ctx: {
  ropeId: string
  braxId: string
  orgId?: string | null
}) {
  const { ropeId, braxId, orgId } = ctx

  let pass4GroupId: string | undefined
  const [existingPublicGroup] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.slug, PASS4_PUBLIC_GROUP_SLUG))
    .limit(1)
  if (existingPublicGroup) {
    pass4GroupId = existingPublicGroup.id
    await db
      .update(schema.groups)
      .set({
        name: 'Pass4 Public Test Group',
        visibility: 'public',
        category: 'Education',
        tags: ['pass4', 'test', 'education'],
        description: 'Discoverable alpha test group for Pass 4 directory Playwright checks.',
        ownerId: ropeId,
        organizationId: orgId ?? existingPublicGroup.organizationId,
      })
      .where(eq(schema.groups.id, existingPublicGroup.id))
  } else {
    const [g] = await db
      .insert(schema.groups)
      .values({
        slug: PASS4_PUBLIC_GROUP_SLUG,
        name: 'Pass4 Public Test Group',
        visibility: 'public',
        category: 'Education',
        tags: ['pass4', 'test', 'education'],
        description: 'Discoverable alpha test group for Pass 4 directory Playwright checks.',
        ownerId: ropeId,
        organizationId: orgId ?? null,
      })
      .returning()
    if (g) {
      pass4GroupId = g.id
      console.log('Seeded Pass4 Public Test Group.')
    }
  }

  if (pass4GroupId) {
    for (const [userId, role] of [
      [ropeId, 'owner'],
      [braxId, 'member'],
    ] as const) {
      const [mem] = await db
        .select({ id: schema.groupMembers.id })
        .from(schema.groupMembers)
        .where(and(eq(schema.groupMembers.groupId, pass4GroupId), eq(schema.groupMembers.userId, userId)))
        .limit(1)
      if (!mem) {
        await db.insert(schema.groupMembers).values({ groupId: pass4GroupId, userId, role })
      }
    }
  }

  const [existingApprovalGroup] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.slug, PASS4_APPROVAL_GROUP_SLUG))
    .limit(1)
  if (!existingApprovalGroup) {
    const [g] = await db
      .insert(schema.groups)
      .values({
        slug: PASS4_APPROVAL_GROUP_SLUG,
        name: 'Pass4 Approval Test Group',
        visibility: 'private',
        category: 'Discussion',
        tags: ['pass4', 'test', 'private'],
        description: 'Approval-required alpha test group for access/privacy checks.',
        ownerId: ropeId,
        organizationId: orgId ?? null,
      })
      .returning()
    if (g) {
      await db.insert(schema.groupMembers).values({ groupId: g.id, userId: ropeId, role: 'owner' })
      console.log('Seeded Pass4 Approval Test Group.')
    }
  }

  const pass4EventBase = {
    hostId: ropeId,
    eventFormat: 'in-person' as const,
    category: 'Social',
    tags: ['pass4', 'test'],
  }

  const [publicEv] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.title, PASS4_PUBLIC_EVENT_TITLE))
    .limit(1)
  if (!publicEv) {
    const start = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    await db.insert(schema.events).values({
      ...pass4EventBase,
      title: PASS4_PUBLIC_EVENT_TITLE,
      description: 'Public alpha test event for Pass 4 global discovery checks.',
      location: 'Demo City, PA',
      startsAt: start,
      endsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
      visibility: 'public',
      category: 'Munch',
      rsvpCount: 3,
    })
    console.log(`Seeded ${PASS4_PUBLIC_EVENT_TITLE}.`)
  }

  const [privateEv] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.title, PASS4_PRIVATE_EVENT_TITLE))
    .limit(1)
  if (!privateEv) {
    const start = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
    await db.insert(schema.events).values({
      ...pass4EventBase,
      title: PASS4_PRIVATE_EVENT_TITLE,
      description: 'Private alpha test event — strangers must not load detail by UUID (Pass 2A.2).',
      location: 'Private venue (demo only)',
      startsAt: start,
      endsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
      visibility: 'private',
      rsvpCount: 0,
    })
    console.log(`Seeded ${PASS4_PRIVATE_EVENT_TITLE}.`)
  }

  if (pass4GroupId) {
    const [groupPrivateEv] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.title, PASS4_GROUP_PRIVATE_EVENT_TITLE))
      .limit(1)
    if (!groupPrivateEv) {
      const start = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
      await db.insert(schema.events).values({
        ...pass4EventBase,
        title: PASS4_GROUP_PRIVATE_EVENT_TITLE,
        description: 'Group-scoped private alpha test event for group access checks.',
        location: 'Group space (demo only)',
        startsAt: start,
        endsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        visibility: 'private',
        groupId: pass4GroupId,
        rsvpCount: 0,
      })
      console.log(`Seeded ${PASS4_GROUP_PRIVATE_EVENT_TITLE}.`)
    }
  }

  if (orgId) {
    const [orgPrivateEv] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.title, PASS4_ORG_PRIVATE_EVENT_TITLE))
      .limit(1)
    if (!orgPrivateEv) {
      const start = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000)
      await db.insert(schema.events).values({
        ...pass4EventBase,
        title: PASS4_ORG_PRIVATE_EVENT_TITLE,
        description: 'Org-scoped private alpha test event for org access checks.',
        location: 'Org venue (demo only)',
        startsAt: start,
        endsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        visibility: 'private',
        organizationId: orgId,
        rsvpCount: 0,
      })
      console.log(`Seeded ${PASS4_ORG_PRIVATE_EVENT_TITLE}.`)
    }
  }
}

export async function runFullSeed() {
  await seedKinkTags()
  const brax = await ensureBraxSiteAdmin()
  const rope = await getOrCreateDemoUser()
  await getOrCreateOnboardingFreshUser()
  await ensurePass4TestFixtures({ ropeId: rope.id, braxId: brax.id })
  await seedDemoPresenterCatalog(rope.id)
  await seedDemoVendors(rope.id)
  await ensureVendorCategoryTagsBackfill()
  await ensureDemoVendorBranding()
  await ensureDemoVendorCatalog()
  await seedDemoOrganization(brax.id)
  await ensureDemoOrgStaffMembers(brax.id)
  await ensureBlendedVirtualDemoEvents(rope.id)
  await ensureSeedUserRsvpOnOrgEvent()
  await ensureGatedConventionWithAttendeeGrant(rope.id)
  await seedDemoAnchoredConventionProgram()
  await ensureDemoConventionProgramExtras()
  await ensureRichPreviewConvention(rope.id)
  await ensureDancecardDemoMockData()
  await ensureDemoOrgHubContent()
  await ensureDemoOrgCommunityModules()
  await normalizeDemoEastCollectiveCommunity()
  await ensureModeratorCommandGrants()
  await ensureDemoProfileStateIds()
  await cleanupE2eFeedPosts()

  const { seedModerationDemo } = await import('./seed-moderation-demo.js')
  await seedModerationDemo(brax.id, rope.id)

  const { seedEckeRichExperience } = await import('./ecke-rich-seed.js')
  const [orgRow] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'demo-east-collective'))
    .limit(1)
  const [convRow] = await db
    .select({ id: schema.conventions.id })
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, 'preview-c2k-weekend'))
    .limit(1)
  if (orgRow) {
    await seedEckeRichExperience({
      braxId: brax.id,
      ropeId: rope.id,
      leatherId: await getOrCreateLeatherDemoUserId(),
      shutterId: await getOrCreateShutterDemoUserId(),
      orgId: orgRow.id,
      previewConventionId: convRow?.id,
    })
  }
  await ensureVendorCoOwnersSeed()

  const [phillyPlace] = await db
    .select({ id: schema.places.id })
    .from(schema.places)
    .where(eq(schema.places.name, 'Philadelphia'))
    .limit(1)

  const [groupEx] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.slug, 'mid-atlantic-rope-social'))
    .limit(1)
  const demoGroupFields = {
    category: 'Education' as const,
    tags: ['rope', 'social'],
    description: 'Regional rope education and social meetups across the Mid-Atlantic.',
    placeId: phillyPlace?.id ?? null,
  }
  if (groupEx) {
    await db
      .update(schema.groups)
      .set(demoGroupFields)
      .where(eq(schema.groups.id, groupEx.id))
  } else {
    const [g] = await db
      .insert(schema.groups)
      .values({
        slug: 'mid-atlantic-rope-social',
        name: 'Mid-Atlantic Rope Social',
        visibility: 'public',
        organizationId: orgRow?.id ?? null,
        ownerId: rope.id,
        ...demoGroupFields,
      })
      .returning()
    if (g) {
      await db.insert(schema.groupMembers).values([
        { groupId: g.id, userId: rope.id, role: 'owner' },
        { groupId: g.id, userId: brax.id, role: 'moderator' },
        { groupId: g.id, userId: await getOrCreateShutterDemoUserId(), role: 'member' },
      ])
    }
  }

  await ensurePass4TestFixtures({ ropeId: rope.id, braxId: brax.id, orgId: orgRow?.id ?? null })
}
