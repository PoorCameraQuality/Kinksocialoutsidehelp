export function applicationAnswerEntries(payload: Record<string, unknown> | null | undefined): [string, unknown][] {
  if (!payload || typeof payload !== 'object') return []
  const byLabel = payload.answersByLabel
  if (byLabel && typeof byLabel === 'object' && !Array.isArray(byLabel)) {
    return Object.entries(byLabel as Record<string, unknown>)
  }
  const skip = new Set(['trustedRoleId', 'trustedRoleName', 'answers', 'answersByLabel'])
  return Object.entries(payload).filter(([k]) => !skip.has(k))
}

export function applicationRoleLabel(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload || typeof payload !== 'object') return null
  const name = payload.trustedRoleName
  return typeof name === 'string' && name.trim() ? name.trim() : null
}
