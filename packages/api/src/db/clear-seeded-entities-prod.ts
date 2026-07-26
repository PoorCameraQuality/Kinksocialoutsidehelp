/**
 * Remove legacy/seed organizations, groups, vendors, and linked conventions/events.
 *
 * Run: ALLOW_ALPHA_PROD_CLEANUP=true FORCE_ALPHA_PROD_CLEANUP=true USE_DATABASE=true \
 *      npm run db:clear:seeded-entities -w @c2k/api
 */
import { eq, inArray, sql } from 'drizzle-orm'
import './load-dev-env.js'
import { db, schema } from './index.js'

const SEEDED_ORG_SLUGS = new Set(['demo-east-collective', 'dark-odyssey', 'primal-arts-festival'])
const SEEDED_VENDOR_SLUGS = new Set([
  'gggg',
  'rope-dreamer-supply',
  'bastille-and-bags',
  'alpha-qa-test-shop',
])
const SEEDED_EVENT_TITLES = new Set(['Lets test drinks', 'Dark Odyssey Fusion'])
const SEEDED_CONVENTION_SLUGS = new Set([
  'preview-c2k-weekend',
  'seed-demo-con-gated',
  'seed-demo-con-program',
  'dark-odyssey-fusion',
])

function dryRun(): boolean {
  return process.env.DRY_RUN === 'true'
}

function assertAllowed(): void {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true')
    process.exit(1)
  }
  if (process.env.ALLOW_ALPHA_PROD_CLEANUP !== 'true' || process.env.FORCE_ALPHA_PROD_CLEANUP !== 'true') {
    console.error('Set ALLOW_ALPHA_PROD_CLEANUP=true and FORCE_ALPHA_PROD_CLEANUP=true')
    process.exit(1)
  }
}

function isSeededOrgSlug(slug: string): boolean {
  return SEEDED_ORG_SLUGS.has(slug) || slug.startsWith('ecke-')
}

function isSeededGroupSlug(slug: string, name: string): boolean {
  return (
    slug.startsWith('alpha-social-') ||
    slug.startsWith('testgroup-') ||
    slug.startsWith('pass4-') ||
    name === 'TestGroup'
  )
}

function isSeededConventionSlug(slug: string): boolean {
  return SEEDED_CONVENTION_SLUGS.has(slug) || slug.startsWith('seed-demo-') || slug.startsWith('alpha-qa-test-')
}

function isSeededVendorSlug(slug: string): boolean {
  return SEEDED_VENDOR_SLUGS.has(slug) || slug.startsWith('alpha-qa-test-')
}

async function deleteConventions(conventionIds: string[]) {
  if (!conventionIds.length) return
  if (dryRun()) {
    console.log(`[dry-run] Would remove ${conventionIds.length} conventions (+ related program data)`)
    return
  }
  const hubChannels = await db
    .select({ id: schema.conventionHubChannels.id })
    .from(schema.conventionHubChannels)
    .where(inArray(schema.conventionHubChannels.conventionId, conventionIds))
  const hubChannelIds = hubChannels.map((r) => r.id)
  if (hubChannelIds.length) {
    await db
      .delete(schema.conventionHubChannelMessages)
      .where(inArray(schema.conventionHubChannelMessages.channelId, hubChannelIds))
    await db.delete(schema.conventionHubChannels).where(inArray(schema.conventionHubChannels.id, hubChannelIds))
  }
  await db.delete(schema.scheduleSlots).where(inArray(schema.scheduleSlots.conventionId, conventionIds))
  await db.delete(schema.conventions).where(inArray(schema.conventions.id, conventionIds))
  console.log(`Removed ${conventionIds.length} conventions`)
}

async function deleteEvents(eventIds: string[]) {
  if (!eventIds.length) return
  if (dryRun()) {
    console.log(`[dry-run] Would remove ${eventIds.length} events`)
    return
  }
  await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.eventId, eventIds))
  await db.delete(schema.events).where(inArray(schema.events.id, eventIds))
  console.log(`Removed ${eventIds.length} events`)
}

