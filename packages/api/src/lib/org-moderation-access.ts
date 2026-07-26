import { and, eq, gt, isNull, or } from 'drizzle-orm'
import type { FastifyReply } from 'fastify'
import { db, schema } from '../db/index.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const ORG_ROLE_RANK: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  STAFF: 2,
  MEMBER: 1,
}

export async function resolveOrganizationId(orgKey: string): Promise<string | null> {
  if (UUID_RE.test(orgKey)) return orgKey
  const [row] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, orgKey))
    .limit(1)
  return row?.id ?? null
}

export async function requireOrgMinRole(
  organizationId: string,
  userId: string,
  min: keyof typeof ORG_ROLE_RANK,
  reply: FastifyReply
): Promise<boolean> {
  const [m] = await db
    .select({ role: schema.organizationMembers.role })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId)
      )
    )
    .limit(1)
  if (!m) {
    reply.status(403).send({ error: 'Not a member' })
    return false
  }
  if (ORG_ROLE_RANK[m.role] < ORG_ROLE_RANK[min]) {
    reply.status(403).send({ error: 'Insufficient role' })
    return false
  }
  return true
}

export async function isUserScopeBanned(
  scopeType: 'organization' | 'group',
  scopeId: string,
  userId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.scopeBans.id })
    .from(schema.scopeBans)
    .where(
      and(
        eq(schema.scopeBans.scopeType, scopeType),
        eq(schema.scopeBans.scopeId, scopeId),
        eq(schema.scopeBans.userId, userId),
        eq(schema.scopeBans.active, true),
        or(isNull(schema.scopeBans.expiresAt), gt(schema.scopeBans.expiresAt, new Date()))
      )
    )
    .limit(1)
  return Boolean(row)
}
