> Part of the **Design craft** collection shared for engineering review.
> These notes capture UI standards used on Kink.social. They are design guidance, not product runtime code.
# Web design masterclass (desktop + mobile-first)

Read [reference.md](reference.md) for the full guide: breakpoints, bento/editorial layouts, 60-30-10 color, type pairing, spacing scale, animation tokens, shadows, reduced motion, and ship checklist.

## Core rules
- **Mobile-first**: design at ~360px, then add complexity at content-driven breakpoints (not device names).
- **Avoid template tropes**: three equal cards, centered-everything heroes, purple gradients on white, stock-photo heroes.
- **Touch**: minimum 44×44px targets; body text ≥16px on mobile (iOS zoom).
- **Motion**: keep UI transitions under 300ms; animate only `transform` and `opacity`; honor `prefers-reduced-motion`.
- **A11y**: WCAG AA contrast; never color-only meaning; focus visible.

## Full reference
Open `reference.md` before large layout or palette decisions—sections on layout vocabulary, palette recipes, typography scale, micro-interactions, and modern CSS (`clamp`, container queries) are the detailed source for this guide.

