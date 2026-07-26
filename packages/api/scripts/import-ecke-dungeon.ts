/**
 * Import one ECKE static dungeon listing into a kink.social org + community place.
 *
 * Usage:
 *   USE_DATABASE=true npx tsx packages/api/scripts/import-ecke-dungeon.ts --slug baltimore-playhouse
 *   USE_DATABASE=true npx tsx packages/api/scripts/import-ecke-dungeon.ts --slug baltimore-playhouse --issue-claim-token
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { and, eq } from 'drizzle-orm'
import '../src/db/load-dev-env.js'
import { db, schema } from '../src/db/index.js'
import { syncEckeDungeonLogo } from '../src/db/ecke-seed-images.js'
import {
  mapEckeDungeonToImport,
  type EckeImportSourceDungeon,
} from '../src/lib/ecke-dungeon-import-map.js'
import { mintClaimTokenValue, resolveClaimPublicUrl } from '../src/lib/org-claim.js'
import { venueOrgFeatureFlags } from '../src/lib/org-features.js'
import { syncOrgVenuePlace } from '../src/lib/org-venue-sync.js'
import { listSiteOwnerUserIds } from '../src/lib/platform-staff.js'

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
  if (!slug) throw new Error('Missing --slug <ecke-dungeon-slug>')
  return { slug, issueClaimToken, dryRun, operatorUserId }
}

async function loadEastCoastDungeon(slug: string): Promise<EckeImportSourceDungeon> {
  const { resolveEastCoastRepoRoot } = await import('../src/db/ecke-seed-images.js')
  const root = resolveEastCoastRepoRoot()
  if (!root) {
    throw new Error(
      'EastCoast repo not found. Set EASTCOAST_REPO to the EastCoast-master directory containing src/data/dungeons.js',
    )
  }
  const mod = await import(pathToFileURL(path.join(root, 'src/data/dungeons.js')).href)
  const raw: EckeImportSourceDungeon[] = mod.getAllDungeons?.() ?? mod.dungeons ?? []
  const hit = raw.find((d) => d.slug.toLowerCase() === slug)
  if (!hit) throw new Error(`Dungeon slug not found in ${root}/src/data/dungeons.js: ${slug}`)
  return hit
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
  const { resolveEastCoastRepoRoot } = await import('../src/db/ecke-seed-images.js')
  const eckeRoot = resolveEastCoastRepoRoot()
  if (!eckeRoot || !existsSync(path.join(eckeRoot, 'src/data/dungeons.js'))) {
    console.error('EastCoast repo not found')
    process.exit(1)
  }

  const source = await loadEastCoastDungeon(args.slug)
  const plan = mapEckeDungeonToImport(source)
  const logoUrl = plan.org.logoWebPath
    ? syncEckeDungeonLogo(eckeRoot, plan.eckeDungeonSlug, plan.org.logoWebPath)
    : null

  console.log('ECKE dungeon import plan:')
  console.log(`  org: ${plan.org.slug} (${plan.org.displayName})`)
  console.log(`  place: ${plan.place.slug} (${plan.place.category})`)
  console.log(`  eckeDungeonSlug: ${plan.eckeDungeonSlug}`)
  console.log(`  logo: ${logoUrl ?? '(none)'}`)

  if (args.dryRun) {
    console.log('Dry run — no database writes.')
    process.exit(0)
  }

  const operatorId = await resolveOperatorUserId(args.operatorUserId)
  console.log(`  operator: ${operatorId}`)

  const featureFlags = venueOrgFeatureFlags(plan.featureFlags)

  let orgId: string
  const [existingOrg] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, plan.org.slug))
    .limit(1)

  if (existingOrg) {
    orgId = existingOrg.id
    if (existingOrg.ownerId !== operatorId) {
      console.warn(`Org ${plan.org.slug} already exists with different owner — skipping owner change.`)
    } else {
      await db
        .update(schema.organizations)
        .set({
          displayName: plan.org.displayName,
          bio: plan.org.bio,
          externalSiteUrl: plan.org.externalSiteUrl,
          ...(logoUrl ? { logoUrl } : {}),
          featureFlags,
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
        featureFlags,
        galleryPublic: false,
        community: {
          emailListHeadline: `${plan.org.displayName} on Kink Social`,
          emailListBlurb: `Imported from East Coast Kink Events dungeon listing ${plan.eckeDungeonSlug}. Confirm hours and policies with the venue.`,
        },
      })
      .returning()
    if (!org) throw new Error('Failed to create organization')
    orgId = org.id
    await ensureOrgMember(orgId, operatorId, 'OWNER')
    console.log(`Created org ${plan.org.slug} (${orgId})`)
  }

  const [updatedOrg] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1)
  if (updatedOrg) await syncOrgVenuePlace(updatedOrg)

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
