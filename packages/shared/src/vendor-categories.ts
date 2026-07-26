import { z } from 'zod'

/** Purpose-based vendor discovery categories. Primary is vendor_profiles.category. Multi-select uses categories. */
export const VENDOR_CATEGORIES = {
  ropeRigging: 'Rope & rigging',
  impactSensation: 'Impact & sensation',
  leatherWear: 'Leather & wear',
  gearAccessories: 'Gear & accessories',
  artLifestyle: 'Art & lifestyle',
  services: 'Services',
  aftercareWellness: 'Aftercare & wellness',
  booksEducation: 'Books & education',
  electroTech: 'Electro & tech',
} as const

export type VendorCategory = (typeof VENDOR_CATEGORIES)[keyof typeof VENDOR_CATEGORIES]

export const VENDOR_CATEGORY_VALUES: readonly VendorCategory[] = Object.values(VENDOR_CATEGORIES)

/** Max purpose categories a shop may select (prevents directory spam). */
export const VENDOR_CATEGORY_SELECT_MAX = 4

/** Max freeform specialty tags (separate from purpose categories). */
export const VENDOR_TAG_MAX = 8

/** Short helper copy for onboarding, settings, and filter tooltips. */
export const VENDOR_CATEGORY_DESCRIPTIONS: Record<VendorCategory, string> = {
  [VENDOR_CATEGORIES.ropeRigging]: 'Rope, rigging, suspension, and shibari supplies',
  [VENDOR_CATEGORIES.impactSensation]: 'Floggers, paddles, sensation tools, and impact toys',
  [VENDOR_CATEGORIES.leatherWear]: 'Leather apparel, harnesses, collars, and fetish wear',
  [VENDOR_CATEGORIES.gearAccessories]: 'General BDSM gear, jewelry, pup play, and accessories',
  [VENDOR_CATEGORIES.artLifestyle]: 'Art prints, decor, lifestyle goods, and mixed media',
  [VENDOR_CATEGORIES.services]: 'Photography, commissions, and professional services',
  [VENDOR_CATEGORIES.aftercareWellness]: 'Safety gear, aftercare, wellness, and care products',
  [VENDOR_CATEGORIES.booksEducation]: 'Books, zines, classes, and educational media',
  [VENDOR_CATEGORIES.electroTech]: 'E-stim, violet wands, and specialty electronics',
}

const CANONICAL_BY_LOWER = new Map<string, VendorCategory>(
  VENDOR_CATEGORY_VALUES.map((c) => [c.toLowerCase(), c]),
)

/** Legacy free-form labels and old filter chips → canonical purpose category. */
const LEGACY_VENDOR_CATEGORY_ALIASES: Record<string, VendorCategory> = {
  rope: VENDOR_CATEGORIES.ropeRigging,
  rigging: VENDOR_CATEGORIES.ropeRigging,
  shibari: VENDOR_CATEGORIES.ropeRigging,
  jute: VENDOR_CATEGORIES.ropeRigging,
  impact: VENDOR_CATEGORIES.impactSensation,
  sensation: VENDOR_CATEGORIES.impactSensation,
  flogger: VENDOR_CATEGORIES.impactSensation,
  floggers: VENDOR_CATEGORIES.impactSensation,
  handmade: VENDOR_CATEGORIES.impactSensation,
  leather: VENDOR_CATEGORIES.leatherWear,
  restraints: VENDOR_CATEGORIES.leatherWear,
  harness: VENDOR_CATEGORIES.leatherWear,
  harnesses: VENDOR_CATEGORIES.leatherWear,
  apparel: VENDOR_CATEGORIES.leatherWear,
  fetish: VENDOR_CATEGORIES.leatherWear,
  'pup play': VENDOR_CATEGORIES.gearAccessories,
  pup: VENDOR_CATEGORIES.gearAccessories,
  gear: VENDOR_CATEGORIES.gearAccessories,
  toys: VENDOR_CATEGORIES.gearAccessories,
  accessories: VENDOR_CATEGORIES.gearAccessories,
  jewelry: VENDOR_CATEGORIES.gearAccessories,
  collars: VENDOR_CATEGORIES.gearAccessories,
  clothing: VENDOR_CATEGORIES.leatherWear,
  art: VENDOR_CATEGORIES.artLifestyle,
  lifestyle: VENDOR_CATEGORIES.artLifestyle,
  decor: VENDOR_CATEGORIES.artLifestyle,
  photography: VENDOR_CATEGORIES.services,
  services: VENDOR_CATEGORIES.services,
  safety: VENDOR_CATEGORIES.aftercareWellness,
  aftercare: VENDOR_CATEGORIES.aftercareWellness,
  wellness: VENDOR_CATEGORIES.aftercareWellness,
  books: VENDOR_CATEGORIES.booksEducation,
  education: VENDOR_CATEGORIES.booksEducation,
  zines: VENDOR_CATEGORIES.booksEducation,
  electro: VENDOR_CATEGORIES.electroTech,
  'e-stim': VENDOR_CATEGORIES.electroTech,
  estim: VENDOR_CATEGORIES.electroTech,
  'violet wand': VENDOR_CATEGORIES.electroTech,
}

