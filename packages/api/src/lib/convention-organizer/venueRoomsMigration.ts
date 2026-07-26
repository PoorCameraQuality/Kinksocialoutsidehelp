import { count, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import type { ConventionPublicSettings } from '../../db/schema.js'

/** Migrate legacy settings.venueRooms[] into convention_locations when empty. */
export async function migrateVenueRoomsToLocations(conventionId: string, settings: ConventionPublicSettings | null) {
  const [existing] = await db
    .select({ n: count() })
    .from(schema.conventionLocations)
    .where(eq(schema.conventionLocations.conventionId, conventionId))
  if (Number(existing?.n ?? 0) > 0) return

  const rooms = settings?.venueRooms ?? []
  if (!rooms.length) return

  await db.insert(schema.conventionLocations).values(
    rooms.map((name, i) => ({
      conventionId,
      name: name.trim(),
      sortOrder: i,
    })),
  )
}
