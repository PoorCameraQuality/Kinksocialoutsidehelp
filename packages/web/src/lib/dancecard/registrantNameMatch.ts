/** Normalize person names for registrant ↔ dancecard account matching. */
export function normPersonName(s: string) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

export type RegistrantNameRow = { id: string; scene_display_name?: string | null }

export function findRegistrantByNames(
  rows: RegistrantNameRow[],
  ...candidates: (string | null | undefined)[]
): RegistrantNameRow | null {
  const targets = new Set(
    candidates.map((c) => (c ? normPersonName(c) : '')).filter(Boolean),
  )
  if (!targets.size) return null
  return (
    rows.find((r) => {
      const scene = normPersonName(String(r.scene_display_name ?? ''))
      return scene.length > 0 && targets.has(scene)
    }) ?? null
  )
}
