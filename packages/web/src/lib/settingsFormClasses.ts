/** Shared form control classes for Settings panels — aligned with premium-surfaces.css */
import { premiumInputClass } from '@/lib/card-surface'

export const settingsInputClass = `${premiumInputClass} min-h-11 text-sm` as const

export const settingsSelectClass = `${premiumInputClass} min-h-11 appearance-auto pr-8 text-sm` as const

export const settingsCheckboxClass =
  'h-4 w-4 shrink-0 rounded border border-dc-border-strong/80 bg-dc-input text-dc-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dc-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-dc-surface' as const

export const settingsLabelClass = 'mb-1.5 block text-sm font-medium tracking-tight text-dc-text' as const

export const settingsHintClass = 'mb-1.5 text-dc-micro leading-snug text-dc-text-muted' as const
