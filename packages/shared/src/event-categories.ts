import { z } from 'zod'

/** Canonical community event categories (SG-080). Stored in `events.category`. */
export const EVENT_CATEGORIES = {
  educational: 'Educational',
  social: 'Social',
  playParty: 'Play party',
  sexPositiveParty: 'Sex-positive party',
  conferenceFestival: 'Conference/festival',
} as const

export type EventCategory = (typeof EVENT_CATEGORIES)[keyof typeof EVENT_CATEGORIES]

export const EVENT_CATEGORY_VALUES: readonly EventCategory[] = Object.values(EVENT_CATEGORIES)

const CANONICAL_BY_LOWER = new Map<string, EventCategory>(
  EVENT_CATEGORY_VALUES.map((c) => [c.toLowerCase(), c])
)

/** Legacy free-text and alias strings → canonical category. */
const LEGACY_CATEGORY_ALIASES: Record<string, EventCategory> = {
  munch: EVENT_CATEGORIES.social,
  workshop: EVENT_CATEGORIES.educational,
  'play party': EVENT_CATEGORIES.playParty,
  'sex-positive party': EVENT_CATEGORIES.sexPositiveParty,
  'conference/festival': EVENT_CATEGORIES.conferenceFestival,
  'conference / festival': EVENT_CATEGORIES.conferenceFestival,
}

/** Map legacy or alias input to a canonical category, or null when unrecognized. */
export function normalizeEventCategory(raw: string): EventCategory | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const canonical = CANONICAL_BY_LOWER.get(trimmed.toLowerCase())
  if (canonical) return canonical
  return LEGACY_CATEGORY_ALIASES[trimmed.toLowerCase()] ?? null
}

/** Social-style events (munches, sloshes) use simplified detail UX. */
export function isSocialStyleEventCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = normalizeEventCategory(category)
  return normalized === EVENT_CATEGORIES.social
}

export const eventCategorySchema = z.enum([
  EVENT_CATEGORIES.educational,
  EVENT_CATEGORIES.social,
  EVENT_CATEGORIES.playParty,
  EVENT_CATEGORIES.sexPositiveParty,
  EVENT_CATEGORIES.conferenceFestival,
])
