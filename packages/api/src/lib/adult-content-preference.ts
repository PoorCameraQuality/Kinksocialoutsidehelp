import {
  adultContentPreferenceSchema,
  mergePrivacySettings,
  normalizePrivacySettings,
  type AdultContentPreference,
} from '@c2k/shared'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { ensureUserSettingsRow } from './user-settings-row.js'

/** Read adult content preference from a privacy_settings JSON blob. */
export function readAdultContentPreference(privacySettings: unknown): AdultContentPreference {
  return normalizePrivacySettings(privacySettings).adultContentPreference
}

/** Merge an adult content preference patch into privacy_settings JSON. */
export function privacySettingsWithAdultContentPreference(
  current: unknown,
  preference: AdultContentPreference,
): ReturnType<typeof mergePrivacySettings> {
  return mergePrivacySettings(current, { adultContentPreference: preference })
}

export async function getAdultContentPreference(userId: string): Promise<AdultContentPreference> {
  const row = await ensureUserSettingsRow(userId)
  return readAdultContentPreference(row.privacySettings)
}

export async function setAdultContentPreference(
  userId: string,
  preference: AdultContentPreference,
): Promise<AdultContentPreference> {
  const parsed = adultContentPreferenceSchema.safeParse(preference)
  if (!parsed.success) {
    throw new Error('Invalid adult content preference')
  }
  const row = await ensureUserSettingsRow(userId)
  const privacy = privacySettingsWithAdultContentPreference(row.privacySettings, parsed.data)
  const [updated] = await db
    .update(schema.userSettings)
    .set({
      privacySettings: privacy,
      updatedAt: new Date(),
    })
    .where(eq(schema.userSettings.userId, userId))
    .returning()
  if (!updated) throw new Error('update user_settings failed')
  return readAdultContentPreference(updated.privacySettings)
}
