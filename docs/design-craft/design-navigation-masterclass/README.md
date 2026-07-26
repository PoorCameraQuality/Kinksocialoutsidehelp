> Part of the **Design craft** collection shared for engineering review.
> These notes capture UI standards used on Kink.social. They are design guidance, not product runtime code.
# Navigation components masterclass

Read [reference.md](reference.md) for full patterns, semantic HTML, keyboard behavior, responsive rules, animation timing, and anti-patterns.

## Core rules
- **Structure**: brand (home) → primary links (few, clear) → actions (search, CTA, account). Unique `aria-label` on every `<nav>`.
- **Mobile**: hamburger is not enough—provide focus trap, escape to close, visible focus, and a touch alternative to hover-only menus.
- **Keyboard**: predictable Tab order; arrow keys in menus where applicable; Escape closes overlays.
- **Multiple nav regions**: label each (`Primary`, `Footer`, `Breadcrumb`, etc.).

## Full reference
Open `reference.md` for section-by-section specs (mega menu, dropdown, command palette, skip link, pagination, footer columns) and the accessibility rules that apply to all navigation.

