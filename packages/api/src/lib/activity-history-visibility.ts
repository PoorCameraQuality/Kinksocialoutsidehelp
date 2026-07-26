import { normalizePrivacySettings } from '@c2k/shared'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { isPlatformModeratorUser } from './platform-staff.js'

export async function viewerCanSeeActivityHistory(
  targetUserId: string,
  viewerUserId: string | null
): Promise<boolean> {
  if (
    viewerUserId &&
    (viewerUserId === targetUserId || (await isPlatformModeratorUser(viewerUserId)))
  ) {
    return true
  }
  const [row] = await db
    .select({ privacySettings: schema.userSettings.privacySettings })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, targetUserId))
    .limit(1)
  const privacy = normalizePrivacySettings(row?.privacySettings)
  if (privacy.activityHistoryVisibility === 'public') return true
  if (privacy.activityHistoryVisibility === 'members') return viewerUserId !== null
  return false
}
