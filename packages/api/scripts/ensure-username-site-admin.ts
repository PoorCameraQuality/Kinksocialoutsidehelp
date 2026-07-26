/**
 * Idempotent: grant platform_staff SITE_ADMIN to an existing user by username.
 * Does not change password or profile.
 * Usage: TARGET_USERNAME=tarkiz npx tsx packages/api/scripts/ensure-username-site-admin.ts
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'
import { invalidatePlatformStaffCache } from '../src/lib/platform-staff.js'

const USERNAME = process.env.TARGET_USERNAME?.trim()
if (!USERNAME) {
  console.error('Set TARGET_USERNAME')
  process.exit(1)
}

const [user] = await db
  .select({ id: schema.users.id, username: schema.users.username, email: schema.users.email })
  .from(schema.users)
  .where(eq(schema.users.username, USERNAME))
  .limit(1)

if (!user) {
  console.error(`User not found: ${USERNAME}`)
  process.exit(1)
}

await db
  .insert(schema.platformStaff)
  .values({ userId: user.id, role: 'SITE_ADMIN' })
  .onConflictDoUpdate({
    target: schema.platformStaff.userId,
    set: { role: 'SITE_ADMIN' },
  })

invalidatePlatformStaffCache()
console.log(`SITE_ADMIN ensured: username=${user.username} userId=${user.id} email=${user.email}`)
console.log('Trust & Safety and moderation dashboard should appear after re-login (staff cache ~30s).')
