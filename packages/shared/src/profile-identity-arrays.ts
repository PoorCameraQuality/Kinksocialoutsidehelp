import { PROFILE_SEXUALITY_OTHER, splitProfileSexuality } from './profile-identity-options.js'

/** Trim, dedupe (case-insensitive), and cap array length. */
export function capArray(values: string[] | null | undefined, max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values ?? []) {
    const t = String(raw).trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t.slice(0, 128))
    if (out.length >= max) break
  }
  return out
}

const PRONOUN_PRESETS = new Map<string, string>([
  ['he/him', 'he/him'],
  ['she/her', 'she/her'],
  ['they/them', 'they/them'],
  ['ze/zir', 'ze/zir'],
  ['xe/xem', 'xe/xem'],
  ['any pronouns', 'Any pronouns'],
  ['ask me', 'Ask me'],
])

/** Parse stored pronoun tags or legacy comma/slash string into normalized tags. */
export function parsePronounTags(stored: string | string[] | null | undefined): string[] {
  if (Array.isArray(stored)) return capArray(stored, 3)
  const t = (stored ?? '').trim()
  if (!t) return []
  const parts = t
    .split(/[,;/|]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const normalized = parts.map((p) => {
    const preset = PRONOUN_PRESETS.get(p.toLowerCase())
    return preset ?? p
  })
  return capArray(normalized, 3)
}

/** Display string for legacy `profiles.pronouns` varchar (max 64). */
export function formatPronounDisplay(tags: string[] | null | undefined): string {
  return capArray(tags, 3).join(' · ').slice(0, 64)
}

export const PROFILE_ORIENTATION_MAX = 10 as const
export const PROFILE_PRONOUN_MAX = 3 as const

/** Parse legacy `profiles.sexuality` varchar into orientation labels (comma-separated or single select). */
export function parseLegacySexualityLabels(sexuality: string | null | undefined): string[] {
  const t = (sexuality ?? '').trim()
  if (!t) return []
  if (t.includes(',')) {
    return capArray(
      t.split(',').map((s) => s.trim()),
      PROFILE_ORIENTATION_MAX,
    )
  }
  const { selectValue, customText } = splitProfileSexuality(t)
  if (selectValue && selectValue !== PROFILE_SEXUALITY_OTHER) return [selectValue]
  if (customText) return [customText]
  return [t]
}
