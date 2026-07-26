/**
 * Dancecard appearance presets - shared by attendee, organizer, and palette lab.
 * Applied via `data-dc-appearance` on `dc-gold-chrome` / `[data-dc-theme='event']` roots.
 */

import { enrichAppearanceVars, buildDarkCommunityVars } from '@/lib/dancecard/appearanceThemeBuilder'

export type DancecardAppearanceId =
  | 'parchment'
  | 'midnight-velvet'
  | 'midnight-brass'
  | 'lifted-ink'
  | 'coastal-slate'
  | 'high-noon'
  | 'midnight-teal'
  | 'obsidian-purple'
  | 'emerald-night'
  | 'crimson-classic'
  | 'steel-blue'
  | 'copper-dungeon'
  | 'sapphire-night'
  | 'dark-rose'
  | 'gunmetal-orange'

export type DancecardAppearancePreset = {
  id: DancecardAppearanceId
  name: string
  tagline: string
  bestFor: string
  mode: 'light' | 'dark'
  vars: Record<string, string>
}

const PARCHMENT_VARS: Record<string, string> = {
  '--dc-surface': '#f4f0e8',
  '--dc-surface-muted': '#e8e2d6',
  '--dc-elevated': 'rgba(255, 255, 255, 0.94)',
  '--dc-elevated-solid': '#ffffff',
  '--dc-elevated-muted': 'rgba(237, 228, 207, 0.75)',
  '--dc-text': '#1c1814',
  '--dc-text-muted': '#4f483f',
  '--dc-text-subtle': '#6e5310',
  '--dc-muted': '#4f483f',
  '--dc-accent': '#8b6914',
  '--dc-accent-hover': '#6e5310',
  '--dc-accent-muted': '#ede4cf',
  '--dc-accent-border': '#9a7b2f',
  '--dc-accent-foreground': '#ffffff',
  '--dc-border-subtle': '#c9b896',
  '--dc-border-strong': '#9a7b2f',
  '--dc-danger': '#b91c1c',
  '--dc-danger-muted': 'rgba(185, 28, 28, 0.1)',
  '--dc-danger-border': 'rgba(185, 28, 28, 0.35)',
  '--dc-success': '#2f6b4f',
  '--dc-success-muted': 'rgba(47, 107, 79, 0.12)',
  '--dc-warning': '#b45309',
  '--dc-warning-muted': 'rgba(180, 83, 9, 0.12)',
  '--dc-slot-published': '#8b6914',
  '--dc-slot-accent-mix': '18%',
  '--dc-shadow-soft': '0 12px 32px rgba(45, 38, 28, 0.1)',
  '--dc-shadow-panel': '0 20px 48px rgba(45, 38, 28, 0.14)',
  '--dc-compare-mutual': '#2f6b4f',
  '--dc-compare-busy': '#b91c1c',
  '--dc-compare-busy-ring': 'rgba(185, 28, 28, 0.45)',
  '--dc-compare-host-only': '#3d5a80',
  '--dc-compare-host-only-ring': 'rgba(61, 90, 128, 0.5)',
  '--dc-compare-outside': '#d4cfc4',
  '--dc-compare-selected': 'rgba(139, 105, 20, 0.28)',
  '--ecke-link': '#8b6914',
  '--ecke-link-visited': '#6e5310',
  '--ecke-focus': '#9a7b2f',
  '--ecke-focus-ring': 'rgba(139, 105, 20, 0.35)',
  '--dc-avail-open-bg': 'rgba(47, 107, 79, 0.14)',
  '--dc-avail-open-border': 'rgba(47, 107, 79, 0.4)',
  '--dc-avail-open-text': '#2f6b4f',
  '--dc-avail-busy-bg': 'rgba(185, 28, 28, 0.1)',
  '--dc-avail-busy-border': 'rgba(185, 28, 28, 0.35)',
  '--dc-avail-busy-text': '#991b1b',
  '--dc-avail-claimed-bg': 'rgba(139, 105, 20, 0.12)',
  '--dc-avail-claimed-border': 'rgba(154, 123, 47, 0.4)',
  '--dc-avail-claimed-text': '#6e5310',
  '--dc-glass-shadow': '0 18px 54px rgba(45, 38, 28, 0.14)',
  '--dc-glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.45)',
  '--dc-tab-shell-shadow': 'inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 14px 36px rgba(45, 38, 28, 0.08)',
  '--dc-tab-inactive-bg': 'rgba(255, 255, 255, 0.72)',
  '--dc-tab-inactive-hover-bg': 'var(--dc-elevated-solid)',
  '--dc-tab-active-shadow': '0 10px 28px rgba(139, 105, 20, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
  '--dc-chip-bg': 'rgba(255, 255, 255, 0.5)',
  '--dc-chip-hover-bg': 'var(--dc-accent-muted)',
}