/** Map legacy or alias input to a canonical category, or null when unrecognized. */
export function normalizeVendorCategory(raw: string): VendorCategory | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const canonical = CANONICAL_BY_LOWER.get(lower)
  if (canonical) return canonical
  return LEGACY_VENDOR_CATEGORY_ALIASES[lower] ?? null
}

/** Normalize multi-select purpose categories: deduped, canonical, capped. */
export function normalizeVendorCategories(raw: readonly string[]): VendorCategory[] {
  const seen = new Set<VendorCategory>()
  const out: VendorCategory[] = []
  for (const c of raw) {
    const normalized = normalizeVendorCategory(c)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
    if (out.length >= VENDOR_CATEGORY_SELECT_MAX) break
  }
  return out
}

/** Read selected purpose categories from API row fields. */
export function vendorCategoriesFromRow(input: {
  category?: string | null
  categories?: readonly string[] | null
}): VendorCategory[] {
  const fromColumn = normalizeVendorCategories(input.categories ?? [])
  if (fromColumn.length > 0) return fromColumn
  if (input.category?.trim()) {
    const single = normalizeVendorCategory(input.category)
    return single ? [single] : []
  }
  return []
}

/** Infer primary category from a legacy categories array (first mappable entry). */
export function inferVendorCategoryFromLegacy(categories: readonly string[]): VendorCategory | null {
  for (const c of categories) {
    const normalized = normalizeVendorCategory(c)
    if (normalized) return normalized
  }
  return null
}

export const vendorCategorySchema = z.enum([
  VENDOR_CATEGORIES.ropeRigging,
  VENDOR_CATEGORIES.impactSensation,
  VENDOR_CATEGORIES.leatherWear,
  VENDOR_CATEGORIES.gearAccessories,
  VENDOR_CATEGORIES.artLifestyle,
  VENDOR_CATEGORIES.services,
  VENDOR_CATEGORIES.aftercareWellness,
  VENDOR_CATEGORIES.booksEducation,
  VENDOR_CATEGORIES.electroTech,
])

/** Normalize and validate tags: lowercase, trimmed, deduped, max {@link VENDOR_TAG_MAX}. */
export function normalizeVendorTags(raw: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of raw) {
    const normalized = t.trim().toLowerCase().replace(/\s+/g, '-')
    if (!normalized || normalized.length > 64 || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
    if (out.length >= VENDOR_TAG_MAX) break
  }
  return out
}

/** Build legacy categories[] from purpose categories + tags for backward compat. */
export function vendorCategoriesCompat(
  purposeCategories: readonly VendorCategory[],
  tags: readonly string[],
): string[] {
  const out: string[] = []
  for (const cat of purposeCategories) {
    if (!out.some((c) => c.toLowerCase() === cat.toLowerCase())) out.push(cat)
  }
  for (const t of tags) {
    const label = t.trim()
    if (!label) continue
    if (!out.some((c) => c.toLowerCase() === label.toLowerCase())) out.push(label)
  }
  return out
}
