# Patch notes — 27 Jul through 1 Aug 2026

Public alpha notes for what landed on kink.social / Dancecard in the last five days. Written for people reading this review repo, not as marketing copy.

## Highlights

- **Play Spaces / Dancecard** got real entry points on the main site and a fuller event hub.
- **ISO (In Search Of)** moved from a freeform note to a structured scene menu, with a shareable card that actually looks like a menu.
- **Phone photo uploads** stop dying on large camera files (client compresses before upload).
- Several **Dancecard vs apex host** routing bugs that bounced people off dancecard.kink.social are fixed.

---

## 27–30 Jul — Dancecard on the main site

### Play Spaces entry

- Main-site paths into Play Spaces / Dancecard so people can find event hubs without guessing URLs.
- Dancecard appearance / theme work so the product surface feels distinct from the social feed.

### Host routing

- Leaving Dancecard for community routes (feed, etc.) no longer traps you on the wrong host or forces the wine theme onto the main feed.
- Busy-block titles on “My availability” get a sensible default when left empty.
- Program-session forms keep a stable form ref across await boundaries (stop losing the form mid-submit).

---

## 31 Jul — Structured ISO builder

ISO is no longer “paste a paragraph and hope.”

- Structured **iso_v2** model: roles, approach, capacity, play intent, seeking-who, into / curious / hard nos, scene pitches, venues, gear, risk notes, social offers.
- Editor UI for building a **scene menu** (pitches with intensity / role / sex framing / tags).
- Board listing uses structured readiness, not only freeform body text.
- Convention / Play Space ISO board can filter and present scene ideas more usefully.

---

## 1 Aug — Dancecard hub + ISO share card + media

### Play Space Dancecard hub

- Overhaul of Play Space hub surfaces (plan, reservations, share free time, ISO board panel wiring).
- Guest “see the whole weekend” share path fixed (React hooks ordering crash).
- Sticky save / quiz footers sit above the mobile bottom nav instead of under it.

### ISO board → full card (in-app)

- **View full ISO** opens an in-app sheet on Dancecard instead of bouncing to the apex profile and dropping the subdomain.
- Profile ISO paths with `?tab=ISO` are stay-paths on dancecard.kink.social when appropriate.
- Offline SW cache bump so clients pick up the new navigation behavior.

### ISO share / export card (PNG + OG)

Shareable **1200×630** card redesigned as a Black Velvet “scene menu,” not a flattened bio line:

- Featured scene, play menu, approach/capacity/intent in plain language, curious / hard no / venues, social offers.
- Hard nos override conflicting Into tags on the card only (saved ISO unchanged).
- Dancecard + kink.social branding in the footer (transparent wordmarks; Alpine fonts installed so text isn’t tofu boxes).
- Optional **Discord** handle on the ISO (editor + card + full ISO view) for off-platform contact.
- Cache rules: public cards may cache; owner/member-only full exports use `private, no-store`.
- Caddy: `/share/*` routed to the API on **dancecard.** as well as the apex host.
- Structured-only ISOs (empty freeform body) no longer 404 share/PNG endpoints.

### Media / uploads

- Client-side image compression before profile / media upload (~2048px JPEG) so 10–20 MB phone photos succeed.
- Shared max image upload size raised to **20 MB** to match real camera files after compression path.

### Profile / studio (in progress in this tree)

- Profile photo / studio panel work continues (gallery, primary photo helpers, edit overview / photos / presence panels). Treat as alpha — review the code, expect rough edges in the UI.

---

## Ops / infra (relevant to reviewers)

- API Docker image installs **fontconfig + DejaVu** so Sharp/SVG card text renders in production.
- Prod Caddy: dancecard host proxies `/api/*` and `/share/*` to the API.

Private VPS deploy scripts, Cursor agent files, and one-off probe tools are **not** in this repo on purpose.

---

## Known follow-ups

- Discord only appears on the share card after the member saves a handle in Edit ISO.
- Very long Into lists still truncate on the card (`+N more`); full list stays in the in-app ISO.
- Seed demo images remain thin in this review export; broken seed URLs locally are expected.

---

## How to verify locally

```bash
npm install
docker compose -f docker-compose.dev.yml up -d
npm run db:prepare
npm run dev
```

Unit tests around the share card live next to the code under `packages/api/src/lib/iso-share-card-*.test.ts` and `iso-card-image.test.ts`.
