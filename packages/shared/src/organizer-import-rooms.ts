export type RoomMatchCandidate = { id: string; name: string; shortName?: string | null }

export type RoomMatchResult =
  | { status: 'exact'; locationId: string; locationName: string }
  | { status: 'fuzzy'; locationId: string; locationName: string; score: number }
  | { status: 'unknown'; suggestions: Array<{ id: string; name: string; score: number }> }

function normRoom(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')
}

function tokenSet(s: string) {
  return new Set(normRoom(s).split(/\s+/).filter(Boolean))
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 1
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

export function matchRoomLabel(label: string, locations: RoomMatchCandidate[]): RoomMatchResult {
  const n = normRoom(label)
  if (!n) return { status: 'unknown', suggestions: [] }
  for (const loc of locations) {
    if (normRoom(loc.name) === n) return { status: 'exact', locationId: loc.id, locationName: loc.name }
    if (loc.shortName && normRoom(loc.shortName) === n) {
      return { status: 'exact', locationId: loc.id, locationName: loc.name }
    }
  }
  const tokens = tokenSet(label)
  const scored = locations
    .map((loc) => {
      const score = Math.max(jaccard(tokens, tokenSet(loc.name)), loc.shortName ? jaccard(tokens, tokenSet(loc.shortName)) : 0)
      return { id: loc.id, name: loc.name, score }
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
  if (scored[0] && scored[0].score >= 0.85) {
    return { status: 'fuzzy', locationId: scored[0].id, locationName: scored[0].name, score: scored[0].score }
  }
  return { status: 'unknown', suggestions: scored.slice(0, 5) }
}
