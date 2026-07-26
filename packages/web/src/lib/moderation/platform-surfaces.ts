import {
  cardSurfaceFeedClass,
  cardSurfaceInteractiveClass,
  cardSurfaceSolidClass,
  railNavShellClass,
} from '@/lib/card-surface'

/** Primary panel — matches home feed / rail cards (opaque, theme tokens). */
export const platformModPanelClass = `${cardSurfaceFeedClass} p-5 sm:p-6`

/** Shell hero header. */
export const platformModShellHeaderClass = `${cardSurfaceSolidClass} p-5 sm:p-6`

/** Desktop sidebar nav shell. */
export const platformModNavShellClass = `${railNavShellClass} space-y-1 p-2`

/** Summary metric tile. */
export const platformModMetricClass =
  'rounded-xl border border-dc-border/80 bg-dc-elevated-solid px-3 py-3 shadow-[var(--dc-shadow-soft)] sm:px-4 sm:py-4'

/** Clickable list row inside a panel. */
export const platformModRowClass = [
  'rounded-xl border border-dc-border/80 bg-dc-elevated-solid px-4 py-3 shadow-[var(--dc-shadow-soft)]',
  'transition-colors hover:bg-dc-surface-muted hover:border-dc-border-strong',
  cardSurfaceInteractiveClass,
].join(' ')

/** Nested inset block (empty states, skeleton blocks). */
export const platformModInsetClass =
  'rounded-xl border border-dc-border/80 bg-dc-surface-muted px-4 py-3 shadow-[var(--dc-shadow-soft)]'

/** Severity / status tile base — pair with severity accent classes. */
export const platformModSeverityTileClass = [
  'min-h-11 rounded-xl border border-dc-border/80 bg-dc-elevated-solid px-3 py-3 shadow-[var(--dc-shadow-soft)] sm:px-4',
  'transition-colors hover:bg-dc-surface-muted hover:border-dc-border-strong',
  cardSurfaceInteractiveClass,
].join(' ')
