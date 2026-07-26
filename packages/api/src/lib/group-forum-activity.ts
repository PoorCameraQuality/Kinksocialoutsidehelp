/**
 * Group forum thread feed activities — emit gates and Following/Home viewer filtering.
 */
import { shouldEmitGroupForumThreadFeedActivity } from '@c2k/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadBlockedUserIds, loadUserIdsWhoBlockedUser } from './blocks.js'
import { canViewGroup } from './group-access.js'

export { shouldEmitGroupForumThreadFeedActivity }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Deep link to a group forum thread (Forums tab + thread query param). */
export function buildGroupForumThreadDeepLink(
  metadata: Record<string, unknown>,
  threadId?: string | null,
): string | null {
  const groupSlug = metadata.groupSlug
  const groupId = metadata.groupId
  const key =
    typeof groupSlug === 'string' && groupSlug.trim() ? groupSlug.trim()
    : typeof groupId === 'string' && groupId.trim() ? groupId.trim()
    : null
  if (!key) return null
  const base = `/groups/${encodeURIComponent(key)}?tab=Forums`
  const tid =
    threadId && UUID_RE.test(threadId) ? threadId
    : typeof metadata.threadId === 'string' && UUID_RE.test(metadata.threadId) ? metadata.threadId
    : null
  if (tid) return `${base}&thread=${encodeURIComponent(tid)}`
  return base
}

export type GroupForumActivityRow = {
  id: string
  actorId: string
  verb?: string
  objectId?: string
  metadata?: Record<string, unknown>
}

export function parseGroupForumActivityMeta(metadata: Record<string, unknown>): {
  groupId: string
  groupName?: string
  groupSlug?: string
  threadTitle?: string
  groupVisibility?: string
} | null {
  const groupId = typeof metadata.groupId === 'string' ? metadata.groupId : null
  if (!groupId) return null
  return {
    groupId,
    groupName: typeof metadata.groupName === 'string' ? metadata.groupName : undefined,
    groupSlug: typeof metadata.groupSlug === 'string' ? metadata.groupSlug : undefined,
    threadTitle: typeof metadata.threadTitle === 'string' ? metadata.threadTitle : undefined,
    groupVisibility: typeof metadata.groupVisibility === 'string' ? metadata.groupVisibility : undefined,
  }
}

export async function filterRowsForGroupForumActivity<T extends GroupForumActivityRow>(
  viewerId: string,
  rows: T[],
): Promise<T[]> {
  const forumRows = rows.filter((r) => r.verb === 'group_thread_created')
  if (forumRows.length === 0) return rows

  const [blockedByViewer, viewersBlockers] = await Promise.all([
    loadBlockedUserIds(viewerId),
    loadUserIdsWhoBlockedUser(viewerId),
  ])
  const blockedActorIds = new Set<string>([...blockedByViewer, ...viewersBlockers])

  const threadIds = [
    ...new Set(forumRows.map((r) => r.objectId).filter((id): id is string => Boolean(id))),
  ]
  const groupIds = [
    ...new Set(
      forumRows
        .map((r) => parseGroupForumActivityMeta(r.metadata ?? {})?.groupId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const [groups, threads, memberships] = await Promise.all([
    groupIds.length > 0 ?
      db.select().from(schema.groups).where(inArray(schema.groups.id, groupIds))
    : Promise.resolve([]),
    threadIds.length > 0 ?
      db.select().from(schema.forumThreads).where(inArray(schema.forumThreads.id, threadIds))
    : Promise.resolve([]),
    groupIds.length > 0 ?
      db
        .select({ groupId: schema.groupMembers.groupId })
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.userId, viewerId),
            inArray(schema.groupMembers.groupId, groupIds),
          ),
        )
    : Promise.resolve([]),
  ])

  const groupById = new Map(groups.map((g) => [g.id, g]))
  const threadById = new Map(threads.map((t) => [t.id, t]))
  const memberGroupIds = new Set(memberships.map((m) => m.groupId))

  const deny = new Set<string>()

  for (const row of forumRows) {
    if (row.actorId !== viewerId && blockedActorIds.has(row.actorId)) {
      deny.add(row.id)
      continue
    }
    const meta = parseGroupForumActivityMeta(row.metadata ?? {})
    if (!meta) {
      deny.add(row.id)
      continue
    }
    const group = groupById.get(meta.groupId)
    if (!group) {
      deny.add(row.id)
      continue
    }
    const thread = row.objectId ? threadById.get(row.objectId) : undefined
    if (!thread || thread.groupId !== meta.groupId) {
      deny.add(row.id)
      continue
    }

    const isMember = memberGroupIds.has(group.id) || group.ownerId === viewerId
    const canView = await canViewGroup(group, viewerId)
    if (!canView) {
      deny.add(row.id)
      continue
    }
    if (group.visibility !== 'public' && !isMember && group.ownerId !== viewerId) {
      deny.add(row.id)
    }
  }

  return rows.filter((r) => r.verb !== 'group_thread_created' || !deny.has(r.id))
}
