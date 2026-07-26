/**
 * Import one ECKE static event listing into a 1:1 kink.social org + convention.
 *
 * Usage:
 *   USE_DATABASE=true npx tsx packages/api/scripts/import-ecke-event.ts --slug dark-odyssey-fusion
 *   USE_DATABASE=true npx tsx packages/api/scripts/import-ecke-event.ts --slug dark-odyssey-fusion --issue-claim-token
 *
 * Requires C2K_SITE_OWNER_USER_IDS (first id used as bootstrap owner).
 * Set EASTCOAST_REPO to the EastCoast-master root when not at the default path.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { and, eq } from 'drizzle-orm'
import '../src/db/load-dev-env.js'
import { db, schema } from '../src/db/index.js'
import {
  mapEckeEventToImport,
  type EckeImportSourceEvent,
} from '../src/lib/ecke-import-map.js'
import { mintClaimTokenValue, resolveClaimPublicUrl } from '../src/lib/org-claim.js'
import { serializeOrgFeatureFlags } from '../src/lib/org-features.js'
import { listSiteOwnerUserIds } from '../src/lib/platform-staff.js'
import {
  resolveEastCoastRepoRoot,
  syncEckeEventImage,
  syncEckeVendorLogo,
} from '../src/db/ecke-seed-images.js'

function parseArgs(argv: string[]) {
  let slug: string | null = null
  let issueClaimToken = false
  let dryRun = false
  let operatorUserId: string | null = null
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--slug' && argv[i + 1]) slug = argv[++i]!.trim().toLowerCase()
    else if (a === '--issue-claim-token') issueClaimToken = true
    else if (a === '--dry-run') dryRun = true
    else if (a === '--operator-user-id' && argv[i + 1]) operatorUserId = argv[++i]!.trim()
  }
  if (!slug) throw new Error('Missing --slug <ecke-event-slug>')
  return { slug, issueClaimToken, dryRun, operatorUserId }
}

async function loadEastCoastEvent(slug: string): Promise<EckeImportSourceEvent> {
  const root = resolveEastCoastRepoRoot()
  if (!root) {
    throw new Error(
      'EastCoast repo not found. Set EASTCOAST_REPO to the EastCoast-master directory containing src/data/events.js',
    )
  }
  const mod = await import(pathToFileURL(path.join(root, 'src/data/events.js')).href)
  const raw: EckeImportSourceEvent[] = mod.getAllEvents?.() ?? mod.events ?? []
  const hit = raw.find((e) => e.slug.toLowerCase() === slug)
  if (!hit) throw new Error(`Event slug not found in ${root}/src/data/events.js: ${slug}`)
  return hit
}

function rehostLogo(eckeRoot: string, orgSlug: string, webPath: string | null, eventSlug: string): string | null {
  if (!webPath) return null
  const fromEvent = syncEckeEventImage(eckeRoot, eventSlug, webPath)
  if (fromEvent) return fromEvent
  return syncEckeVendorLogo(eckeRoot, orgSlug, webPath)
}

async function resolveOperatorUserId(explicit: string | null): Promise<string> {
  if (explicit) return explicit
  const owners = await listSiteOwnerUserIds()
  if (!owners.length) {
    throw new Error('Set C2K_SITE_OWNER_USER_IDS or pass --operator-user-id')
  }
  return owners[0]!
}

async function ensureOrgMember(orgId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  const [existing] = await db
    .select({ id: schema.organizationMembers.id, role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.organizationId, orgId), eq(schema.organizationMembers.userId, userId)))
    .limit(1)
  if (existing) {
    if (existing.role !== role) {
      await db
        .update(schema.organizationMembers)
        .set({ role })
        .where(eq(schema.organizationMembers.id, existing.id))
    }
    return
  }
  await db.insert(schema.organizationMembers).values({ organizationId: orgId, userId, role })
}

async function main() {
  if (process.env.USE_DATABASE !== 'true') {
    console.error('Set USE_DATABASE=true')
    process.exit(1)
  }

  const args = parseArgs(process.argv)
  const eckeRoot = resolveEastCoastRepoRoot()
  if (!eckeRoot || !existsSync(path.join(eckeRoot, 'src/data/events.js'))) {
    console.error('EastCoast repo not found')
    process.exit(1)
  }

  const source = await loadEastCoastEvent(args.slug)
  const plan = mapEckeEventToImport(source)
  const logoUrl = rehostLogo(eckeRoot, plan.org.slug, plan.org.logoWebPath, plan.eckeEventSlug)

  console.log('ECKE import plan:')
  console.log(`  org: ${plan.org.slug} (${plan.org.displayName})`)
  console.log(`  convention: ${plan.convention.slug}`)
  console.log(`  eckeListingSlug: ${plan.convention.settings.eckeListingSlug}`)
  console.log(`  logo: ${logoUrl ?? '(none)'}`)

  if (args.dryRun) {
    console.log('Dry run — no database writes.')
    process.exit(0)
  }

  const operatorId = await resolveOperatorUserId(args.operatorUserId)
  console.log(`  operator: ${operatorId}`)
  const anchorImageUrl = logoUrl

  const hubFlags = serializeOrgFeatureFlags({
    calendarEnabled: true,
    forumsEnabled: true,
    chatEnabled: true,
    subgroupsEnabled: false,
  })

  let orgId: string
  const [existingOrg] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, plan.org.slug))
    .limit(1)

  if (existingOrg) {
    orgId = existingOrg.id
    if (existingOrg.ownerId !== operatorId) {
      const [ownerUser] = await db
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, existingOrg.ownerId))
        .limit(1)
      console.warn(
        `Org ${plan.org.slug} already owned by ${ownerUser?.username ?? existingOrg.ownerId} — skipping org recreate.`,
      )
    } else {
      await db
        .update(schema.organizations)
        .set({
          displayName: plan.org.displayName,
          bio: plan.org.bio,
          externalSiteUrl: plan.org.externalSiteUrl,
          ...(logoUrl ? { logoUrl } : {}),
          featureFlags: hubFlags,
          visibility: 'PUBLIC',
        })
        .where(eq(schema.organizations.id, orgId))
      await ensureOrgMember(orgId, operatorId, 'OWNER')
      console.log(`Updated org ${plan.org.slug}`)
    }
  } else {
    const [org] = await db
      .insert(schema.organizations)
      .values({
        slug: plan.org.slug,
        displayName: plan.org.displayName,
        bio: plan.org.bio,
        bioFormat: 'text',
        ownerId: operatorId,
        visibility: 'PUBLIC',
        logoUrl: logoUrl ?? undefined,
        externalSiteUrl: plan.org.externalSiteUrl,
        featureFlags: hubFlags,
        galleryPublic: false,
        community: {
          emailListHeadline: `${plan.org.displayName} on Kink Social`,
          emailListBlurb: `Imported from East Coast Kink Events listing ${plan.eckeEventSlug}. Confirm details with the organizer.`,
        },
      })
      .returning()
    if (!org) throw new Error('Failed to create organization')
    orgId = org.id
    await ensureOrgMember(orgId, operatorId, 'OWNER')
    console.log(`Created org ${plan.org.slug} (${orgId})`)
  }

  const [existingConv] = await db
    .select({ id: schema.conventions.id, slug: schema.conventions.slug })
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, plan.convention.slug))
    .limit(1)

  if (existingConv) {
    console.log(`Convention ${plan.convention.slug} already exists (${existingConv.id}) — skipped.`)
  } else {
    const [anchor] = await db
      .insert(schema.events)
      .values({
        hostId: operatorId,
        organizationId: orgId,
        title: plan.anchorEvent.title,
        description: plan.anchorEvent.description,
        location: plan.anchorEvent.location,
        publicLocationSummary: plan.anchorEvent.publicLocationSummary,
        startsAt: plan.anchorEvent.startsAt,
        endsAt: plan.anchorEvent.endsAt,
        visibility: 'public',
        category: plan.anchorEvent.category ?? undefined,
        imageUrl: anchorImageUrl ?? logoUrl ?? undefined,
        eventFormat: 'in-person',
        locationVisibility: 'public',
      })
      .returning()

    if (!anchor) throw new Error('Failed to create anchor event')

    const [conv] = await db
      .insert(schema.conventions)
      .values({
        slug: plan.convention.slug,
        name: plan.convention.name,
        description: plan.convention.description,
        organizationId: orgId,
        anchorEventId: anchor.id,
        timezone: plan.convention.timezone,
        startsAt: plan.convention.startsAt,
        endsAt: plan.convention.endsAt,
        settings: plan.convention.settings,
      })
      .returning()

    if (!conv) throw new Error('Failed to create convention')
    console.log(`Created convention ${conv.slug} (${conv.id}) with anchor event ${anchor.id}`)
  }

  if (args.issueClaimToken) {
    const token = mintClaimTokenValue()
    const expiresAt = new Date(Date.now() + 168 * 60 * 60 * 1000)
    const [invite] = await db
      .insert(schema.organizationClaimTokens)
      .values({
        organizationId: orgId,
        token,
        createdByUserId: operatorId,
        expiresAt,
      })
      .returning()
    console.log('\nClaim invite (one-time ownership transfer):')
    console.log(`  token: ${invite!.token}`)
    console.log(`  claimUrl: ${resolveClaimPublicUrl(invite!.token)}`)
    console.log(`  expires: ${invite!.expiresAt.toISOString()}`)
  }

  console.log('\nImport complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
