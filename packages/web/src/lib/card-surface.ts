/**
 * Shared card surface classes (Desktop UI Sprint 1 CP6; Premium Surface Pass 1).
 * Pair with `.dc-card-polish` (shared-surfaces.css) for touch `:active`; lg+ hover/focus in desktop-surfaces.css.
 *
 * Surface ladder (see docs/UI_SURFACE_SYSTEM.md):
 *   page        → app atmosphere only (site-atmosphere.css). No important text on glow.
 *   base        → normal content cards. Opaque, readable border. → `cardSurfaceBaseClass`
 *   elevated    → hero, composer, rails, dialogs, key dashboards.  → `cardSurfaceElevatedClass`
 *   nested      → photo tiles, settings rows, media previews.      → `surfaceNestedClass`
 *   interactive → hover/focus directory + feed cards.              → `cardSurfaceInteractiveClass`
 *
 * Rule: cards must stay visibly distinct from the background. Do NOT use
 * `bg-dc-elevated/20`, `bg-dc-surface-muted/20`, `border-dc-border/20`, or
 * `border-white/[0.06]`-style near-invisible one-offs on important cards.
 */

const cardBorder = 'border-[color-mix(in_srgb,var(--dc-border-subtle)_82%,transparent)]' as const
const cardBorderStrong = 'border-[color-mix(in_srgb,var(--dc-border-strong)_70%,var(--dc-border-subtle))]' as const

export const cardSurfaceSolidClass =
  `dc-surface-lift rounded-2xl border ${cardBorder} bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]` as const

export const cardSurfacePanelClass =
  `dc-surface-lift rounded-2xl border ${cardBorder} bg-dc-elevated/[0.97] shadow-[var(--dc-shadow-soft)] backdrop-blur-md` as const

/** Feed column cards — match rail opacity; padding set per component. */
export const cardSurfaceFeedClass =
  `dc-rail-card rounded-2xl border ${cardBorder} bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]` as const

/** Activity / following feed cards in the home shell — opaque like rails. */
export const cardSurfaceFeedActivityClass =
  `!border-[color-mix(in_srgb,var(--dc-border-subtle)_80%,transparent)] !bg-dc-elevated-solid backdrop-blur-none dc-rail-card` as const

/**
 * Surface ladder · BASE — normal content cards (most page sections).
 * Opaque elevated surface with a readable border. This is the default; reach for
 * it instead of `bg-dc-elevated/40`-style washed-out one-offs.
 */
export const cardSurfaceBaseClass = cardSurfaceSolidClass

/**
 * Surface ladder · ELEVATED — profile hero, feed composer, key dashboards, dialogs.
 * Stronger depth + slightly heavier border so the surface reads as "lifted".
 */
export const cardSurfaceElevatedClass =
  `dc-surface-lift rounded-2xl border ${cardBorderStrong} bg-dc-elevated-solid shadow-[var(--dc-shadow-panel)]` as const

/**
 * Surface ladder · NESTED — photo tiles, settings rows, media previews, compact inner
 * panels living *inside* a base/elevated card. Recessed (surface-muted) so it reads as
 * a child of the card, not a floating tile on the page background.
 */
export const surfaceNestedClass = `rounded-xl border ${cardBorder} bg-dc-surface-muted` as const

/** Apply on interactive directory/discover cards — do not duplicate hover:border utilities. */
export const cardSurfaceInteractiveClass = 'dc-card-polish min-w-0' as const

/** Right-rail section cards — pair with shared RailCard component. */
export const railSurfaceCardClass =
  `dc-rail-card rounded-2xl border ${cardBorder} bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]` as const

/** Left-rail nav / filter shells (home dashboard, directory sidebars). */
export const railNavShellClass =
  `dc-rail-nav-shell rounded-2xl border ${cardBorder} bg-dc-elevated-solid p-3 shadow-[var(--dc-shadow-soft)]` as const

/** Sticky aside wrapper for directory and utility rails. */
export const railAsideClass = 'dc-rail-aside space-y-4 lg:sticky lg:top-24 lg:self-start' as const

/** Shared premium input class for forms (see FormField + premium-surfaces.css). */
export const premiumInputClass = 'dc-premium-input' as const
