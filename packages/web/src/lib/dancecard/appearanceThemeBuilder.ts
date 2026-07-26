/**
 * Builds full --dc-* token sets from a compact community palette (10 theme system).
 */

export type CommunityPalette = {
  background: string
  card: string
  cardHover: string
  input: string
  border: string
  primary: string
  text: string
  bodyText?: string
  mutedText?: string
}

export function buildDarkCommunityVars(p: CommunityPalette): Record<string, string> {
  const body = p.bodyText ?? '#d1d5db'
  const muted = p.mutedText ?? '#9ca3af'
  const accentMuted = hexWithAlpha(p.primary, 0.14)
  const accentBorder = hexWithAlpha(p.primary, 0.45)

  return {
    '--dc-surface': p.background,
    '--dc-surface-muted': p.cardHover,
    '--dc-surface-card': p.card,
    '--dc-elevated': hexWithAlpha(p.card, 0.94),
    '--dc-elevated-solid': p.card,
    '--dc-elevated-muted': hexWithAlpha('#ffffff', 0.08),
    '--dc-elevated-hover': p.cardHover,
    '--dc-input': p.input,
    '--dc-text': p.text,
    '--dc-text-muted': body,
    '--dc-text-subtle': p.primary,
    '--dc-muted': muted,
    '--dc-accent': p.primary,
    '--dc-accent-hover': lightenHex(p.primary, 0.12),
    '--dc-accent-muted': accentMuted,
    '--dc-accent-border': accentBorder,
    '--dc-accent-foreground': p.background,
    '--dc-border-subtle': p.border,
    '--dc-border-strong': accentBorder,
    '--dc-danger': '#f87171',
    '--dc-danger-muted': 'rgba(248, 113, 113, 0.12)',
    '--dc-danger-border': 'rgba(248, 113, 113, 0.35)',
    '--dc-success': '#6ee7b7',
    '--dc-success-muted': 'rgba(110, 231, 183, 0.12)',
    '--dc-warning': '#fbbf24',
    '--dc-warning-muted': 'rgba(251, 191, 36, 0.12)',
    '--dc-slot-published': p.primary,
    '--dc-slot-accent-mix': '28%',
    '--dc-shadow-soft': '0 1px 0 rgba(255, 255, 255, 0.05), 0 10px 36px rgba(0, 0, 0, 0.42)',
    '--dc-shadow-panel': '0 1px 0 rgba(255, 255, 255, 0.06), 0 18px 44px rgba(0, 0, 0, 0.48)',
    '--dc-compare-mutual': '#6ee7b7',
    '--dc-compare-busy': '#f87171',
    '--dc-compare-busy-ring': 'rgba(248, 113, 113, 0.45)',
    '--dc-compare-host-only': '#93c5fd',
    '--dc-compare-host-only-ring': 'rgba(147, 197, 253, 0.45)',
    '--dc-compare-outside': '#3f3f46',
    '--dc-compare-selected': hexWithAlpha(p.primary, 0.35),
    '--ecke-link': p.primary,
    '--ecke-link-visited': lightenHex(p.primary, 0.12),
    '--ecke-focus': p.primary,
    '--ecke-focus-ring': hexWithAlpha(p.primary, 0.35),
    '--dc-avail-open-bg': 'rgba(110, 231, 183, 0.1)',
    '--dc-avail-open-border': 'rgba(110, 231, 183, 0.35)',
    '--dc-avail-open-text': '#6ee7b7',
    '--dc-avail-busy-bg': 'rgba(248, 113, 113, 0.1)',
    '--dc-avail-busy-border': 'rgba(248, 113, 113, 0.35)',
    '--dc-avail-busy-text': '#fca5a5',
    '--dc-avail-claimed-bg': accentMuted,
    '--dc-avail-claimed-border': accentBorder,
    '--dc-avail-claimed-text': lightenHex(p.primary, 0.12),
    '--dc-glass-shadow': '0 18px 54px rgba(0, 0, 0, 0.42)',
    '--dc-glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    '--dc-tab-shell-shadow': 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 14px 36px rgba(0, 0, 0, 0.35)',
    '--dc-tab-inactive-bg': 'rgba(255, 255, 255, 0.06)',
    '--dc-tab-inactive-hover-bg': p.cardHover,
    '--dc-tab-active-shadow': '0 10px 28px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
    '--dc-chip-bg': 'var(--dc-elevated-muted)',
    '--dc-chip-hover-bg': 'var(--dc-accent-muted)',
    ...buildAtmosphereVars({
      mode: 'dark',
      background: p.background,
      card: p.card,
      primary: p.primary,
    }),
  }
}

