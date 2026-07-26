import { asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export const PRESENTER_PROFILE_FOCUS_VALUES = [
  'EDUCATOR',
  'PRESENTER',
  'SPEAKER',
  'PANELIST',
  'AUTHOR',
  'PHOTOGRAPHER',
  'MEDIA_CREATOR',
  'DEMO_PARTNER',
  'FACILITATOR',
] as const

export type PresenterProfileFocus = (typeof PRESENTER_PROFILE_FOCUS_VALUES)[number]

export type PresenterFocusFields = {
  profileFocuses: PresenterProfileFocus[]
  primaryProfileFocus: PresenterProfileFocus | null
}

export async function loadPresenterFocusFields(userId: string): Promise<PresenterFocusFields> {
  const rows = await db
    .select({
      focus: schema.presenterProfileFocuses.focus,
      isPrimary: schema.presenterProfileFocuses.isPrimary,
    })
    .from(schema.presenterProfileFocuses)
    .where(eq(schema.presenterProfileFocuses.userId, userId))
    .orderBy(asc(schema.presenterProfileFocuses.sortOrder), asc(schema.presenterProfileFocuses.focus))

  const profileFocuses = rows.map((r) => r.focus as PresenterProfileFocus)
  const primaryProfileFocus =
    (rows.find((r) => r.isPrimary)?.focus as PresenterProfileFocus | undefined) ??
    profileFocuses[0] ??
    null

  return { profileFocuses, primaryProfileFocus }
}

export async function loadPresenterFocusFieldsMap(
  userIds: string[]
): Promise<Map<string, PresenterFocusFields>> {
  const map = new Map<string, PresenterFocusFields>()
  if (userIds.length === 0) return map

  const allRows = await db
    .select({
      userId: schema.presenterProfileFocuses.userId,
      focus: schema.presenterProfileFocuses.focus,
      isPrimary: schema.presenterProfileFocuses.isPrimary,
      sortOrder: schema.presenterProfileFocuses.sortOrder,
    })
    .from(schema.presenterProfileFocuses)
    .where(inArray(schema.presenterProfileFocuses.userId, userIds))
    .orderBy(asc(schema.presenterProfileFocuses.sortOrder))

  const byUser = new Map<string, typeof allRows>()
  for (const row of allRows) {
    const list = byUser.get(row.userId) ?? []
    list.push(row)
    byUser.set(row.userId, list)
  }

  for (const userId of userIds) {
    const userRows = byUser.get(userId) ?? []
    const profileFocuses = userRows.map((r) => r.focus as PresenterProfileFocus)
    const primaryProfileFocus =
      (userRows.find((r) => r.isPrimary)?.focus as PresenterProfileFocus | undefined) ??
      profileFocuses[0] ??
      null
    map.set(userId, { profileFocuses, primaryProfileFocus })
  }

  return map
}

export async function savePresenterFocusFields(
  userId: string,
  profileFocuses: PresenterProfileFocus[],
  primaryProfileFocus: PresenterProfileFocus | null | undefined
): Promise<PresenterFocusFields> {
  const unique = [...new Set(profileFocuses)]
  if (unique.length === 0) {
    await db.delete(schema.presenterProfileFocuses).where(eq(schema.presenterProfileFocuses.userId, userId))
    return { profileFocuses: [], primaryProfileFocus: null }
  }

  const primary =
    primaryProfileFocus && unique.includes(primaryProfileFocus) ? primaryProfileFocus : unique[0]

  await db.delete(schema.presenterProfileFocuses).where(eq(schema.presenterProfileFocuses.userId, userId))

  await db.insert(schema.presenterProfileFocuses).values(
    unique.map((focus, index) => ({
      userId,
      focus,
      isPrimary: focus === primary,
      sortOrder: index,
      updatedAt: new Date(),
    }))
  )

  return { profileFocuses: unique, primaryProfileFocus: primary }
}
