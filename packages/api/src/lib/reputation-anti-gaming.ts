import { REFERENCE_SOFT_DECAY_YEARS, SIGNUP_COHORT_WINDOW_HOURS } from '@c2k/shared'

export function capSignal(count: number, max: number): number {
  return Math.max(0, Math.min(count, max))
}

export function isSameSignupCohort(
  referrerCreatedAt: Date,
  subjectCreatedAt: Date,
  windowHours = SIGNUP_COHORT_WINDOW_HOURS
): boolean {
  const windowMs = windowHours * 60 * 60 * 1000
  return Math.abs(referrerCreatedAt.getTime() - subjectCreatedAt.getTime()) <= windowMs
}

export function isReferenceFresh(
  respondedAt: Date | null | undefined,
  maxAgeYears = REFERENCE_SOFT_DECAY_YEARS
): boolean {
  if (!respondedAt) return false
  const maxMs = maxAgeYears * 365.25 * 24 * 60 * 60 * 1000
  return Date.now() - respondedAt.getTime() <= maxMs
}

export function accountAgeDays(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
}

/** Max one level-boosting reference per registration IP prefix cluster. */
export function filterReferencesByIpCluster<
  T extends { referrerIpPrefix: string | null; id: string },
>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const key = row.referrerIpPrefix?.trim() || `anon:${row.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

export function detectIdenticalTextBurst(texts: Array<string | null | undefined>, minCount = 3): boolean {
  const counts = new Map<string, number>()
  for (const raw of texts) {
    const t = raw?.trim().toLowerCase()
    if (!t || t.length < 20) continue
    counts.set(t, (counts.get(t) ?? 0) + 1)
    if ((counts.get(t) ?? 0) >= minCount) return true
  }
  return false
}

/** Pairs of reciprocal reviews (A reviewed B and B reviewed A) within a window. */
export function detectReciprocalReviewPairs(
  edges: Array<{ authorId: string; targetUserId: string }>
): number {
  const set = new Set(edges.map((e) => `${e.authorId}:${e.targetUserId}`))
  let pairs = 0
  const seen = new Set<string>()
  for (const e of edges) {
    const rev = `${e.targetUserId}:${e.authorId}`
    const key = [e.authorId, e.targetUserId].sort().join(':')
    if (set.has(rev) && !seen.has(key)) {
      seen.add(key)
      pairs += 1
    }
  }
  return pairs
}

/** Recommend mod review when rating jumps after recent conflict signals. */
export function shouldHoldRatingForModReview(input: {
  previousAvg: number
  newAvg: number
  reviewCount: number
  recentReportCount: number
  recentOpenCases: number
}): boolean {
  if (input.reviewCount < 2) return false
  const delta = input.newAvg - input.previousAvg
  const spike = delta >= 1.5 && input.newAvg >= 4.5
  const conflict = input.recentReportCount >= 1 || input.recentOpenCases >= 1
  return spike && conflict
}
