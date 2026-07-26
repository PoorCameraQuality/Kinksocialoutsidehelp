/**
 * Authenticated desktop shell contract (Desktop UI Sprint 1, CP3).
 *
 * Breakpoint policy:
 * - Below lg (<1024px): mobile/tablet layouts unchanged; outer max-width is inert on narrow viewports.
 * - lg+ (1024px+): unified shell-wide chrome; inner grids stay proportional inside the shell.
 *
 * Reference layout: 1440px (shell-feed). Ultra-wide cap: 1920px (shell-wide).
 */
export const SHELL_GUTTER = 'px-4 sm:px-6 lg:px-8' as const

/** Width cap only — use when an outer wrapper already owns gutters (e.g. AppShell). */
export const shellOuterClass =
  'mx-auto w-full min-w-0 max-w-7xl lg:max-w-shell-wide overflow-x-hidden' as const

/** Header chrome and standalone page shells — 1920 cap at lg+. */
export const shellWideClass = `${shellOuterClass} ${SHELL_GUTTER}` as const

/**
 * Header inner wrapper — must not clip absolutely positioned menus/drawers below the bar.
 * (`overflow-x-hidden` on shellWideClass computes overflow-y to auto and clips dropdowns.)
 */
export const shellHeaderClass =
  `mx-auto w-full min-w-0 max-w-7xl lg:max-w-shell-wide overflow-visible ${SHELL_GUTTER}` as const

/** Feed and 2-col utility pages — 1440 reference at lg+; full width below lg. */
export const shellFeedClass = `mx-auto w-full min-w-0 max-w-7xl lg:max-w-shell-feed ${SHELL_GUTTER}` as const

/**
 * 3-column Home feed — wider 1600 reference at lg+ so the center column reads as
 * dominant instead of a narrow strip floating in empty side gutters on large monitors.
 */
export const shellFeedWideClass = `mx-auto w-full min-w-0 max-w-7xl lg:max-w-shell-feed-wide ${SHELL_GUTTER}` as const

/** Directory / 3-col discover — fills shell-wide parent; no nested max-width island. */
export const shellDirectoryClass = `w-full min-w-0 overflow-x-hidden ${SHELL_GUTTER}` as const
