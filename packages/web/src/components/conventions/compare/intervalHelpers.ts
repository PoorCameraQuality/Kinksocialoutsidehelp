export type MsInterval = { startMs: number; endMs: number }

export function mergeMsIntervals(intervals: MsInterval[]): MsInterval[] {
  const sorted = intervals
    .filter((i) => i.endMs > i.startMs)
    .sort((a, b) => a.startMs - b.startMs)
  if (sorted.length === 0) return []
  const out: MsInterval[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, cur.endMs)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

export function intervalFullyInsideAnyUnion(startMs: number, endMs: number, union: MsInterval[]): boolean {
  return union.some((u) => startMs >= u.startMs && endMs <= u.endMs)
}

export function intervalOverlapsAnyUnion(startMs: number, endMs: number, union: MsInterval[]): boolean {
  return union.some((u) => startMs < u.endMs && endMs > u.startMs)
}

export function gapsToMs(gaps: { startsAt: string; endsAt: string }[]): MsInterval[] {
  return gaps
    .map((g) => ({ startMs: Date.parse(g.startsAt), endMs: Date.parse(g.endsAt) }))
    .filter((g) => Number.isFinite(g.startMs) && Number.isFinite(g.endMs) && g.endMs > g.startMs)
}