/**
 * Midnight Velvet - default member social palette (charcoal + velvet rose).
 * Copper/gold belong in optional themes (e.g. midnight-brass), not as the general active state.
 * Teal/success tokens are reserved for trust, safety, privacy, and confirmed states.
 */
const MIDNIGHT_VELVET_VARS: Record<string, string> = {
  ...buildDarkCommunityVars({
    background: '#090A0F',
    card: '#171923',
    cardHover: '#262B3A',
    input: '#12151E',
    border: '#303644',
    primary: '#E6638E',
    text: '#F7F2EA',
    bodyText: '#D6CDC1',
    mutedText: '#968A9A',
  }),
  '--dc-surface-muted': '#11131A',
  '--dc-elevated-solid': '#1F2330',
  '--dc-text-subtle': '#AA9FB0',
  '--dc-accent-hover': '#F07A9F',
  '--dc-accent-muted': '#2A1722',
  '--dc-accent-border': '#8A3650',
  '--dc-accent-foreground': '#090A0F',
  '--dc-border-strong': '#4A5367',
  '--dc-danger': '#F87171',
  '--dc-danger-muted': 'rgba(248, 113, 113, 0.12)',
  '--dc-danger-border': 'rgba(248, 113, 113, 0.35)',
  '--dc-success': '#6EE7B7',
  '--dc-success-muted': 'rgba(110, 231, 183, 0.12)',
  '--dc-warning': '#FBBF24',
  '--dc-warning-muted': 'rgba(251, 191, 36, 0.12)',
}

/** Black Gold - luxury charcoal + gold alternate theme. */
const MIDNIGHT_BRASS_VARS: Record<string, string> = buildDarkCommunityVars({
  background: '#121212',
  card: '#1e1e1e',
  cardHover: '#262626',
  input: '#1a1a1a',
  border: '#2b2b2b',
  primary: '#d4af37',
  text: '#ffffff',
  bodyText: '#d1d5db',
  mutedText: '#9ca3af',
})

function communityPreset(
  id: DancecardAppearanceId,
  name: string,
  tagline: string,
  palette: Parameters<typeof buildDarkCommunityVars>[0],
): DancecardAppearancePreset {
  return {
    id,
    name,
    tagline,
    bestFor: 'Community feed, events, and profiles',
    mode: 'dark',
    vars: buildDarkCommunityVars(palette),
  }
}

