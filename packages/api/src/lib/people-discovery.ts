/** People directory / connection suggestion privacy helpers. */

export function isUserBlockedFromViewer(
  blockedActorIds: ReadonlySet<string>,
  userId: string,
): boolean {
  return blockedActorIds.has(userId)
}

export function filterBlockedUserIds<T extends { userId: string }>(
  blockedActorIds: ReadonlySet<string>,
  rows: T[],
): T[] {
  if (blockedActorIds.size === 0) return rows
  return rows.filter((row) => !blockedActorIds.has(row.userId))
}
