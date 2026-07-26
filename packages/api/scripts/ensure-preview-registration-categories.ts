/**
 * Idempotent: ensure preview-c2k-weekend has registration categories (PILOT-3).
 * Run when parity smoke fails with "no categories on convention":
 *   npx tsx packages/api/scripts/ensure-preview-registration-categories.ts
 */
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { asc, eq } from 'drizzle-orm'

const __dirname = dirname(fileURLToPath(import.meta.url))
const devEnv = resolve(__dirname, '../../../../.env.development')
if (existsSync(devEnv)) loadEnv({ path: devEnv })

const SLUG = process.env.SMOKE_CONV ?? 'preview-c2k-weekend'

async function main() {
  const { db, schema } = await import('../src/db/index.js')

  const [conv] = await db
    .select({ id: schema.conventions.id })
    .from(schema.conventions)
    .where(eq(schema.conventions.slug, SLUG))
    .limit(1)
  if (!conv) {
    console.error(`Convention not found: ${SLUG}. Run npm run db:seed -w @c2k/api first.`)
    process.exit(1)
  }

  const existing = await db
    .select()
    .from(schema.conventionRegistrationCategories)
    .where(eq(schema.conventionRegistrationCategories.conventionId, conv.id))
    .orderBy(asc(schema.conventionRegistrationCategories.sortOrder))

  const specs = [
    {
      name: 'Weekend pass',
      description: 'General admission',
      sortOrder: 0,
      expectedHours: 0,
      priceCents: 12500,
      roleKind: 'attendee' as const,
      grantsStaffAccess: false,
    },
    {
      name: 'Presenter comp',
      description: 'Faculty comp',
      sortOrder: 1,
      expectedHours: 0,
      priceCents: 0,
      compCode: 'FACULTY',
      accessCode: 'FACULTY',
      roleKind: 'presenter' as const,
      grantsStaffAccess: true,
    },
  ]

  let created = 0
  let updated = 0
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
          isPublic: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.conventionRegistrationCategories.id, hit.id))
      updated++
      continue
    }
    await db.insert(schema.conventionRegistrationCategories).values({
      conventionId: conv.id,
      isPublic: true,
      ...spec,
    })
    created++
  }

  const after = await db
    .select({ id: schema.conventionRegistrationCategories.id, name: schema.conventionRegistrationCategories.name })
    .from(schema.conventionRegistrationCategories)
    .where(eq(schema.conventionRegistrationCategories.conventionId, conv.id))

  console.log(`Convention ${SLUG}: ${after.length} categories (${created} inserted, ${updated} updated)`)
  for (const c of after) console.log(`  - ${c.name} (${c.id})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