const COMMUNITY_THEME_PRESETS: DancecardAppearancePreset[] = [
  communityPreset('midnight-teal', 'Midnight Teal', 'Modern SaaS cool', {
    background: '#081018',
    card: '#101a24',
    cardHover: '#15202c',
    input: '#1a2834',
    border: '#2a3a48',
    primary: '#00c2b8',
    text: '#eaf9f7',
  }),
  communityPreset('obsidian-purple', 'Obsidian Purple', 'Bold nightlife energy', {
    background: '#0d0812',
    card: '#17101e',
    cardHover: '#1f1528',
    input: '#261a30',
    border: '#3b2a4a',
    primary: '#a855f7',
    text: '#f5f3ff',
  }),
  communityPreset('emerald-night', 'Emerald', 'Fresh forest tone', {
    background: '#08110d',
    card: '#0f1814',
    cardHover: '#142019',
    input: '#1a2820',
    border: '#2a4034',
    primary: '#34d399',
    text: '#f0fff7',
  }),
  communityPreset('crimson-classic', 'Crimson', 'Adult but classy', {
    background: '#100809',
    card: '#181011',
    cardHover: '#201416',
    input: '#28181a',
    border: '#3d282c',
    primary: '#ff4d6d',
    text: '#fff1f3',
  }),
  communityPreset('steel-blue', 'Steel Blue', 'Professional calm', {
    background: '#081019',
    card: '#111827',
    cardHover: '#161e2e',
    input: '#1c2538',
    border: '#2d3a52',
    primary: '#60a5fa',
    text: '#eff6ff',
  }),
  communityPreset('copper-dungeon', 'Copper', 'Dungeon warmth', {
    background: '#120e0b',
    card: '#1c1612',
    cardHover: '#241d18',
    input: '#2c241e',
    border: '#3f3428',
    primary: '#c47a44',
    text: '#fff8f2',
  }),
  communityPreset('sapphire-night', 'Sapphire', 'Clean deep blue', {
    background: '#060b16',
    card: '#0e1525',
    cardHover: '#121c30',
    input: '#18243a',
    border: '#2a3858',
    primary: '#4f8cff',
    text: '#f2f7ff',
  }),
  communityPreset('dark-rose', 'Dark Rose', 'Community warmth', {
    background: '#120a0e',
    card: '#1c1116',
    cardHover: '#24161c',
    input: '#2c1a22',
    border: '#3f2a34',
    primary: '#e879f9',
    text: '#fff5fe',
  }),
  communityPreset('gunmetal-orange', 'Gunmetal Orange', 'High contrast utility', {
    background: '#0b0b0b',
    card: '#171717',
    cardHover: '#1f1f1f',
    input: '#262626',
    border: '#333333',
    primary: '#f59e0b',
    text: '#fff8eb',
  }),
]

