# ADR 004: ECKE presentation layer for member site

## Status

Accepted (2026-05-26)

## Context

C2K had two parallel UI systems: member routes on `--c2k-*` (teal charcoal) and Dancecard/ECKE on `--dc-*` (brass panels, soft shadows). Wave 1 refactored structure without unifying visuals.

## Decision

1. Wrap the member app in `DancecardAppearanceProvider` with default **`midnight-brass`**.
2. Offer three member themes in Settings: **midnight-brass**, **parchment**, **lifted-ink**.
3. Reuse Dancecard primitives (`Panel`, skeletons, tab transitions) sitewide.
4. Add `dancecard-motion.css` for cross-fade and skeleton stagger (`prefers-reduced-motion` safe).
5. Scope lifted card chrome (border-radius + panel shadow) to **`.dc-gold-chrome--lifted`** embeds only, not full-page chrome.

Organizer embeds keep `ORGANIZER_DANCECARD_APPEARANCE` (`coastal-slate`) via nested provider with `wrapChrome={false}`.

## Consequences

- `--c2k-*` remains for legacy routes during migration; new work uses `--dc-*` / `bg-dc-*`.
- Stored theme key unchanged: `ecke-dancecard-appearance`.
- Visual parity target: [ECKE Dancecard sandbox — Program](https://www.eastcoastkinkevents.com/dancecard/sandbox#program).

## Follow-up

- Route sweep (V2-4): replace remaining `c2k-*` in pages.
- CI grep to block new `bg-c2k-` in `packages/web/src`.
