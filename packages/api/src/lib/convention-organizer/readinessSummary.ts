/** Simplified readiness for C2K (no Supabase). */
export type ReadinessCheck = {
  id: string
  status: 'ok' | 'warn' | 'todo'
  title: string
  detail?: string
}

export type ReadinessSummary = {
  checks: ReadinessCheck[]
  score: number
}

export function buildReadinessSummary(_input: {
  slotCount: number
  unassignedRoomCount: number
  locationCount: number
}): ReadinessSummary {
  const checks: ReadinessCheck[] = []
  if (_input.locationCount === 0) {
    checks.push({ id: 'locations', status: 'todo', title: 'Add rooms or play spaces' })
  } else {
    checks.push({ id: 'locations', status: 'ok', title: 'Venue locations configured' })
  }
  if (_input.slotCount === 0) {
    checks.push({ id: 'program', status: 'todo', title: 'Add program slots' })
  } else {
    checks.push({ id: 'program', status: 'ok', title: 'Program has sessions' })
  }
  if (_input.unassignedRoomCount > 0) {
    checks.push({
      id: 'rooms',
      status: 'warn',
      title: `${_input.unassignedRoomCount} sessions without a room`,
    })
  }
  const ok = checks.filter((c) => c.status === 'ok').length
  return { checks, score: checks.length ? Math.round((ok / checks.length) * 100) : 0 }
}