export const DANCECARD_APPEARANCE_PRESETS: readonly DancecardAppearancePreset[] = [
  {
    id: 'parchment',
    name: 'Parchment & Brass',
    tagline: 'Warm light default',
    bestFor: 'Outdoor readability and print-like clarity',
    mode: 'light',
    vars: PARCHMENT_VARS,
  },
  {
    id: 'midnight-velvet',
    name: 'Midnight Velvet',
    tagline: 'Mature dark default',
    bestFor: 'Community feed, events, profiles, messaging, and settings',
    mode: 'dark',
    vars: MIDNIGHT_VELVET_VARS,
  },
  {
    id: 'midnight-brass',
    name: 'Black Gold',
    tagline: 'Luxury charcoal + gold',
    bestFor: 'Organizer dashboards and premium event branding',
    mode: 'dark',
    vars: MIDNIGHT_BRASS_VARS,
  },
  ...COMMUNITY_THEME_PRESETS,
  {
    id: 'lifted-ink',
    name: 'Lifted Ink',
    tagline: 'Warm dark with soft cream text',
    bestFor: 'Late-night compare and dancecard work',
    mode: 'dark',
    vars: {
      '--dc-surface': '#1a1816',
      '--dc-surface-muted': '#252220',
      '--dc-elevated': 'rgba(46, 43, 40, 0.94)',
      '--dc-elevated-solid': '#2e2b28',
      '--dc-elevated-muted': 'rgba(255, 255, 255, 0.08)',
      '--dc-text': '#faf8f5',
      '--dc-text-muted': '#d1c9bf',
      '--dc-text-subtle': '#e8d5a8',
      '--dc-muted': '#d1c9bf',
      '--dc-accent': '#e8d5a8',
      '--dc-accent-hover': '#f5ecd4',
      '--dc-accent-muted': 'rgba(232, 213, 168, 0.14)',
      '--dc-accent-border': 'rgba(232, 213, 168, 0.45)',
      '--dc-accent-foreground': '#1a1510',
      '--dc-border-subtle': 'rgba(232, 213, 168, 0.28)',
      '--dc-border-strong': 'rgba(232, 213, 168, 0.4)',
      '--dc-danger': '#fca5a5',
      '--dc-danger-muted': 'rgba(252, 165, 165, 0.12)',
      '--dc-danger-border': 'rgba(252, 165, 165, 0.35)',
      '--dc-success': '#9cb88a',
      '--dc-success-muted': 'rgba(156, 184, 138, 0.15)',
      '--dc-warning': '#fcd34d',
      '--dc-warning-muted': 'rgba(252, 211, 77, 0.12)',
      '--dc-slot-published': '#e8d5a8',
      '--dc-slot-accent-mix': '28%',
      '--dc-shadow-soft': '0 12px 32px rgba(0, 0, 0, 0.4)',
      '--dc-shadow-panel': '0 20px 48px rgba(0, 0, 0, 0.5)',
      '--dc-compare-mutual': '#9cb88a',
      '--dc-compare-busy': '#e8a4a4',
      '--dc-compare-busy-ring': 'rgba(232, 164, 164, 0.45)',
      '--dc-compare-host-only': '#4a6fa5',
      '--dc-compare-host-only-ring': 'rgba(74, 111, 165, 0.5)',
      '--dc-compare-outside': '#4a4540',
      '--dc-compare-selected': 'rgba(232, 213, 168, 0.28)',
      '--ecke-link': '#e8d5a8',
      '--ecke-link-visited': '#f5ecd4',
      '--ecke-focus': '#e8d5a8',
      '--ecke-focus-ring': 'rgba(232, 213, 168, 0.35)',
      '--dc-avail-open-bg': 'rgba(156, 184, 138, 0.12)',
      '--dc-avail-open-border': 'rgba(156, 184, 138, 0.35)',
      '--dc-avail-open-text': '#9cb88a',
      '--dc-avail-busy-bg': 'rgba(232, 164, 164, 0.12)',
      '--dc-avail-busy-border': 'rgba(232, 164, 164, 0.4)',
      '--dc-avail-busy-text': '#e8a4a4',
      '--dc-avail-claimed-bg': 'rgba(232, 213, 168, 0.12)',
      '--dc-avail-claimed-border': 'rgba(232, 213, 168, 0.4)',
      '--dc-avail-claimed-text': '#e8d5a8',
      '--dc-glass-shadow': '0 18px 54px rgba(0, 0, 0, 0.4)',
      '--dc-glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      '--dc-tab-shell-shadow': 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 14px 36px rgba(0, 0, 0, 0.32)',
      '--dc-tab-inactive-bg': 'rgba(255, 255, 255, 0.06)',
      '--dc-tab-inactive-hover-bg': 'rgba(255, 255, 255, 0.1)',
      '--dc-tab-active-shadow': '0 10px 28px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      '--dc-chip-bg': 'var(--dc-elevated-muted)',
      '--dc-chip-hover-bg': 'var(--dc-accent-muted)',
    },
  },
  {
    id: 'coastal-slate',
    name: 'Coastal Slate',
    tagline: 'Cool light for long console sessions',
    bestFor: 'Organizer grids, data-heavy work',
    mode: 'light',
    vars: {
      '--dc-surface': '#f2f4f6',
      '--dc-surface-muted': '#e4e8ec',
      '--dc-elevated': 'rgba(255, 255, 255, 0.96)',
      '--dc-elevated-solid': '#ffffff',
      '--dc-elevated-muted': 'rgba(228, 232, 236, 0.8)',
      '--dc-text': '#0f172a',
      '--dc-text-muted': '#475569',
      '--dc-text-subtle': '#64748b',
      '--dc-muted': '#475569',
      '--dc-accent': '#b8860b',
      '--dc-accent-hover': '#996f09',
      '--dc-accent-muted': '#fef3c7',
      '--dc-accent-border': '#b8860b',
      '--dc-accent-foreground': '#0f172a',
      '--dc-border-subtle': '#94a3b8',
      '--dc-border-strong': '#64748b',
      '--dc-danger': '#dc2626',
      '--dc-danger-muted': 'rgba(220, 38, 38, 0.1)',
      '--dc-danger-border': 'rgba(220, 38, 38, 0.35)',
      '--dc-success': '#047857',
      '--dc-success-muted': 'rgba(4, 120, 87, 0.12)',
      '--dc-warning': '#d97706',
      '--dc-warning-muted': 'rgba(217, 119, 6, 0.12)',
      '--dc-slot-published': '#b8860b',
      '--dc-slot-accent-mix': '18%',
      '--dc-shadow-soft': '0 12px 32px rgba(15, 23, 42, 0.08)',
      '--dc-shadow-panel': '0 20px 48px rgba(15, 23, 42, 0.12)',
      '--dc-compare-mutual': '#047857',
      '--dc-compare-busy': '#dc2626',
      '--dc-compare-busy-ring': 'rgba(220, 38, 38, 0.45)',
      '--dc-compare-host-only': '#2563eb',
      '--dc-compare-host-only-ring': 'rgba(37, 99, 235, 0.45)',
      '--dc-compare-outside': '#cbd5e1',
      '--dc-compare-selected': 'rgba(184, 134, 11, 0.25)',
      '--ecke-link': '#b8860b',
      '--ecke-link-visited': '#996f09',
      '--ecke-focus': '#b8860b',
      '--ecke-focus-ring': 'rgba(184, 134, 11, 0.35)',
      '--dc-avail-open-bg': 'rgba(4, 120, 87, 0.12)',
      '--dc-avail-open-border': 'rgba(4, 120, 87, 0.35)',
      '--dc-avail-open-text': '#047857',
      '--dc-avail-busy-bg': 'rgba(220, 38, 38, 0.1)',
      '--dc-avail-busy-border': 'rgba(220, 38, 38, 0.35)',
      '--dc-avail-busy-text': '#b91c1c',
      '--dc-avail-claimed-bg': 'rgba(184, 134, 11, 0.12)',
      '--dc-avail-claimed-border': 'rgba(184, 134, 11, 0.4)',
      '--dc-avail-claimed-text': '#92400e',
      '--dc-glass-shadow': '0 18px 54px rgba(15, 23, 42, 0.1)',
      '--dc-glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
      '--dc-tab-shell-shadow': 'inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 14px 36px rgba(15, 23, 42, 0.06)',
      '--dc-tab-inactive-bg': 'rgba(255, 255, 255, 0.85)',
      '--dc-tab-inactive-hover-bg': '#ffffff',
      '--dc-tab-active-shadow': '0 10px 28px rgba(184, 134, 11, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
      '--dc-chip-bg': 'rgba(255, 255, 255, 0.55)',
      '--dc-chip-hover-bg': 'var(--dc-accent-muted)',
    },
  },
  {
    id: 'high-noon',
    name: 'High Noon',
    tagline: 'Maximum contrast for bright sun',
    bestFor: 'Gate staff, hallway mode outdoors',
    mode: 'light',
    vars: {
      '--dc-surface': '#fafaf8',
      '--dc-surface-muted': '#f0f0ee',
      '--dc-elevated': '#ffffff',
      '--dc-elevated-solid': '#ffffff',
      '--dc-elevated-muted': '#f5f5f3',
      '--dc-text': '#111111',
      '--dc-text-muted': '#444444',
      '--dc-text-subtle': '#666666',
      '--dc-muted': '#444444',
      '--dc-accent': '#b45309',
      '--dc-accent-hover': '#92400e',
      '--dc-accent-muted': '#ffedd5',
      '--dc-accent-border': '#c2410c',
      '--dc-accent-foreground': '#ffffff',
      '--dc-border-subtle': '#999999',
      '--dc-border-strong': '#666666',
      '--dc-danger': '#b91c1c',
      '--dc-danger-muted': 'rgba(185, 28, 28, 0.1)',
      '--dc-danger-border': 'rgba(185, 28, 28, 0.35)',
      '--dc-success': '#15803d',
      '--dc-success-muted': 'rgba(21, 128, 61, 0.12)',
      '--dc-warning': '#a16207',
      '--dc-warning-muted': 'rgba(161, 98, 7, 0.12)',
      '--dc-slot-published': '#b45309',
      '--dc-slot-accent-mix': '18%',
      '--dc-shadow-soft': '0 8px 24px rgba(0, 0, 0, 0.08)',
      '--dc-shadow-panel': '0 16px 40px rgba(0, 0, 0, 0.1)',
      '--dc-compare-mutual': '#15803d',
      '--dc-compare-busy': '#b91c1c',
      '--dc-compare-busy-ring': 'rgba(185, 28, 28, 0.45)',
      '--dc-compare-host-only': '#1e40af',
      '--dc-compare-host-only-ring': 'rgba(30, 64, 175, 0.45)',
      '--dc-compare-outside': '#d4d4d4',
      '--dc-compare-selected': 'rgba(180, 83, 9, 0.28)',
      '--ecke-link': '#b45309',
      '--ecke-link-visited': '#92400e',
      '--ecke-focus': '#c2410c',
      '--ecke-focus-ring': 'rgba(180, 83, 9, 0.35)',
      '--dc-avail-open-bg': 'rgba(21, 128, 61, 0.12)',
      '--dc-avail-open-border': 'rgba(21, 128, 61, 0.4)',
      '--dc-avail-open-text': '#15803d',
      '--dc-avail-busy-bg': 'rgba(185, 28, 28, 0.1)',
      '--dc-avail-busy-border': 'rgba(185, 28, 28, 0.4)',
      '--dc-avail-busy-text': '#991b1b',
      '--dc-avail-claimed-bg': 'rgba(180, 83, 9, 0.12)',
      '--dc-avail-claimed-border': 'rgba(180, 83, 9, 0.45)',
      '--dc-avail-claimed-text': '#92400e',
      '--dc-glass-shadow': '0 16px 40px rgba(0, 0, 0, 0.1)',
      '--dc-glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.55)',
      '--dc-tab-shell-shadow': 'inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 14px 36px rgba(0, 0, 0, 0.06)',
      '--dc-tab-inactive-bg': 'rgba(255, 255, 255, 0.9)',
      '--dc-tab-inactive-hover-bg': '#ffffff',
      '--dc-tab-active-shadow': '0 10px 28px rgba(180, 83, 9, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
      '--dc-chip-bg': 'rgba(255, 255, 255, 0.6)',
      '--dc-chip-hover-bg': 'var(--dc-accent-muted)',
    },
  },
] as const

