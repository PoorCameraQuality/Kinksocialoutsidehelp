/** Stable accent color for track labels (Morgen-style category signal, tokenized). */

const STRIPES = [
  'bg-dc-accent',
  'bg-amber-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-sky-500',
] as const

function trackAccentIndex(track: string | null | undefined): number {
  const t = track?.trim()
  if (!t) return -1
  let h = 0
  for (let i = 0; i < t.length; i++) {
    h = (h * 31 + t.charCodeAt(i)) | 0
  }
  return Math.abs(h) % STRIPES.length
}

/** Left spine / strong accent (legacy callers). */
export function trackStripeClass(track: string | null | undefined): string {
  const i = trackAccentIndex(track)
  if (i < 0) return 'bg-white/25'
  return STRIPES[i]!
}

/**
 * Soft full-card wash keyed by track (same stable hash as {@link trackStripeClass}).
 * Use as a low-opacity overlay on top of elevated panels - not both a loud spine and a heavy tint.
 */
export function trackTintWashClass(track: string | null | undefined): string {
  const i = trackAccentIndex(track)
  if (i < 0) return 'bg-white/20'
  return STRIPES[i]!
}
