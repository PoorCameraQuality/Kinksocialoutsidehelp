/** Dev-only: resolve a convention slug and dump related rows for load debugging. */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'
import { resolveConventionId } from '../src/routes/conventions-routes.js'

process.env.USE_DATABASE = 'true'

async function main() {
  const id = await resolveConventionId('preview-c2k-weekend')
  console.log('resolved id:', id)
  if (!id) {
    console.log('convention not found')
    return
  }
  const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
  console.log('conv:', conv?.slug, conv?.name)
  await db.select().from(schema.conventionPins).limit(1)
  console.log('convention_pins query ok')
  if (conv?.organizationId) {
    const [o] = await db
      .select({ slug: schema.organizations.slug, logoUrl: schema.organizations.logoUrl, bio: schema.organizations.bio })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, conv.organizationId))
      .limit(1)
    console.log('org:', o)
  }
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
