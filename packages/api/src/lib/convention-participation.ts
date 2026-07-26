import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { findUserByEmailLookup, getEmailFromUserRow } from './user-email.js'

export type UserParticipationDefaults = {
  displayName: string
  email: string
  pronouns: string | null
}

export type ConventionAccessRole = 'ATTENDEE' | 'STAFF' | 'MODERATOR'

const ACCESS_ROLE_RANK: Record<ConventionAccessRole, number> = {
  ATTENDEE: 0,
  STAFF: 1,
  MODERATOR: 2,
}

/** Pick the higher-ranked access role when syncing registration. */
export function pickAccessRoleOnRegistration(
  existingRole: ConventionAccessRole,
  requestedRole?: ConventionAccessRole,
): ConventionAccessRole {
  const existingRank = ACCESS_ROLE_RANK[existingRole] ?? 0
  const requestedRank = requestedRole ? ACCESS_ROLE_RANK[requestedRole] ?? 0 : 0
  if (existingRank >= requestedRank) return existingRole
  return requestedRole ?? existingRole
}

export function displayNameFromProfile(displayName: string | null | undefined, username: string): string {
  const fromProfile = displayName?.trim()
  if (fromProfile) return fromProfile
  return username.trim()
}

export async function resolveUserParticipationDefaults(userId: string): Promise<UserParticipationDefaults | null> {
  const [row] = await db
    .select({
      username: schema.users.username,
      email: schema.users.email,
      emailCiphertext: schema.users.emailCiphertext,
      emailKeyVersion: schema.users.emailKeyVersion,
      displayName: schema.profiles.displayName,
      pronouns: schema.profiles.pronouns,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!row) return null
  const email = getEmailFromUserRow(row)
  if (!email) return null
  return {
    displayName: displayNameFromProfile(row.displayName, row.username),
    email,
    pronouns: row.pronouns ?? null,
  }
}

export async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const user = await findUserByEmailLookup(email)
  return user?.id ?? null
}

export async function syncAccessGrantOnRegistration(params: {
  conventionId: string
  userId: string
  grantedByUserId: string
  role?: ConventionAccessRole
}) {
  const { conventionId, userId, grantedByUserId, role } = params
  const [existing] = await db
    .select()
    .from(schema.conventionAccessGrants)
    .where(
      and(
        eq(schema.conventionAccessGrants.conventionId, conventionId),
        eq(schema.conventionAccessGrants.userId, userId),
      ),
    )
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(schema.conventionAccessGrants)
      .set({
        attendingConfirmed: true,
        role: pickAccessRoleOnRegistration(existing.role as ConventionAccessRole, role),
      })
      .where(eq(schema.conventionAccessGrants.id, existing.id))
      .returning()
    return updated!
  }

  const [created] = await db
    .insert(schema.conventionAccessGrants)
    .values({
      conventionId,
      userId,
      role: role ?? 'ATTENDEE',
      attendingConfirmed: true,
      grantedByUserId,
    })
    .returning()
  return created!
}

/** Returns false when categoryId is set but not owned by this convention. */
export async function registrationCategoryValidForConvention(
  conventionId: string,
  categoryId: string | null | undefined,
): Promise<boolean> {
  if (!categoryId) return true
  const [row] = await db
    .select({ id: schema.conventionRegistrationCategories.id })
    .from(schema.conventionRegistrationCategories)
    .where(
      and(
        eq(schema.conventionRegistrationCategories.id, categoryId),
        eq(schema.conventionRegistrationCategories.conventionId, conventionId),
      ),
    )
    .limit(1)
  return Boolean(row)
}

export async function upsertConventionRegistrant(params: {
  conventionId: string
  userId: string
  categoryId?: string | null
  badgeName?: string | null
  pronouns?: string | null
  notes?: string | null
  externalId?: string | null
}) {
  const defaults = await resolveUserParticipationDefaults(params.userId)
  if (!defaults) throw new Error('User not found')

  const [existing] = await db
    .select()
    .from(schema.conventionRegistrants)
    .where(
      and(
        eq(schema.conventionRegistrants.conventionId, params.conventionId),
        eq(schema.conventionRegistrants.userId, params.userId),
      ),
    )
    .limit(1)

  if (existing) {
    const patch: Partial<typeof schema.conventionRegistrants.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (params.categoryId !== undefined) patch.categoryId = params.categoryId ?? undefined
    if (params.badgeName !== undefined) patch.badgeName = params.badgeName ?? undefined
    if (params.pronouns !== undefined) patch.pronouns = params.pronouns ?? undefined
    if (params.notes !== undefined) patch.notes = params.notes ?? undefined
    if (params.externalId !== undefined) patch.externalId = params.externalId ?? undefined
    const [updated] = await db
      .update(schema.conventionRegistrants)
      .set(patch)
      .where(eq(schema.conventionRegistrants.id, existing.id))
      .returning()
    return { row: updated!, created: false }
  }

  const [created] = await db
    .insert(schema.conventionRegistrants)
    .values({
      conventionId: params.conventionId,
      userId: params.userId,
      displayName: defaults.displayName,
      email: defaults.email,
      pronouns: params.pronouns ?? defaults.pronouns ?? undefined,
      badgeName: params.badgeName ?? undefined,
      categoryId: params.categoryId ?? undefined,
      notes: params.notes ?? undefined,
      externalId: params.externalId ?? undefined,
    })
    .returning()
  return { row: created!, created: true }
}

export type MyConventionParticipation = {
  userId: string
  username: string
  profile: UserParticipationDefaults
  registrant: typeof schema.conventionRegistrants.$inferSelect | null
  access: typeof schema.conventionAccessGrants.$inferSelect | null
}

/** Identity Phase 5 - single read payload for the signed-in viewer at a convention. */
export async function loadMyConventionParticipation(
  conventionId: string,
  userId: string
): Promise<MyConventionParticipation | null> {
  const profile = await resolveUserParticipationDefaults(userId)
  if (!profile) return null
  const [user] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!user) return null

  const [registrant] = await db
    .select()
    .from(schema.conventionRegistrants)
    .where(
      and(
        eq(schema.conventionRegistrants.conventionId, conventionId),
        eq(schema.conventionRegistrants.userId, userId)
      )
    )
    .limit(1)

  const [access] = await db
    .select()
    .from(schema.conventionAccessGrants)
    .where(
      and(
        eq(schema.conventionAccessGrants.conventionId, conventionId),
        eq(schema.conventionAccessGrants.userId, userId)
      )
    )
    .limit(1)

  return {
    userId,
    username: user.username,
    profile,
    registrant: registrant ?? null,
    access: access ?? null,
  }
}
