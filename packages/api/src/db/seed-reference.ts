/**
 * Production-safe reference data (no demo users/orgs/events).
 * Run: USE_DATABASE=true npm run db:seed:reference -w @c2k/api
 */
import { asc, sql } from 'drizzle-orm'
import { KINK_TAG_CATALOG } from '@c2k/shared'
import { db, schema } from './index.js'

export async function seedKinkTagsOnly(): Promise<void> {
  if (KINK_TAG_CATALOG.length === 0) return

  await db
    .insert(schema.kinkTags)
    .values(
      KINK_TAG_CATALOG.map((t) => ({
        slug: t.slug,
        displayName: t.displayName,
        sortOrder: t.sortOrder,
        active: true,
      })),
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
}
