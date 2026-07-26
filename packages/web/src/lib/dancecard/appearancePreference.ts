import { DEFAULT_DANCECARD_APPEARANCE, type DancecardAppearanceId } from '@/lib/dancecard/appearancePresets'

export const DANCECARD_APPEARANCE_STORAGE_KEY = 'ecke-dancecard-appearance'

const VALID_IDS = new Set<string>([
  'parchment',
  'midnight-velvet',
  'midnight-brass',
  'lifted-ink',
  'coastal-slate',
  'high-noon',
  'midnight-teal',
  'obsidian-purple',
  'emerald-night',
  'crimson-classic',
  'steel-blue',
  'copper-dungeon',
  'sapphire-night',
  'dark-rose',
  'gunmetal-orange',
])

export function readStoredAppearance(
  fallback: DancecardAppearanceId = DEFAULT_DANCECARD_APPEARANCE,
): DancecardAppearanceId {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(DANCECARD_APPEARANCE_STORAGE_KEY)
    if (raw && VALID_IDS.has(raw)) return raw as DancecardAppearanceId
  } catch {
    /* ignore */
  }
  return fallback
}

export function writeStoredAppearance(id: DancecardAppearanceId): void {
  try {
    window.localStorage.setItem(DANCECARD_APPEARANCE_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}
