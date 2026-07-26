/**
 * Idempotent: demo floor plan map + Tent City attendee group on preview-c2k-weekend.
 *   npx tsx packages/api/scripts/ensure-preview-attendee-parity.ts
 */
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { and, eq } from 'drizzle-orm'

const __dirname = dirname(fileURLToPath(import.meta.url))
const devEnv = resolve(__dirname, '../../../../.env.development')
if (existsSync(devEnv)) loadEnv({ path: devEnv })

const SLUG = process.env.SMOKE_CONV ?? 'preview-c2k-weekend'
/** Served from web public/ — API publicUrlForPath may prefix CDN; path stored for local dev. */
const FLOOR_PLAN_PATH = 'public/demo-floor-plan.svg'

async function main() {
  const { db, schema } = await import('../src/db/index.js')

  const [conv] = await db
    .select({ id: schema.conventions.id })
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, SLUG))
    .limit(1)
  if (!conv) {
    console.error(`Convention not found: ${SLUG}`)
    process.exit(1)
  }

  const [rope] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, 'RopeDreamer'))
    .limit(1)

  const maps = await db
    .select()
    .from(schema.conventionMaps)
    .where(eq(schema.conventionMaps.conventionId, conv.id))

  const bad = maps.filter((m) => m.title.toLowerCase().includes('newlook'))
  for (const m of bad) {
    await db.delete(schema.conventionMaps).where(eq(schema.conventionMaps.id, m.id))
    console.log(`Removed map: ${m.title}`)
  }

  const [floor] = await db
    .select()
    .from(schema.conventionMaps)
    .where(
      and(eq(schema.conventionMaps.conventionId, conv.id), eq(schema.conventionMaps.title, 'Preview floor plan')),
    )
    .limit(1)

  if (!floor) {
    await db.insert(schema.conventionMaps).values({
      conventionId: conv.id,
      title: 'Preview floor plan',
      imagePath: FLOOR_PLAN_PATH,
      sortOrder: 0,
    })
    console.log('Inserted Preview floor plan map')
  }

  const [group] = await db
    .select()
    .from(schema.conventionAttendeeGroups)
    .where(
      and(eq(schema.conventionAttendeeGroups.conventionId, conv.id), eq(schema.conventionAttendeeGroups.name, 'Tent City')),
    )
    .limit(1)

  let groupId = group?.id
  if (!groupId) {
    const [inserted] = await db
      .insert(schema.conventionAttendeeGroups)
      .values({
        conventionId: conv.id,
        name: 'Tent City',
        description: 'Tent City Demo — chores and bring list for local QA.',
        visibility: 'public',
        status: 'open',
        capacity: 12,
      })
      .returning()
    groupId = inserted!.id
    console.log('Inserted Tent City attendee group')
  }

  if (rope && groupId) {
    await db
      .insert(schema.conventionAttendeeGroupMembers)
      .values({ groupId, userId: rope.id, role: 'owner' })
      .onConflictDoNothing()
  }

  const [policy] = await db
    .select()
    .from(schema.conventionPolicyDocuments)
    .where(
      and(
        eq(schema.conventionPolicyDocuments.conventionId, conv.id),
        eq(schema.conventionPolicyDocuments.title, 'Code of Conduct (Preview)'),
      ),
    )
    .limit(1)

  if (!policy) {
    await db.insert(schema.conventionPolicyDocuments).values({
      conventionId: conv.id,
      kind: 'coc',
      version: 1,
      title: 'Code of Conduct (Preview)',
      bodyMarkdown: '## Preview demo\n\nBe excellent to each other. This is test copy for policy sign-off.',
      publishedAt: new Date(),
      requiredForRegistration: false,
      sortOrder: 0,
    })
    console.log('Inserted published preview policy')
  }

  if (rope) {
    const [grant] = await db
      .select()
      .from(schema.conventionAccessGrants)
      .where(
        and(
          eq(schema.conventionAccessGrants.conventionId, conv.id),
          eq(schema.conventionAccessGrants.userId, rope.id),
        ),
      )
      .limit(1)
    if (grant) {
      await db
        .update(schema.conventionAccessGrants)
        .set({ role: 'ATTENDEE', paidConfirmed: true, attendingConfirmed: true })
        .where(eq(schema.conventionAccessGrants.id, grant.id))
    } else {
      await db.insert(schema.conventionAccessGrants).values({
        conventionId: conv.id,
        userId: rope.id,
        role: 'ATTENDEE',
        paidConfirmed: true,
        attendingConfirmed: true,
        staffPreAccess: false,
      })
    }
    console.log('Ensured RopeDreamer attendee access grant on preview convention')
  }

  const [convDates] = await db
    .select({ startsAt: schema.conventions.startsAt, endsAt: schema.conventions.endsAt })
    .from(schema.conventions)
    .where(eq(schema.conventions.id, conv.id))
    .limit(1)

  const [openShift] = await db
    .select()
    .from(schema.conventionVolunteerShifts)
    .where(
      and(
        eq(schema.conventionVolunteerShifts.conventionId, conv.id),
        eq(schema.conventionVolunteerShifts.shiftStatus, 'open'),
      ),
    )
    .limit(1)

  if (!openShift && convDates) {
    const t0 = convDates.startsAt.getTime()
    await db.insert(schema.conventionVolunteerShifts).values({
      conventionId: conv.id,
      title: 'Preview: Open shift — hospitality float',
      description: 'Unclaimed shift for dancecard volunteer-claim QA.',
      startsAt: new Date(t0 + 8 * 60 * 60 * 1000),
      endsAt: new Date(t0 + 11 * 60 * 60 * 1000),
      location: 'Main Lobby',
      capacityMax: 2,
      shiftStatus: 'open',
      sortOrder: 99,
    })
    console.log('Inserted open volunteer shift for preview QA')
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
