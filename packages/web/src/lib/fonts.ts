/**
 * Kink Social typography tokens — Sora (display) + Manrope (UI/body).
 *
 * Loaded via Google Fonts in index.html (Vite app; equivalent role to next/font/google).
 * CSS variables are applied on `:root` in globals.css.
 */
export const fontBody = {
  family: "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif",
  variable: '--font-body',
  legacyVariable: '--c2k-font-ui',
} as const

export const fontDisplay = {
  family: "'Sora', 'Manrope', system-ui, sans-serif",
  variable: '--font-display',
  legacyVariable: '--c2k-font-display',
} as const

/** Tailwind: `font-sans` — feeds, forms, nav, messages, settings, moderation. */
export const fontUiClass = 'font-sans'

/** Tailwind: `font-display` — heroes, section headers, card titles, brand lockups. */
export const fontDisplayClass = 'font-display'
