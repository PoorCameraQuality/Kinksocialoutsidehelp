/** Pure helpers for dancecard_locations parent_id validation (cycle detection). */

export type LocationParentRow = { id: string; parentId: string | null }

/** True if setting `locationId`'s parent to `newParentId` would create a cycle. */
export function wouldCreateParentCycle(
  rows: LocationParentRow[],
  locationId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId || newParentId === locationId) return newParentId === locationId
  const parentById = new Map<string, string | null>()
  for (const r of rows) {
    if (r.id === locationId) parentById.set(r.id, newParentId)
    else parentById.set(r.id, r.parentId)
  }
  let walk: string | null = newParentId
  const seen = new Set<string>()
  while (walk) {
    if (walk === locationId) return true
    if (seen.has(walk)) return true
    seen.add(walk)
    walk = parentById.get(walk) ?? null
  }
  return false
}

/** Location ids that are `rootId` or any of its descendants (for parent picker UX). */
export function collectDescendantIds(rows: LocationParentRow[], rootId: string): Set<string> {
  const childrenByParent = new Map<string | null, string[]>()
  for (const r of rows) {
    const p = r.parentId
    const list = childrenByParent.get(p) ?? []
    list.push(r.id)
    childrenByParent.set(p, list)
  }
  const out = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    const kids = childrenByParent.get(id) ?? []
    for (const k of kids) stack.push(k)
  }
  return out
}
