import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, asc, count, eq, ilike, inArray, or } from 'drizzle-orm'
import { getViewerUserId } from '../../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../../auth/resolve-viewer.js'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import type { ConventionPublicSettings } from '../../db/schema.js'
import { requireConventionCommand } from '../../lib/convention-command-access.js'
import type { CommandRequirement } from '@c2k/shared'
import { getEmailFromUserRow, userEmailSelect } from '../../lib/user-email.js'

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ConvRow = typeof schema.conventions.$inferSelect
export type RouteHandler = Parameters<FastifyInstance['route']>[0]['handler']
export type RouteRegistrar = (method: string, path: string, handler: RouteHandler) => void

export function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

export function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

export function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
  const v = resolveViewerFromRequest(req)
  if (!v.authenticated || !v.payload?.sub) {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
  const userId = getViewerUserId(v.payload)
  if (!userId) {
    reply.status(401).send({ error: 'Invalid session' })
    return null
  }
  return { userId }
}

export function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null
  const dt = d instanceof Date ? d : new Date(d)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

function organizerRoleFromOrg(role: string | null): 'owner' | 'admin' | 'moderator' | 'staff' | 'viewer' {
  if (!role) return 'viewer'
  if (role === 'OWNER') return 'owner'
  if (role === 'ADMIN') return 'admin'
  if (role === 'MODERATOR') return 'moderator'
  if (role === 'STAFF') return 'staff'
  return 'viewer'
}

export async function requireOrganizer(
  key: string,
  userId: string,
  reply: FastifyReply,
  requirement: CommandRequirement,
): Promise<
  | {
      conv: ConvRow
      permissions: import('@c2k/shared').ConventionCommandPermissions
      orgRole: string | null
      organizerRole: ReturnType<typeof organizerRoleFromOrg>
    }
  | null
> {
  const access = await requireConventionCommand(key, userId, reply, requirement)
  if (!access) return null
  return {
    conv: access.conv,
    permissions: access.permissions,
    orgRole: access.orgRole,
    organizerRole: organizerRoleFromOrg(access.orgRole),
  }
}

export function conventionSettings(conv: ConvRow): ConventionPublicSettings {
  return (conv.settings ?? {}) as ConventionPublicSettings
}

export function mapRegistrant(
  row: typeof schema.conventionRegistrants.$inferSelect,
  categoryName?: string | null,
  profileDisplayName?: string | null,
) {
  const sceneDisplayName = profileDisplayName?.trim() || row.displayName
  return {
    id: row.id,
    categoryId: row.categoryId ?? '',
    categoryName: categoryName ?? null,
    personId: row.userId,
    status: row.checkedInAt ? 'checked_in' : 'registered',
    sceneDisplayName,
    email: row.email,
    legalName: row.badgeName,
    internalNotes: row.notes,
    vettingStatus: 'approved',
    vettingSafetyNotes: null,
    pronouns: row.pronouns,
    externalSource: null,
    externalId: row.externalId,
    lastSyncedAt: null,
    createdAt: iso(row.createdAt),
    checkInValidFrom: null,
    checkInValidThrough: null,
    checkInEligibility: 'ok',
    checkInTiming: row.checkedInTiming ?? null,
    checkedInAt: iso(row.checkedInAt),
  }
}