/** Sitewide default (member app, organizer embed, auth shells). */
export const DEFAULT_DANCECARD_APPEARANCE: DancecardAppearanceId = 'midnight-velvet'

/** Themes offered in member Settings (10 community palettes + legacy comfort themes). */
export const MEMBER_SITE_APPEARANCE_IDS = [
  'midnight-velvet',
  'midnight-brass',
  'midnight-teal',
  'obsidian-purple',
  'emerald-night',
  'crimson-classic',
  'steel-blue',
  'copper-dungeon',
  'sapphire-night',
  'dark-rose',
  'gunmetal-orange',
  'parchment',
  'lifted-ink',
] as const satisfies readonly DancecardAppearanceId[]

export type MemberSiteAppearanceId = (typeof MEMBER_SITE_APPEARANCE_IDS)[number]

export const MEMBER_DANCECARD_APPEARANCE_PRESETS = DANCECARD_APPEARANCE_PRESETS.filter((p) =>
  (MEMBER_SITE_APPEARANCE_IDS as readonly string[]).includes(p.id),
)

/** Curated presets for first-time onboarding (visual swatches, not the full settings list). */
export const ONBOARDING_APPEARANCE_IDS = [
  'midnight-velvet',
  'midnight-teal',
  'obsidian-purple',
  'crimson-classic',
  'steel-blue',
  'parchment',
] as const satisfies readonly DancecardAppearanceId[]

