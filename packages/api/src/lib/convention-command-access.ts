import {
  type CommandRequirement,
  type ConventionCommandPermissions,
  commandPermissionIncludes,
  emptyCommandPermissions,
  fullCommandPermissions,
  hasAnyCommandPermission,
} from '@c2k/shared'
import { and, eq } from 'drizzle-orm'
import type { FastifyReply } from 'fastify'
import { db } from '../db/index.js'
import * as schema from '../db/schema.js'
import { resolveConventionId } from '../routes/conventions-routes.js'

type ConvRow = typeof schema.conventions.$inferSelect
type OrgRole = typeof schema.organizationMembers.$inferSelect['role']

const FULL_ADMIN_ROLES = new Set<OrgRole>(['OWNER', 'ADMIN'])

export type ConventionCommandAccess = {
  conv: ConvRow
  permissions: ConventionCommandPermissions
  hasAnyAccess: boolean
  orgRole: OrgRole | null
}

async function orgMembershipRole(organizationId: string, userId: string): Promise<OrgRole | null> {
  const [m] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    )
    .limit(1)
  return m?.role ?? null
}

export async function resolveConventionCommandAccess(
  conv: ConvRow,
  userId: string,
): Promise<ConventionCommandAccess> {
  if (!conv.organizationId) {
    return {
      conv,
      permissions: emptyCommandPermissions(),
      hasAnyAccess: false,
      orgRole: null,
    }
  }

  const orgRole = await orgMembershipRole(conv.organizationId, userId)
  if (orgRole && FULL_ADMIN_ROLES.has(orgRole)) {
    return {
      conv,
      permissions: fullCommandPermissions(),
      hasAnyAccess: true,
      orgRole,
    }
  }

  const [grant] = await db
    .select({
      canRegistration: schema.conventionCommandGrants.canRegistration,
      canStaffOps: schema.conventionCommandGrants.canStaffOps,
      canScheduler: schema.conventionCommandGrants.canScheduler,
    })
    .from(schema.conventionCommandGrants)
    .where(
      and(
        eq(schema.conventionCommandGrants.conventionId, conv.id),
        eq(schema.conventionCommandGrants.userId, userId),
      ),
    )
    .limit(1)

  const permissions: ConventionCommandPermissions = {
    registration: grant?.canRegistration ?? false,
    staffOps: grant?.canStaffOps ?? false,
    scheduler: grant?.canScheduler ?? false,
    isFullAdmin: false,
    canManageTeam: false,
  }

  return {
    conv,
    permissions,
    hasAnyAccess: hasAnyCommandPermission(permissions),
    orgRole,
  }
}

export async function requireConventionCommand(
  key: string,
  userId: string,
  reply: FastifyReply,
  requirement: CommandRequirement,
): Promise<ConventionCommandAccess | null> {
  const id = await resolveConventionId(key)
  if (!id) {
    reply.status(404).send({ error: 'Not found' })
    return null
  }
  const [conv] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, id)).limit(1)
  if (!conv) {
    reply.status(404).send({ error: 'Not found' })
    return null
  }
  if (!conv.organizationId) {
    reply.status(400).send({ error: 'Convention must be org-owned' })
    return null
  }

  const access = await resolveConventionCommandAccess(conv, userId)
  if (!access.hasAnyAccess) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }
  if (!commandPermissionIncludes(requirement, access.permissions)) {
    reply.status(403).send({ error: 'Forbidden' })
    return null
  }

  return access
}

/** For routes outside convention-organizer-routes (check-ins, staff duties). */
export async function userHasConventionCommandPermission(
  conv: ConvRow,
  userId: string,
  requirement: CommandRequirement,
): Promise<boolean> {
  const access = await resolveConventionCommandAccess(conv, userId)
  if (!access.hasAnyAccess) return false
  return commandPermissionIncludes(requirement, access.permissions)
}

/** Hub organizer reads/writes: OWNER/ADMIN or matching command grant (not org MODERATOR alone). */
export async function userHasHubConventionRead(
  conv: ConvRow,
  userId: string,
  requirement: CommandRequirement,
): Promise<boolean> {
  const access = await resolveConventionCommandAccess(conv, userId)
  if (access.permissions.isFullAdmin) return true
  if (!access.hasAnyAccess) return false
  return commandPermissionIncludes(requirement, access.permissions)
}

export async function requireHubConventionRead(
  conv: ConvRow,
  userId: string,
  reply: FastifyReply,
  requirement: CommandRequirement,
): Promise<boolean> {
  if (await userHasHubConventionRead(conv, userId, requirement)) return true
  reply.status(403).send({ error: 'Forbidden' })
  return false
}

/** Hub convention mutations: org OWNER/ADMIN or matching command grant (not org MODERATOR alone). */
export async function requireHubConventionMutation(
  conv: ConvRow,
  userId: string,
  reply: FastifyReply,
  requirement: CommandRequirement,
): Promise<boolean> {
  const access = await resolveConventionCommandAccess(conv, userId)
  if (access.permissions.isFullAdmin) return true
  if (!access.hasAnyAccess || !commandPermissionIncludes(requirement, access.permissions)) {
    reply.status(403).send({ error: 'Forbidden' })
    return false
  }
  return true
}
