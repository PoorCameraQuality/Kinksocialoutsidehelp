> Part of the **Design craft** collection shared for engineering review.
> These notes capture UI standards used on Kink.social. They are design guidance, not product runtime code.
# Phone app design masterclass (iOS + Android)

Read [reference.md](reference.md) for platform HIG/Material specifics, tab bars, sheets, thumb zones, type scales, color semantics, animation springs, lists, forms, and onboarding.

## Core rules
- **Do not** force one platform’s patterns onto the other (iOS blur/translucency vs Android tonal elevation).
- **Tabs**: 3–5 items, icon + label, per-tab stacks; 49pt / 80dp bar heights as in reference.
- **Touch**: 44×44 pt (iOS) / 48×48 dp (Android); respect safe areas and Dynamic Island/notch.
- **States**: every screen—loading (skeleton, not spinner-only), empty, content, error, partial, refreshing, offline.
- **Native feel in web tech**: spring curves, immediate tap feedback, keyboard avoidance, momentum scroll, haptics at thresholds.

## Full reference
Use `reference.md` for checklists, form keyboard types, swipe/delete patterns, and “web view in a shell” anti-patterns.