export function mapPersonRow(
  row: typeof schema.conventionPersons.$inferSelect,
  extras?: {
    pronouns?: string | null
    photoUrl?: string | null
    participation?: { registrantId: string | null; registered: boolean }
  },
) {
  return {
    id: row.id,
    sceneName: row.displayName,
    displayName: row.displayName,
    legalName: row.legalName ?? null,
    pronouns: extras?.pronouns ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    publicBio: row.bio ?? null,
    bio: row.bio ?? null,
    internalNotes: row.internalNotes ?? null,
    photoUrl: extras?.photoUrl ?? row.photoUrl ?? null,
    showLegalNameOnPublic: row.showLegalNameOnPublic ?? false,
    sortOrder: row.sortOrder,
    userId: row.userId,
    participation: extras?.participation ?? {
      registrantId: null,
      registered: false,
    },
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export function hashSecret(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function newToken(): string {
  return randomBytes(32).toString('hex')
}

export function escapeCsvCell(value: unknown): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function loadLocations(conventionId: string) {
  const rows = await db
    .select()
    .from(schema.conventionLocations)
    .where(eq(schema.conventionLocations.conventionId, conventionId))
    .orderBy(asc(schema.conventionLocations.sortOrder), asc(schema.conventionLocations.name))
  return rows
}

export function createRegistrar(app: FastifyInstance, registered: string[]): RouteRegistrar {
  return (method, path, handler) => {
    app.route({ method: method as 'GET', url: path, handler })
    registered.push(`${method} ${path}`)
  }
}

export async function searchOrgUsers(orgId: string, q?: string) {
  if (q && q.length >= 2) {
    const pattern = `%${q.replace(/[%_\\]/g, '\\$&')}%`
    return db
      .select({
        userId: schema.users.id,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        ...userEmailSelect,
      })
      .from(schema.organizationMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.organizationMembers.userId))
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          or(ilike(schema.users.username, pattern), ilike(schema.profiles.displayName, pattern)),
        ),
      )
      .orderBy(asc(schema.users.username))
      .limit(25)
      .then((rows) =>
        rows.map((r) => ({
          userId: r.userId,
          username: r.username,
          displayName: r.displayName,
          email: getEmailFromUserRow(r),
        })),
      )
  }
  return db
    .select({
      userId: schema.organizationMembers.userId,
      username: schema.users.username,
      displayName: schema.profiles.displayName,
      ...userEmailSelect,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.organizationMembers.userId))
    .where(eq(schema.organizationMembers.organizationId, orgId))
    .orderBy(asc(schema.users.username))
    .then((rows) =>
      rows.map((r) => ({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        email: getEmailFromUserRow(r),
      })),
    )
}

export async function slotPersonIds(slotId: string) {
  return db
    .select()
    .from(schema.scheduleSlotPersons)
    .where(eq(schema.scheduleSlotPersons.slotId, slotId))
    .orderBy(asc(schema.scheduleSlotPersons.sortOrder))
}

export async function ensureCheckInToken(registrantId: string): Promise<string> {
  const [row] = await db
    .select({ token: schema.conventionRegistrants.checkInToken })
    .from(schema.conventionRegistrants)
    .where(eq(schema.conventionRegistrants.id, registrantId))
    .limit(1)
  if (row?.token) return row.token
  const token = randomBytes(16).toString('hex')
  await db
    .update(schema.conventionRegistrants)
    .set({ checkInToken: token, updatedAt: new Date() })
    .where(eq(schema.conventionRegistrants.id, registrantId))
  return token
}

export async function registrantWithMeta(conventionId: string, registrantId: string) {
  const [row] = await db
    .select({
      reg: schema.conventionRegistrants,
      categoryName: schema.conventionRegistrationCategories.name,
      profileDisplayName: schema.profiles.displayName,
    })
    .from(schema.conventionRegistrants)
    .leftJoin(
      schema.conventionRegistrationCategories,
      eq(schema.conventionRegistrationCategories.id, schema.conventionRegistrants.categoryId),
    )
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.conventionRegistrants.userId))
    .where(
      and(
        eq(schema.conventionRegistrants.conventionId, conventionId),
        eq(schema.conventionRegistrants.id, registrantId),
      ),
    )
    .limit(1)
  return row
}

export async function countRegistrants(conventionId: string) {
  const [totalRow] = await db
    .select({ n: count() })
    .from(schema.conventionRegistrants)
    .where(eq(schema.conventionRegistrants.conventionId, conventionId))
  return Number(totalRow?.n ?? 0)
}

export async function loadSlotOr404(conventionId: string, slotId: string) {
  const [slot] = await db
    .select()
    .from(schema.scheduleSlots)
    .where(and(eq(schema.scheduleSlots.conventionId, conventionId), eq(schema.scheduleSlots.id, slotId)))
    .limit(1)
  return slot ?? null
}

export async function loadPersonIdsForConvention(conventionId: string, personIds: string[]) {
  if (!personIds.length) return []
  return db
    .select()
    .from(schema.conventionPersons)
    .where(
      and(
        eq(schema.conventionPersons.conventionId, conventionId),
        inArray(schema.conventionPersons.id, personIds),
      ),
    )
}
