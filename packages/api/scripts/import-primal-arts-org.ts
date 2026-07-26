/**
 * Pre-generate the Primal Arts Festival organization on kink.social:
 * org profile, branding media, gallery, and hosting-credit events (2023–2026).
 *
 * Usage:
 *   USE_DATABASE=true npx tsx packages/api/scripts/import-primal-arts-org.ts
 *   USE_DATABASE=true npx tsx packages/api/scripts/import-primal-arts-org.ts --issue-claim-token
 *   USE_DATABASE=true npx tsx packages/api/scripts/import-primal-arts-org.ts --dry-run
 *
 * Requires C2K_SITE_OWNER_USER_IDS (first id used as bootstrap owner).
 * Set EASTCOAST_REPO when the EastCoast listing is not at the default path.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { and, eq, like } from 'drizzle-orm'
import '../src/db/load-dev-env.js'
import { db, schema } from '../src/db/index.js'
import { resolveEastCoastRepoRoot, syncEckeEventImage } from '../src/db/ecke-seed-images.js'
import {
  mapEckeEventToImport,
  type EckeImportSourceEvent,
} from '../src/lib/ecke-import-map.js'
import { mintClaimTokenValue, resolveClaimPublicUrl } from '../src/lib/org-claim.js'
import { serializeOrgFeatureFlags } from '../src/lib/org-features.js'
import { rehostOrgImportImage } from '../src/lib/org-import-media.js'
import { listSiteOwnerUserIds } from '../src/lib/platform-staff.js'

const ORG_SLUG = 'primal-arts-festival'
const ECKE_EVENT_SLUG = 'primal-arts-festival'
const PUBLIC_SITE = 'https://www.primalartsfest.com/'
const GALLERY_CAPTION_PREFIX = 'PAF import:'
const HOSTING_TAG = 'paf-hosting-credit'

/** Verified festival windows (Thu–Mon camping gatherings, Darlington MD). */
const HOSTING_CREDITS = [
  { year: 2023, start: '2023-09-21', end: '2023-09-25' },
  { year: 2024, start: '2024-05-09', end: '2024-05-13' },
  { year: 2025, start: '2025-05-08', end: '2025-05-12' },
  { year: 2026, start: '2026-05-07', end: '2026-05-11' },
] as const

const LOGO_SOURCE =
  process.env.PAF_IMPORT_LOGO_URL?.trim() ||
  'https://www.eastcoastkinkevents.com/images/primalarts.png'

/** Site photo used as org banner (hero) — no composite overlay. */
const BANNER_SOURCE =
  process.env.PAF_IMPORT_BANNER_URL?.trim() ||
  'https://images.squarespace-cdn.com/content/v1/68cda36dad246772ae711c7d/ba449b57-e517-4180-a6ec-d2fde8f19e41/paf24-kanin-0723-e1724093078265.jpg'

const GALLERY_SOURCES = [
  'https://images.squarespace-cdn.com/content/v1/68cda36dad246772ae711c7d/80bb82cf-bef7-4451-8825-6f4c9ac86909/kan_8028-pano-edit.jpg',
  'https://images.squarespace-cdn.com/content/v1/68cda36dad246772ae711c7d/8e687160-b3df-4ae9-8ed4-5aceea761199/BPAF25-254.jpg',
  'https://images.squarespace-cdn.com/content/v1/68cda36dad246772ae711c7d/705dfca6-e98e-4c5e-80db-eb6d64e53993/BPAF25-1384.jpg',
  'https://images.squarespace-cdn.com/content/v1/68cda36dad246772ae711c7d/553cd28c-3a34-4424-8f87-2fc047c36199/PAF25-KAN-1734-aa7751ea-dd65-418d-b757-aeaecdffc990.jpg',
  'https://images.squarespace-cdn.com/content/v1/68cda36dad246772ae711c7d/076dacd6-f732-4dfd-bcba-5caf802a43ab/PAF2023-by-BlueShootsYou-04625.png',
  'https://images.squarespace-cdn.com/content/v1/68cda36dad246772ae711c7d/0cb7ab5f-ffa2-47db-9264-4ca096f6771b/BPAF25-1938.jpg',
  'https://images.squarespace-cdn.com/content/v1/68cda36dad246772ae711c7d/fec16dbe-1b21-430b-826d-3eb5ababf615/Cabin+2.jpg',
  'https://images.squarespace-cdn.com/content/v1/68cda36dad246772ae711c7d/c5d2c574-cbf6-4d59-8438-e596f7061cb3/PAF25-KAN-2040.png',
] as const

