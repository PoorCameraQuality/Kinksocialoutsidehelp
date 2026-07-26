> Part of the **Design craft** collection shared for engineering review.
> These notes capture UI standards used on Kink.social. They are design guidance, not product runtime code.
# Large project / complex systems design masterclass

Read [reference.md](reference.md) for full token examples (CSS variables), base component inventory, React/Next folder layout, progressive disclosure, dashboard KPIs, table anatomy, phase checklists, and multi-brand theming.

## Core rules
- **Order**: design tokens → base components → composites → pages. No hardcoded colors/spacing when tokens exist.
- **Three token layers**: primitives (raw scale) → semantic (surface, text, interactive) → component (button height, card padding).
- **Dark mode**: swap semantic tokens (often borders instead of shadows on dark surfaces).
- **Before new UI**: read existing tokens and 2–3 similar components; extend tokens instead of one-off hex values.
- **Consistency audit**: watch for color drift, arbitrary spacing, duplicate buttons, mixed radii.

## Full reference
Use `reference.md` for file/folder templates, wizard rules, table responsive strategies, and the large-project checklist.