export async function clearSeededEntitiesProd() {
  console.log(dryRun() ? '=== DRY RUN (seeded entities) ===' : '=== LIVE (seeded entities) ===')

  const allOrgs = await db
    .select({
      id: schema.organizations.id,
      slug: schema.organizations.slug,
      displayName: schema.organizations.displayName,
    })
    .from(schema.organizations)
  const orgIds = allOrgs.filter((o) => isSeededOrgSlug(o.slug)).map((o) => o.id)
  for (const o of allOrgs.filter((o) => isSeededOrgSlug(o.slug))) {
    console.log(`  org: ${o.slug} (${o.displayName})`)
  }

  const allGroups = await db
    .select({ id: schema.groups.id, slug: schema.groups.slug, name: schema.groups.name })
    .from(schema.groups)
  const groupIds = allGroups.filter((g) => isSeededGroupSlug(g.slug, g.name)).map((g) => g.id)
  for (const g of allGroups.filter((g) => isSeededGroupSlug(g.slug, g.name))) {
    console.log(`  group: ${g.slug} (${g.name})`)
  }

  const allVendors = await db
    .select({ id: schema.vendorProfiles.id, slug: schema.vendorProfiles.slug, displayName: schema.vendorProfiles.displayName })
    .from(schema.vendorProfiles)
  const vendorIds = allVendors.filter((v) => isSeededVendorSlug(v.slug)).map((v) => v.id)
  for (const v of allVendors.filter((v) => isSeededVendorSlug(v.slug))) {
    console.log(`  vendor: ${v.slug} (${v.displayName})`)
  }

  const allConventions = await db
    .select({
      id: schema.conventions.id,
      slug: schema.conventions.slug,
      name: schema.conventions.name,
      anchorEventId: schema.conventions.anchorEventId,
    })
    .from(schema.conventions)
  const conventionsToDelete = allConventions.filter((c) => isSeededConventionSlug(c.slug))
  const conventionIds = conventionsToDelete.map((c) => c.id)
  for (const c of conventionsToDelete) {
    console.log(`  convention: ${c.slug} (${c.name})`)
  }

  const doomedOrgIdSet = new Set(orgIds)
  const allEvents = await db
    .select({
      id: schema.events.id,
      title: schema.events.title,
      organizationId: schema.events.organizationId,
    })
    .from(schema.events)
  const eventIdSet = new Set<string>()
  for (const e of allEvents) {
    if (SEEDED_EVENT_TITLES.has(e.title)) eventIdSet.add(e.id)
    if (e.organizationId != null && doomedOrgIdSet.has(e.organizationId)) eventIdSet.add(e.id)
  }
  for (const c of conventionsToDelete) {
    if (c.anchorEventId) eventIdSet.add(c.anchorEventId)
  }
  for (const e of allEvents.filter((ev) => eventIdSet.has(ev.id))) {
    console.log(`  event: ${e.title}`)
  }
  const eventIds = [...eventIdSet]

  await deleteConventions(conventionIds)
  await deleteEvents(eventIds)

  if (vendorIds.length) {
    if (dryRun()) console.log(`[dry-run] Would remove ${vendorIds.length} vendor profiles (+ products)`)
    else {
      await db.delete(schema.products).where(inArray(schema.products.vendorId, vendorIds))
      await db.delete(schema.vendorProfiles).where(inArray(schema.vendorProfiles.id, vendorIds))
      console.log(`Removed ${vendorIds.length} vendor profiles`)
    }
  }

  if (groupIds.length) {
    if (dryRun()) console.log(`[dry-run] Would remove ${groupIds.length} groups`)
    else {
      await db.delete(schema.groups).where(inArray(schema.groups.id, groupIds))
      console.log(`Removed ${groupIds.length} groups`)
    }
  }

  if (orgIds.length) {
    if (dryRun()) console.log(`[dry-run] Would remove ${orgIds.length} organizations`)
    else {
      await db.delete(schema.organizations).where(inArray(schema.organizations.id, orgIds))
      console.log(`Removed ${orgIds.length} organizations`)
    }
  }

  const [{ orgs }] = await db.select({ orgs: sql<number>`count(*)::int` }).from(schema.organizations)
  const [{ groups }] = await db.select({ groups: sql<number>`count(*)::int` }).from(schema.groups)
  const [{ vendors }] = await db.select({ vendors: sql<number>`count(*)::int` }).from(schema.vendorProfiles)
  const [{ events }] = await db.select({ events: sql<number>`count(*)::int` }).from(schema.events)
  const [{ conventions }] = await db.select({ conventions: sql<number>`count(*)::int` }).from(schema.conventions)
  console.log(
    `\nRemaining: orgs=${orgs} groups=${groups} vendors=${vendors} events=${events} conventions=${conventions}`,
  )
}

async function main() {
  assertAllowed()
  await clearSeededEntitiesProd()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
