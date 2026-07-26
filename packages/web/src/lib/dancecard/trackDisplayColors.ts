import type { CSSProperties } from 'react'

function isHexColor(s: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s.trim())
}

/** Track accent tints - background is mixed from theme `--dc-elevated-solid` at runtime. */
const PROGRAM_TRACK_ACCENTS: Record<string, string> = {
  classes: '#3b82f6',
  class: '#3b82f6',
  play: '#8b5cf6',
  dungeon: '#8b5cf6',
  social: '#b8860b',
  community: '#b8860b',
  main: '#64748b',
}

const FALLBACK_ACCENTS = ['#2d8c78', '#648c32', '#be506e', '#3b82f6']

function hashLabel(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function accentForTrackName(name: string | null | undefined): string {
  const key = (name ?? '').trim().toLowerCase()
  if (key && PROGRAM_TRACK_ACCENTS[key]) return PROGRAM_TRACK_ACCENTS[key]
  if (!key) return PROGRAM_TRACK_ACCENTS.classes
  return FALLBACK_ACCENTS[hashLabel(key) % FALLBACK_ACCENTS.length]
}

/** Blend track accent into the active appearance surface (see `--dc-slot-accent-mix`). */
function themedSlotStyle(accent: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in srgb, ${accent} var(--dc-slot-accent-mix, 20%), var(--dc-elevated-solid))`,
    borderColor: accent,
    boxShadow: `inset 4px 0 0 0 ${accent}`,
  }
}

export type SlotCardVisual = {
  className: string
  style: CSSProperties
}

/** Fully opaque card chrome - grid lines must not show through; colors follow appearance tokens. */
export function slotCardVisual(args: {
  trackColorHex?: string | null
  trackName?: string | null
}): SlotCardVisual {
  const hex = args.trackColorHex?.trim()
  const accent = hex && isHexColor(hex) ? hex : accentForTrackName(args.trackName)

  return {
    className: 'border text-dc-text shadow-md isolate',
    style: themedSlotStyle(accent),
  }
}