/** Ambient page background tokens — paired with card `--dc-elevated-solid` for depth. */
export function buildAtmosphereVars(input: {
  mode: 'light' | 'dark'
  background: string
  card: string
  primary: string
}): Record<string, string> {
  const { mode, background, card, primary } = input

  if (mode === 'light') {
    const wash = hexWithAlpha(primary, 0.07)
    return {
      '--dc-atmosphere-vignette': hexWithAlpha('#000000', 0.05),
      '--dc-atmosphere-glow-a': hexWithAlpha(primary, 0.1),
      '--dc-atmosphere-glow-b': hexWithAlpha(primary, 0.05),
      '--dc-atmosphere-glow-c': hexWithAlpha(primary, 0.06),
      '--dc-atmosphere-gradient-top': lightenHex(background, 0.015),
      '--dc-atmosphere-gradient-mid': background,
      '--dc-atmosphere-gradient-bottom': darkenHex(background, 0.02),
      '--dc-atmosphere-orb-a': wash,
      '--dc-atmosphere-orb-b': hexWithAlpha(primary, 0.05),
      '--dc-atmosphere-orb-c': hexWithAlpha(primary, 0.04),
      '--dc-atmosphere-orb-opacity': '0.45',
    }
  }

  const top = darkenHex(background, 0.06)
  const mid = lightenHex(card, 0.04)
  return {
    '--dc-atmosphere-vignette': 'rgba(0, 0, 0, 0.38)',
    '--dc-atmosphere-glow-a': hexWithAlpha(primary, 0.18),
    '--dc-atmosphere-glow-b': hexWithAlpha(primary, 0.08),
    '--dc-atmosphere-glow-c': hexWithAlpha(primary, 0.06),
    '--dc-atmosphere-gradient-top': top,
    '--dc-atmosphere-gradient-mid': mid,
    '--dc-atmosphere-gradient-bottom': background,
    '--dc-atmosphere-orb-a': hexWithAlpha(primary, 0.18),
    '--dc-atmosphere-orb-b': hexWithAlpha(primary, 0.1),
    '--dc-atmosphere-orb-c': hexWithAlpha(primary, 0.07),
    '--dc-atmosphere-orb-opacity': '0.72',
  }
}

export function enrichAppearanceVars(
  vars: Record<string, string>,
  mode: 'light' | 'dark',
): Record<string, string> {
  const background = vars['--dc-surface'] ?? (mode === 'light' ? '#f4f0e8' : '#090a0f')
  const card = vars['--dc-elevated-solid'] ?? vars['--dc-surface-muted'] ?? '#1e1e1e'
  const primary = vars['--dc-accent'] ?? '#e6638e'
  return {
    ...vars,
    ...buildAtmosphereVars({ mode, background, card, primary }),
  }
}

function darkenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)))
  const r = clamp(parseInt(h.slice(0, 2), 16) * (1 - amount))
  const g = clamp(parseInt(h.slice(2, 4), 16) * (1 - amount))
  const b = clamp(parseInt(h.slice(4, 6), 16) * (1 - amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function lightenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)))
  const r = clamp(parseInt(h.slice(0, 2), 16) + 255 * amount)
  const g = clamp(parseInt(h.slice(2, 4), 16) + 255 * amount)
  const b = clamp(parseInt(h.slice(4, 6), 16) + 255 * amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
