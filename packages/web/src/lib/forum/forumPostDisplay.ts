export type ForumPostRow = {
  id: string
  parentId?: string | null
}

/** Depth map for nested replies; flat threads treat every reply after the first post as depth 1. */
export function computeForumPostDepthMap(posts: readonly ForumPostRow[]): Map<string, number> {
  const byId = new Map(posts.map((p) => [p.id, p]))
  const cache = new Map<string, number>()
  const hasNesting = posts.some((p) => p.parentId != null && p.parentId !== '')

  function depthOf(id: string, stack: Set<string> = new Set()): number {
    if (cache.has(id)) return cache.get(id)!
    if (stack.has(id)) {
      cache.set(id, 0)
      return 0
    }
    stack.add(id)

    const post = byId.get(id)
    if (!post) {
      cache.set(id, 0)
      return 0
    }

    if (!hasNesting) {
      const idx = posts.findIndex((p) => p.id === id)
      const d = idx <= 0 ? 0 : 1
      cache.set(id, d)
      return d
    }

    if (!post.parentId) {
      const idx = posts.findIndex((p) => p.id === id)
      const d = idx === 0 ? 0 : 1
      cache.set(id, d)
      return d
    }

    const parentDepth = depthOf(post.parentId, stack)
    const d = Math.min(parentDepth + 1, 3)
    cache.set(id, d)
    return d
  }

  for (const p of posts) depthOf(p.id)
  return cache
}

export function forumPostBadgeFlags(opts: {
  threadAuthorId: string
  postAuthorId: string
  viewerUserId: string | null
  moderatorUserIds: ReadonlySet<string>
}): { showAuthor: boolean; showModerator: boolean } {
  const showAuthor =
    opts.postAuthorId === opts.threadAuthorId && opts.postAuthorId !== opts.viewerUserId
  const showModerator = opts.moderatorUserIds.has(opts.postAuthorId)
  return { showAuthor, showModerator }
}

export function orgModeratorUserIds(members: readonly { userId: string; role: string }[]): Set<string> {
  const ids = new Set<string>()
  for (const m of members) {
    const r = m.role.toUpperCase()
    if (r === 'MODERATOR' || r === 'ADMIN' || r === 'OWNER') ids.add(m.userId)
  }
  return ids
}

export function groupModeratorUserIds(
  members: readonly { userId: string; role: string }[],
  ownerId?: string | null
): Set<string> {
  const ids = new Set<string>()
  if (ownerId) ids.add(ownerId)
  for (const m of members) {
    if (['owner', 'admin', 'moderator'].includes(m.role.toLowerCase())) ids.add(m.userId)
  }
  return ids
}
