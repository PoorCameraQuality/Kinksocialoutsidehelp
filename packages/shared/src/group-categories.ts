import { z } from 'zod'

/** Purpose-based group discovery categories. Stored in `groups.category`. */
export const GROUP_CATEGORIES = {
  social: 'Social',
  education: 'Education',
  playScene: 'Play & scene',
  affinity: 'Affinity',
  personals: 'Personals',
  marketplace: 'Marketplace',
  discussion: 'Discussion',
} as const

export type GroupCategory = (typeof GROUP_CATEGORIES)[keyof typeof GROUP_CATEGORIES]

export const GROUP_CATEGORY_VALUES: readonly GroupCategory[] = Object.values(GROUP_CATEGORIES)

/** Short helper copy for organizer settings and filter tooltips. */
export const GROUP_CATEGORY_DESCRIPTIONS: Record<GroupCategory, string> = {
  [GROUP_CATEGORIES.social]: 'Casual meetups, munches, sloshes, and hangouts',
  [GROUP_CATEGORIES.education]: 'Classes, workshops, skill shares, and demos',
  [GROUP_CATEGORIES.playScene]: 'Play parties, dungeon groups, and scene practice',
  [GROUP_CATEGORIES.affinity]: 'Identity- or community-centered groups (LGBTQ+, demographics)',
  [GROUP_CATEGORIES.personals]: 'Dating, connections, and personal ads',
  [GROUP_CATEGORIES.marketplace]: 'Buy/sell, classifieds, gear swap, and yard sales',
  [GROUP_CATEGORIES.discussion]: 'Forum-first, support, Q&A, and online discussion',
}

const CANONICAL_BY_LOWER = new Map<string, GroupCategory>(
  GROUP_CATEGORY_VALUES.map((c) => [c.toLowerCase(), c])
)

/** Legacy SG-138 modality labels and common aliases → canonical purpose category. */
const LEGACY_GROUP_CATEGORY_ALIASES: Record<string, GroupCategory> = {
  bdsm: GROUP_CATEGORIES.playScene,
  fetish: GROUP_CATEGORIES.playScene,
  kink: GROUP_CATEGORIES.playScene,
  rope: GROUP_CATEGORIES.education,
  lifestyle: GROUP_CATEGORIES.social,
  'lgbtq+': GROUP_CATEGORIES.affinity,
  lgbtq: GROUP_CATEGORIES.affinity,
  munch: GROUP_CATEGORIES.social,
  slosh: GROUP_CATEGORIES.social,
  workshop: GROUP_CATEGORIES.education,
  classifieds: GROUP_CATEGORIES.marketplace,
  'yard sale': GROUP_CATEGORIES.marketplace,
  yardsale: GROUP_CATEGORIES.marketplace,
  'gear swap': GROUP_CATEGORIES.marketplace,
  personals: GROUP_CATEGORIES.personals,
  dungeon: GROUP_CATEGORIES.playScene,
  'play party': GROUP_CATEGORIES.playScene,
  support: GROUP_CATEGORIES.discussion,
  forum: GROUP_CATEGORIES.discussion,
}

/** Map legacy or alias input to a canonical category, or null when unrecognized. */
export function normalizeGroupCategory(raw: string): GroupCategory | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const canonical = CANONICAL_BY_LOWER.get(lower)
  if (canonical) return canonical
  return LEGACY_GROUP_CATEGORY_ALIASES[lower] ?? null
}

export const groupCategorySchema = z.enum([
  GROUP_CATEGORIES.social,
  GROUP_CATEGORIES.education,
  GROUP_CATEGORIES.playScene,
  GROUP_CATEGORIES.affinity,
  GROUP_CATEGORIES.personals,
  GROUP_CATEGORIES.marketplace,
  GROUP_CATEGORIES.discussion,
])

/** Normalize and validate tags: lowercase, trimmed, deduped, max 20. */
export function normalizeGroupTags(raw: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of raw) {
    const normalized = t.trim().toLowerCase().replace(/\s+/g, '-')
    if (!normalized || normalized.length > 64 || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
    if (out.length >= 20) break
  }
  return out
}
