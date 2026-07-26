import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getViewerUserId } from '../auth/viewer-user-id.js'
import { resolveViewerFromRequest } from '../auth/resolve-viewer.js'
import { db, schema } from '../db/index.js'
import { loadOrganizerPeopleForConvention, loadOrganizerPeopleForOrg } from '../lib/organizer-people.js'

const ORG_ROLE_RANK: Record<string, number> = {
  MEMBER: 1,
  STAFF: 2,
  MODERATOR: 3,
  ADMIN: 4,
  OWNER: 5,
}

const GROUP_ORGANIZER_ROLES = new Set(['owner', 'admin', 'moderator', 'event_host'])

function useDatabase(): boolean {
  return process.env.USE_DATABASE === 'true'
}

function requireDb(reply: FastifyReply): boolean {
  if (!useDatabase()) {
    reply.status(503).send({ error: 'Set USE_DATABASE=true for this endpoint' })
    return false
  }
  return true
}

function requireUser(req: FastifyRequest, reply: FastifyReply): { userId: string } | null {
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

export async function registerOrganizerRoutes(app: FastifyInstance) {
  /** Orgs and groups where the viewer has organizer-level access (moderator+). */
  app.get('/api/v1/organizer/scopes', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return

    const orgRows = await db
      .select({
        id: schema.organizations.id,
        slug: schema.organizations.slug,
        displayName: schema.organizations.displayName,
        role: schema.organizationMembers.role,
      })
      .from(schema.organizationMembers)
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.organizationMembers.organizationId))
      .where(eq(schema.organizationMembers.userId, user.userId))

    const orgs = orgRows
      .filter((r) => (ORG_ROLE_RANK[r.role] ?? 0) >= ORG_ROLE_RANK.MODERATOR)
      .map((r) => ({ id: r.id, slug: r.slug, displayName: r.displayName, role: r.role }))

    const groupRows = await db
      .select({
        id: schema.groups.id,
        slug: schema.groups.slug,
        name: schema.groups.name,
        role: schema.groupMembers.role,
        organizationId: schema.groups.organizationId,
      })
      .from(schema.groupMembers)
      .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
      .where(
        and(
          eq(schema.groupMembers.userId, user.userId),
          isNull(schema.groups.disbandedAt),
        ),
      )

    const orgIds = [...new Set(groupRows.map((g) => g.organizationId).filter(Boolean) as string[])]
    const parentOrgMap = new Map<string, string>()
    if (orgIds.length > 0) {
      const parents = await db
        .select({ id: schema.organizations.id, slug: schema.organizations.slug })
        .from(schema.organizations)
        .where(inArray(schema.organizations.id, orgIds))
      for (const p of parents) parentOrgMap.set(p.id, p.slug)
    }

    const groups = groupRows
      .filter((r) => GROUP_ORGANIZER_ROLES.has(r.role.toLowerCase()))
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        role: r.role,
        organizationId: r.organizationId,
        parentOrganizationSlug: r.organizationId ? (parentOrgMap.get(r.organizationId) ?? null) : null,
      }))

    return reply.send({ orgs, groups })
  })

  app.get('/api/v1/organizer/people/organizations/:slug', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }

    const [org] = await db
      .select({
        id: schema.organizations.id,
        slug: schema.organizations.slug,
        displayName: schema.organizations.displayName,
        role: schema.organizationMembers.role,
      })
      .from(schema.organizations)
      .innerJoin(
        schema.organizationMembers,
        eq(schema.organizationMembers.organizationId, schema.organizations.id),
      )
      .where(and(eq(schema.organizations.slug, slug), eq(schema.organizationMembers.userId, user.userId)))
      .limit(1)

    if (!org) return reply.status(404).send({ error: 'Organization not found' })
    if ((ORG_ROLE_RANK[org.role] ?? 0) < ORG_ROLE_RANK.MODERATOR) {
      return reply.status(403).send({ error: 'Moderator access required' })
    }

    const people = await loadOrganizerPeopleForOrg(org.id)
    return reply.send({
      scope: { type: 'organization', slug: org.slug, name: org.displayName },
      people,
    })
  })

  app.get('/api/v1/organizer/people/conventions/:slug', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }

    const [conv] = await db
      .select({
        id: schema.conventions.id,
        slug: schema.conventions.slug,
        name: schema.conventions.name,
        organizationId: schema.conventions.organizationId,
      })
      .from(schema.conventions)
      .where(eq(schema.conventions.slug, slug))
      .limit(1)

    if (!conv?.organizationId) return reply.status(404).send({ error: 'Convention not found' })

    const [mem] = await db
      .select({ role: schema.organizationMembers.role })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, conv.organizationId),
          eq(schema.organizationMembers.userId, user.userId),
        ),
      )
      .limit(1)

    if (!mem || (ORG_ROLE_RANK[mem.role] ?? 0) < ORG_ROLE_RANK.MODERATOR) {
      return reply.status(403).send({ error: 'Moderator access required' })
    }

    const people = await loadOrganizerPeopleForConvention(conv.id)
    return reply.send({
      scope: { type: 'convention', slug: conv.slug, name: conv.name },
      people,
    })
  })

  app.get('/api/v1/organizer/people/groups/:groupId', async (req, reply) => {
    if (!requireDb(reply)) return
    const user = requireUser(req, reply)
    if (!user) return
    const { groupId } = req.params as { groupId: string }

    const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1)
    if (!g || g.disbandedAt) return reply.status(404).send({ error: 'Group not found' })

    const [mem] = await db
      .select({ role: schema.groupMembers.role })
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, user.userId)))
      .limit(1)
    if (!mem || !GROUP_ORGANIZER_ROLES.has(mem.role.toLowerCase())) {
      return reply.status(403).send({ error: 'Moderator access required' })
    }

    const members = await db
      .select({
        userId: schema.groupMembers.userId,
        username: schema.users.username,
        displayName: schema.profiles.displayName,
        role: schema.groupMembers.role,
      })
      .from(schema.groupMembers)
      .innerJoin(schema.users, eq(schema.groupMembers.userId, schema.users.id))
      .leftJoin(schema.profiles, eq(schema.groupMembers.userId, schema.profiles.userId))
      .where(eq(schema.groupMembers.groupId, groupId))

    return reply.send({
      scope: { type: 'group', id: g.id, slug: g.slug, name: g.name },
      people: members.map((m) => ({
        userId: m.userId,
        username: m.username,
        displayName: m.displayName,
        orgRole: m.role,
        volunteerTags: [],
        listedInOrgDirectory: false,
        presenterHeadline: null,
        directoryVisibility: null,
        slotCount: 0,
        staffDutyCount: 0,
        eckePublishable: false,
      })),
    })
  })
}
