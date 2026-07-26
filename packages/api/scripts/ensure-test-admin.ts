/**
 * Idempotent: ensure TestAdmin site admin account for QA / moderation testing.
 * Usage: TEST_ADMIN_PASSWORD=Testing!2 npx tsx packages/api/scripts/ensure-test-admin.ts
 */
import {
  defaultFeedSettings,
  defaultNotificationSettings,
  defaultPrivacySettings,
  ONBOARDING_STEP_COUNT,
} from '@c2k/shared'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, schema } from '../src/db/index.js'
import { invalidatePlatformStaffCache } from '../src/lib/platform-staff.js'

const USERNAME = process.env.TEST_ADMIN_USERNAME ?? 'TestAdmin'
const EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'testadmin@kink.social'
const PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'Testing!2'

const auditReadyFeedSettings = {
  ...defaultFeedSettings,
  onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
  onboardingStep: ONBOARDING_STEP_COUNT,
}

async function ensureUserSettings(userId: string) {
  const [existing] = await db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1)
  if (existing) {
    const feed = existing.feedSettings as Record<string, unknown>
    if (typeof feed.onboardingCompletedAt !== 'string' || !feed.onboardingCompletedAt) {
      await db
        .update(schema.userSettings)
        .set({ feedSettings: auditReadyFeedSettings })
        .where(eq(schema.userSettings.userId, userId))
    }
    return
  }
  await db.insert(schema.userSettings).values({
    userId,
    privacySettings: defaultPrivacySettings,
    notificationSettings: defaultNotificationSettings,
    feedSettings: auditReadyFeedSettings,
  })
}

async function ensureTestSiteAdmin(): Promise<{ id: string; email: string; username: string }> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, USERNAME))
    .limit(1)

  let userId: string
  if (existing) {
    userId = existing.id
    await db
      .update(schema.users)
      .set({ email: EMAIL, passwordHash })
      .where(eq(schema.users.id, userId))
  } else {
    const [user] = await db
      .insert(schema.users)
      .values({
        username: USERNAME,
        email: EMAIL,
        passwordHash,
      })
      .returning()
    if (!user) throw new Error(`insert ${USERNAME}`)
    userId = user.id

    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1)
    if (!profile) {
      await db.insert(schema.profiles).values({
        userId,
        displayName: 'Test Admin',
        bio: 'Platform test account for moderation and admin QA.',
        visibility: 'PUBLIC',
        verified: true,
        trustScore: 90,
      })
    }
  }

  await ensureUserSettings(userId)

  await db
    .insert(schema.platformStaff)
    .values({ userId, role: 'SITE_ADMIN' })
    .onConflictDoUpdate({
      target: schema.platformStaff.userId,
      set: { role: 'SITE_ADMIN' },
    })

  invalidatePlatformStaffCache()
  return { id: userId, email: EMAIL, username: USERNAME }
}

const admin = await ensureTestSiteAdmin()
console.log(`Test site admin ensured: username=${admin.username} userId=${admin.id} email=${admin.email}`)
console.log(`Password: ${PASSWORD}`)
console.log('Log in at /login — Trust & Safety and moderation dashboard should be available.')
