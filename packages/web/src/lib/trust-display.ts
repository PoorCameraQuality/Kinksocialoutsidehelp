import { getSegmentValues } from '@/components/TrustRing'
import type { TrustRingScores } from '@/data/types'

/** True when segment bars are synthetic (score/5) rather than real breakdown data. */
export function trustBreakdownIsPlaceholder(score: number, segments?: TrustRingScores): boolean {
  if (!segments) return true
  const vals = getSegmentValues(score, segments)
  const fallback = Math.round(score / 5)
  return vals.every((v) => v === fallback)
}
