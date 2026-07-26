import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'

export type ProgramSlotStats = {
  total: number
  published: number
  draft: number
  hidden: number
  unscheduled: number
}

export function computeProgramSlotStats(slots: ProgramSlotRow[]): ProgramSlotStats {
  let published = 0
  let draft = 0
  let hidden = 0
  let unscheduled = 0
  for (const s of slots) {
    if (!s.startsAt || !s.endsAt) unscheduled += 1
    if (!s.isPublished) draft += 1
    else published += 1
    if (s.visibility === 'staff_only' || s.visibility === 'secret') hidden += 1
  }
  return { total: slots.length, published, draft, hidden, unscheduled }
}