function parseArgs(argv: string[]) {
  let issueClaimToken = false
  let dryRun = false
  let skipMedia = false
  let operatorUserId: string | null = null
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--issue-claim-token') issueClaimToken = true
    else if (a === '--dry-run') dryRun = true
    else if (a === '--skip-media') skipMedia = true
    else if (a === '--operator-user-id' && argv[i + 1]) operatorUserId = argv[++i]!.trim()
  }
  return { issueClaimToken, dryRun, skipMedia, operatorUserId }
}

function parseFestivalDayStart(isoDay: string): Date {
  return new Date(`${isoDay.slice(0, 10)}T16:00:00.000Z`)
}

function parseFestivalDayEnd(isoDay: string): Date {
  return new Date(`${isoDay.slice(0, 10)}T04:00:00.000Z`)
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
      await db.update(schema.organizationMembers).set({ role }).where(eq(schema.organizationMembers.id, existing.id))
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
    console.warn('EastCoast repo not found — using built-in org copy only.')
  }

  const source = eckeRoot ? await loadEastCoastEvent(ECKE_EVENT_SLUG) : null
  const plan = source ? mapEckeEventToImport(source) : null
  const bio =
    plan?.org.bio ??
    'Primal Arts Fest is a four-day, 21+ clothing-optional gathering in Darlington, Maryland that blends fire, ritual, art, education, and primal expression.'

  console.log('Primal Arts org import plan:')
  console.log(`  org slug: ${ORG_SLUG}`)
  console.log(`  hosting credits: ${HOSTING_CREDITS.map((h) => h.year).join(', ')}`)
  console.log(`  logo source: ${LOGO_SOURCE}`)
  console.log(`  banner source: ${BANNER_SOURCE}`)
  console.log(`  gallery images: ${GALLERY_SOURCES.length}`)

  if (args.dryRun) {
    console.log('Dry run — no database writes.')
    process.exit(0)
  }

  const operatorId = await resolveOperatorUserId(args.operatorUserId)
  console.log(`  operator: ${operatorId}`)

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
    .where(eq(schema.organizations.slug, ORG_SLUG))
    .limit(1)

  if (existingOrg) {
    orgId = existingOrg.id
    await db
      .update(schema.organizations)
      .set({
        displayName: 'Primal Arts Festival',
        bio,
        bioFormat: 'text',
        externalSiteUrl: PUBLIC_SITE,
        featureFlags: hubFlags,
        visibility: 'PUBLIC',
        galleryPublic: true,
        community: {
          emailListHeadline: 'Primal Arts Festival on Kink Social',
          emailListBlurb:
            'Updates from the Primal Arts Fest organizers. Confirm dates and registration at primalartsfest.com.',
        },
      })
      .where(eq(schema.organizations.id, orgId))
    await ensureOrgMember(orgId, operatorId, 'OWNER')
    console.log(`Updated org ${ORG_SLUG} (${orgId})`)
  } else {
    const [org] = await db
      .insert(schema.organizations)
      .values({
        slug: ORG_SLUG,
        displayName: 'Primal Arts Festival',
        bio,
        bioFormat: 'text',
        ownerId: operatorId,
        visibility: 'PUBLIC',
        externalSiteUrl: PUBLIC_SITE,
        featureFlags: hubFlags,
        galleryPublic: true,
        community: {
          emailListHeadline: 'Primal Arts Festival on Kink Social',
          emailListBlurb:
            'Updates from the Primal Arts Fest organizers. Confirm dates and registration at primalartsfest.com.',
        },
      })
      .returning()
    if (!org) throw new Error('Failed to create organization')
    orgId = org.id
    await ensureOrgMember(orgId, operatorId, 'OWNER')
    console.log(`Created org ${ORG_SLUG} (${orgId})`)
  }

  if (!args.skipMedia) {
    let logoUrl: string | null = null
    let bannerUrl: string | null = null

    if (eckeRoot && source?.logo) {
      logoUrl = syncEckeEventImage(eckeRoot, ECKE_EVENT_SLUG, source.logo)
    }
    try {
      logoUrl = logoUrl ?? (await rehostOrgImportImage({ orgId, assetName: 'logo', sourceUrl: LOGO_SOURCE, width: 512 }))
      bannerUrl = await rehostOrgImportImage({ orgId, assetName: 'banner', sourceUrl: BANNER_SOURCE, width: 2000 })
    } catch (err) {
      console.warn('Branding rehost failed:', err)
    }

    if (logoUrl || bannerUrl) {
      await db
        .update(schema.organizations)
        .set({
          ...(logoUrl ? { logoUrl } : {}),
          ...(bannerUrl ? { bannerUrl, shareImageUrl: bannerUrl } : {}),
        })
        .where(eq(schema.organizations.id, orgId))
      console.log(`Branding: logo=${logoUrl ?? '(unchanged)'} banner=${bannerUrl ?? '(unchanged)'}`)
    }

    const [existingGallery] = await db
      .select({ id: schema.organizationGalleryImages.id })
      .from(schema.organizationGalleryImages)
      .where(
        and(
          eq(schema.organizationGalleryImages.organizationId, orgId),
          like(schema.organizationGalleryImages.caption, `${GALLERY_CAPTION_PREFIX}%`),
        ),
      )
      .limit(1)

    if (existingGallery) {
      console.log('Gallery rows already imported — skipped.')
    } else {
      let sortOrder = 0
      for (const src of GALLERY_SOURCES) {
        try {
          const imageUrl = await rehostOrgImportImage({
            orgId,
            assetName: `gallery-${sortOrder + 1}`,
            sourceUrl: src,
          })
          if (!imageUrl) continue
          await db.insert(schema.organizationGalleryImages).values({
            organizationId: orgId,
            imageUrl,
            caption: `${GALLERY_CAPTION_PREFIX} ${path.basename(new URL(src).pathname)}`,
            sortOrder,
          })
          sortOrder += 1
        } catch (err) {
          console.warn(`Gallery skip ${src}:`, err)
        }
      }
      console.log(`Gallery: inserted ${sortOrder} image(s).`)
    }
  }

  const locationSummary = 'Darlington, MD — private campground'
  let eventsAdded = 0
  for (const credit of HOSTING_CREDITS) {
    const title = `Primal Arts Festival ${credit.year}`
    const [existing] = await db
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(and(eq(schema.events.organizationId, orgId), eq(schema.events.title, title)))
      .limit(1)
    if (existing) {
      console.log(`Event "${title}" already exists — skipped.`)
      continue
    }
    await db.insert(schema.events).values({
      hostId: operatorId,
      organizationId: orgId,
      title,
      description: `Primal Arts Fest ${credit.year} — hosted in Darlington, Maryland. Details at ${PUBLIC_SITE}`,
      location: locationSummary,
      publicLocationSummary: locationSummary,
      startsAt: parseFestivalDayStart(credit.start),
      endsAt: parseFestivalDayEnd(credit.end),
      visibility: 'public',
      category: 'Outdoor Event',
      eventFormat: 'in-person',
      locationVisibility: 'public',
      ticketPurchaseUrl: PUBLIC_SITE,
      ticketingProvider: 'external',
      tags: [HOSTING_TAG, `paf${String(credit.year).slice(-2)}`],
    })
    eventsAdded += 1
    console.log(`Created hosting credit event: ${title}`)
  }
  console.log(`Hosting credits: ${eventsAdded} new, ${HOSTING_CREDITS.length - eventsAdded} existing.`)

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
  console.log(`Public org hub: /orgs/${ORG_SLUG}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
