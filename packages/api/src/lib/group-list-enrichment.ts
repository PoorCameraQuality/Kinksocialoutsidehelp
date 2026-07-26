import { and, count, eq, gt, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadPlaceLabels, mapGroupWithPlace, type PlaceLabel } from './group-place.js'
import { deliverAvatarUrl, deliverCardImageUrl } from './image-delivery.js'

export type GroupMemberAvatar = {
  userId: string
  avatarUrl: string | null
  displayName: string | null
}

const MEMBER_ROLE_RANK: Record<string, number> = {
  owner: 5,
  admin: 4,
  moderator: 3,
  event_host: 2,
  member: 1,
}

export function snippetText(text: string, maxLen = 160): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`
}

export async function loadActiveMemberCounts(groupIds: string[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map()
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  const countRows = await db
    .select({
      groupId: schema.groupMembers.groupId,
      n: count(schema.groupMembers.id).as('n'),
    })
    .from(schema.groupMembers)
    .innerJoin(schema.profiles, eq(schema.groupMembers.userId, schema.profiles.userId))
    .where(and(inArray(schema.groupMembers.groupId, groupIds), gt(schema.profiles.updatedAt, oneYearAgo)))
    .groupBy(schema.groupMembers.groupId)
  return new Map(countRows.map((r) => [r.groupId, Number(r.n)]))
}

export async function loadGroupMemberAvatarStacks(
  groupIds: string[],
  maxPerGroup = 3
): Promise<Map<string, GroupMemberAvatar[]>> {
  if (groupIds.length === 0) return new Map()
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({
      groupId: schema.groupMembers.groupId,
      userId: schema.groupMembers.userId,
      role: schema.groupMembers.role,
      avatarUrl: schema.profiles.avatarUrl,
      displayName: schema.profiles.displayName,
    })
    .from(schema.groupMembers)
    .innerJoin(schema.profiles, eq(schema.groupMembers.userId, schema.profiles.userId))
    .where(and(inArray(schema.groupMembers.groupId, groupIds), gt(schema.profiles.updatedAt, oneYearAgo)))

  const byGroup = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byGroup.get(row.groupId) ?? []
    list.push(row)
    byGroup.set(row.groupId, list)
  }

  const out = new Map<string, GroupMemberAvatar[]>()
  for (const [groupId, members] of byGroup) {
    members.sort(
      (a, b) =>
        (MEMBER_ROLE_RANK[b.role.toLowerCase()] ?? 0) - (MEMBER_ROLE_RANK[a.role.toLowerCase()] ?? 0)
    )
    out.set(
      groupId,
      members.slice(0, maxPerGroup).map((m) => ({
        userId: m.userId,
        avatarUrl: deliverAvatarUrl(m.avatarUrl, 'sm'),
        displayName: m.displayName,
      }))
    )
  }
  return out
}

type GroupRow = typeof schema.groups.$inferSelect

export type GroupListItem = ReturnType<typeof toGroupListItem>

export function toGroupListItem(
  g: GroupRow,
  placeMap: Map<string, PlaceLabel>,
  memberCount: number,
  memberAvatars: GroupMemberAvatar[],
  extra?: { distanceMi?: number }
) {
  const mapped = mapGroupWithPlace(g, placeMap)
  const description = g.description?.trim() ?? ''
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    visibility: g.visibility,
    category: g.category ?? null,
    tags: g.tags ?? null,
    descriptionSnippet: description ? snippetText(description) : null,
    coverImageUrl: deliverCardImageUrl(g.bannerUrl ?? g.logoUrl ?? null),
    memberCount,
    memberAvatars,
    placeLabel: mapped.placeLabel,
    placeLat: mapped.placeLat,
    placeLng: mapped.placeLng,
    serviceRadiusMi: mapped.serviceRadiusMi,
    createdAt: g.createdAt,
    ...extra,
  }
}

export async function buildGroupListItems(
  groups: GroupRow[],
  extraById?: Map<string, { distanceMi?: number }>
): Promise<GroupListItem[]> {
  if (groups.length === 0) return []
  const ids = groups.map((g) => g.id)
  const [countMap, avatarMap, placeMap] = await Promise.all([
    loadActiveMemberCounts(ids),
    loadGroupMemberAvatarStacks(ids, 3),
    loadPlaceLabels(groups.map((g) => g.placeId).filter((id): id is string => Boolean(id))),
  ])
  return groups.map((g) =>
    toGroupListItem(
      g,
      placeMap,
      countMap.get(g.id) ?? 0,
      avatarMap.get(g.id) ?? [],
      extraById?.get(g.id)
    )
  )
}