export type OnboardingAppearanceId = (typeof ONBOARDING_APPEARANCE_IDS)[number]

export const ONBOARDING_APPEARANCE_PRESETS = DANCECARD_APPEARANCE_PRESETS.filter((p) =>
  (ONBOARDING_APPEARANCE_IDS as readonly string[]).includes(p.id),
)

/** Organizer embed uses the same default as the member app. */
export const ORGANIZER_DANCECARD_APPEARANCE: DancecardAppearanceId = DEFAULT_DANCECARD_APPEARANCE

export function getAppearancePreset(id: string): DancecardAppearancePreset {
  return DANCECARD_APPEARANCE_PRESETS.find((p) => p.id === id) ?? DANCECARD_APPEARANCE_PRESETS[0]
}

export function appearanceVarsToStyle(
  vars: Record<string, string>,
  mode: 'light' | 'dark' = 'dark',
): Record<string, string> {
  return enrichAppearanceVars(vars, mode)
}

/** Apply theme tokens on `html` so body-portaled modals inherit `--dc-*` vars. */
export function applyAppearanceVarsToElement(
  el: HTMLElement,
  vars: Record<string, string>,
): () => void {
  const prev = new Map<string, string>()
  for (const [key, value] of Object.entries(vars)) {
    prev.set(key, el.style.getPropertyValue(key))
    el.style.setProperty(key, value)
  }
  return () => {
    for (const key of Object.keys(vars)) {
      const old = prev.get(key)
      if (old) el.style.setProperty(key, old)
      else el.style.removeProperty(key)
    }
  }
}
