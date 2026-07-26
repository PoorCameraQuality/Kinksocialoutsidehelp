/** Grouped sexuality labels for profile edit (stored in orientation arrays + legacy `profiles.sexuality`). */

export const PROFILE_SEXUALITY_OTHER = 'Other (describe below)' as const

export const PROFILE_SEXUAL_ORIENTATION_GROUPS: ReadonlyArray<{
  label: string
  options: readonly string[]
}> = [
  {
    label: 'General',
    options: [
      'Prefer not to say',
      'Questioning / exploring',
      'Unlabeled',
      'Unsure',
      'Queer',
      'Fluid',
      'Allosexual',
      'Pomosexual',
    ],
  },
  {
    label: 'Monosexual & binary',
    options: [
      'Gay',
      'Lesbian',
      'Heterosexual',
      'Straight',
      'Monosexual',
      'Gynosexual',
      'Androsexual',
    ],
  },
  {
    label: 'Multisexual',
    options: [
      'Bisexual',
      'Pansexual',
      'Omnisexual',
      'Polysexual',
      'Homoflexible',
      'Heteroflexible',
      'Bi-curious',
      'Pan-curious',
      'Straight curious',
      'Gay curious',
      'Lesbian curious',
      'Multisexual',
      'Panflux',
      'Homoflux',
      'Heteroflux',
    ],
  },
  {
    label: 'Ace & gray spectrum',
    options: [
      'Asexual',
      'Demisexual',
      'Graysexual',
      'Aegosexual',
      'Aceflux',
      'Aroace',
      'Cupiosexual',
      'Fraysexual',
      'Lithsexual',
      'Reciprosexual',
      'Apothisexual',
      'Autosexual',
      'Caedsexual',
      'Akoisexual',
    ],
  },
  {
    label: 'Attraction patterns',
    options: [
      'Gynesexual',
      'Skoliosexual',
      'Sapiosexual',
      'Abrosexual',
      'Novosexual',
      'Ceterosexual',
      'Finsexual',
      'Minsexual',
      'Toric',
      'Trixic',
      'Enbiesexual',
      'Neptunic',
      'Marsian',
    ],
  },
  {
    label: 'Custom',
    options: [PROFILE_SEXUALITY_OTHER],
  },
] as const

/** @deprecated Use PROFILE_SEXUAL_ORIENTATION_GROUPS */
export const PROFILE_SEXUALITY_GROUPS = PROFILE_SEXUAL_ORIENTATION_GROUPS

export const PROFILE_ROMANTIC_ORIENTATION_GROUPS: ReadonlyArray<{
  label: string
  options: readonly string[]
}> = [
  {
    label: 'Aromantic spectrum',
    options: [
      'Aromantic',
      'Grayromantic',
      'Demiromantic',
      'Aroflux',
      'Aroace',
      'Apothiromantic',
      'Cupioromantic',
      'Frayromantic',
      'Lithromantic',
      'Quoiromantic',
      'Idemromantic',
      'Recipromantic',
      'Aplatonic',
      'Caedromantic',
    ],
  },
  {
    label: 'Allo & monoromantic',
    options: [
      'Alloromantic',
      'Heteroromantic',
      'Homoromantic',
      'Gayromantic',
      'Lesbiromantic',
      'Monoromantic',
    ],
  },
  {
    label: 'Multisexual romantic',
    options: [
      'Biromantic',
      'Panromantic',
      'Polyromantic',
      'Omniromantic',
      'Homoflexible romantic',
      'Heteroflexible romantic',
      'Biromantic curious',
    ],
  },
  {
    label: 'Fluid & queer romantic',
    options: [
      'Abromantic',
      'Queerplatonic',
      'Queer romantic',
      'Fluid romantic',
      'Questioning romantic',
    ],
  },
  {
    label: 'Attraction patterns',
    options: [
      'Androromantic',
      'Gyneromantic',
      'Skolioromantic',
      'Sapiromantic',
      'Novoromantic',
      'Toricromantic',
      'Trixicromantic',
      'Enbieromantic',
      'Neptunic romantic',
      'Marsian romantic',
    ],
  },
  {
    label: 'Custom',
    options: [PROFILE_SEXUALITY_OTHER],
  },
] as const

export const PROFILE_SEXUALITY_VALUES: readonly string[] = PROFILE_SEXUAL_ORIENTATION_GROUPS.flatMap(
  (g) => g.options,
)

export const PROFILE_ROMANTIC_ORIENTATION_VALUES: readonly string[] =
  PROFILE_ROMANTIC_ORIENTATION_GROUPS.flatMap((g) => g.options)

const KNOWN_LOWER = new Map(
  PROFILE_SEXUALITY_VALUES.filter((v) => v !== PROFILE_SEXUALITY_OTHER).map((v) => [
    v.toLowerCase(),
    v,
  ]),
)

/** True when value is a preset label (not custom Other text). */
export function isPresetProfileSexuality(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  if (t === PROFILE_SEXUALITY_OTHER) return true
  return KNOWN_LOWER.has(t.toLowerCase())
}

/** Split stored sexuality into select value + optional custom text for "Other". */
export function splitProfileSexuality(stored: string | null | undefined): {
  selectValue: string
  customText: string
} {
  const t = (stored ?? '').trim()
  if (!t) return { selectValue: '', customText: '' }
  if (t === PROFILE_SEXUALITY_OTHER) return { selectValue: PROFILE_SEXUALITY_OTHER, customText: '' }
  const canonical = KNOWN_LOWER.get(t.toLowerCase())
  if (canonical) return { selectValue: canonical, customText: '' }
  return { selectValue: PROFILE_SEXUALITY_OTHER, customText: t }
}

export function mergeProfileSexuality(selectValue: string, customText: string): string {
  const sel = selectValue.trim()
  if (!sel) return ''
  if (sel === PROFILE_SEXUALITY_OTHER) return customText.trim().slice(0, 128)
  return sel.slice(0, 128)
}

/** ISO date bounds for DOB picker: 18+ today, max 100 years. */
export function profileBirthDateInputBounds(now = new Date()): { min: string; max: string } {
  const maxD = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  const minD = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate())
  return { min: toIsoDateOnly(minD), max: toIsoDateOnly(maxD) }
}

export function toIsoDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Whole years for `profiles.age` from ISO date (YYYY-MM-DD). */
export function ageFromBirthDate(isoDate: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  const born = new Date(y, mo, day)
  if (Number.isNaN(born.getTime())) return null
  let age = now.getFullYear() - born.getFullYear()
  const md = now.getMonth() - born.getMonth()
  if (md < 0 || (md === 0 && now.getDate() < born.getDate())) age -= 1
  return age >= 0 ? age : null
}

/** Format API date column for `<input type="date" />`. */
export function formatProfileBirthDateForInput(value: string | Date | null | undefined): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) return toIsoDateOnly(value)
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return toIsoDateOnly(d)
}
