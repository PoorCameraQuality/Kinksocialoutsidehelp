import { z } from 'zod'

export const PROFILE_PHOTO_DISPLAY_FITS = ['cover', 'contain'] as const
export type ProfilePhotoDisplayFit = (typeof PROFILE_PHOTO_DISPLAY_FITS)[number]

export type ProfilePhotoDisplaySettings = {
  displayFit: ProfilePhotoDisplayFit
  focalX: number
  focalY: number
}

export const DEFAULT_PROFILE_PHOTO_DISPLAY: ProfilePhotoDisplaySettings = {
  displayFit: 'cover',
  focalX: 0.5,
  focalY: 0.5,
}

const displaySettingsSchema = z.object({
  displayFit: z.enum(PROFILE_PHOTO_DISPLAY_FITS),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
})

function clampFocal(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

/** Parse JSONB / API payload into safe display settings. */
export function normalizeProfilePhotoDisplaySettings(
  raw: unknown,
): ProfilePhotoDisplaySettings {
  if (raw == null) return { ...DEFAULT_PROFILE_PHOTO_DISPLAY }
  const parsed = displaySettingsSchema.safeParse(raw)
  if (!parsed.success) return { ...DEFAULT_PROFILE_PHOTO_DISPLAY }
  return {
    displayFit: parsed.data.displayFit,
    focalX: clampFocal(parsed.data.focalX, DEFAULT_PROFILE_PHOTO_DISPLAY.focalX),
    focalY: clampFocal(parsed.data.focalY, DEFAULT_PROFILE_PHOTO_DISPLAY.focalY),
  }
}

/** Inline styles for img. Use with className h-full w-full. */
export function profilePhotoImageStyle(
  settings: ProfilePhotoDisplaySettings | null | undefined,
): { objectFit: ProfilePhotoDisplayFit; objectPosition: string } {
  const s = normalizeProfilePhotoDisplaySettings(settings)
  return {
    objectFit: s.displayFit,
    objectPosition: `${Math.round(s.focalX * 100)}% ${Math.round(s.focalY * 100)}%`,
  }
}

/** Public credit line under hero / gallery. */
export function formatProfilePhotoCredit(caption: string | null | undefined): string | null {
  const text = caption?.trim()
  if (!text) return null
  if (/^photo by\b/i.test(text)) return text
  return `Photo by ${text}`
}

/** Portrait hero frame at 4:5. Matches the public profile hero. */
export const PROFILE_HERO_PHOTO_FRAME_CLASS =
  'relative h-[200px] w-[160px] overflow-hidden rounded-2xl bg-dc-surface-muted sm:h-[220px] sm:w-[176px]'
