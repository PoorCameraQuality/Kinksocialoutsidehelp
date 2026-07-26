# @c2k/web

Vite 6 + React 18 SPA for **Kink Social** (kink.social). React Router 7, Tailwind CSS 3. Internal codename: C2K.

## Develop

From **repo root** (recommended):

```bash
npm run dev          # web :5173 + api :3001
npm run dev:web      # web only
```

From this package:

```bash
npm run dev -w web
```

- **URL:** http://localhost:5173
- **API proxy:** `/api` → http://localhost:3001 (see `vite.config.ts`)
- **Env:** Vite loads from repo root `.env.development` (`envDir` in vite config)

If the browser shows **connection refused on :5173**, the dev server is not running — start `npm run dev` from the monorepo root.

## Build & check

```bash
npm run build -w web
npm run typecheck -w web
npm run lint -w web
```

## Key paths

| Path | Purpose |
|------|---------|
| `src/router.tsx` | All routes — add new pages here |
| `src/config/site.config.ts` | Nav, footer, site name |
| `src/app/` | Page components (file-based routes) |
| `src/components/dancecard/organizer/` | Event Systems convention manager (kit parity) |
| `src/components/organizer/` | Organizer console shell + panels |
| `src/lib/dancecard/` | Organizer API client + cache invalidation |

## Demo vs API-backed UI

| Variable | Effect |
|----------|--------|
| `VITE_HOME_DEMO_FALLBACK` unset / `false` | **Production default.** Signed-in home/events use API only — empty lists stay empty while loading |
| `VITE_HOME_DEMO_FALLBACK=true` | Mock catalogs for local layout review (guests only on home; events RSVPs still mock only when env is set) |
| `VITE_LEGAL_PUBLISHED=true` | Hides draft banner on privacy, terms, and guidelines pages; shows effective dates |

## Door kiosk (organizer)

Route: `/organizer/orgs/:orgSlug/conventions/:convSlug/door` — rendered **outside** `RootLayout` (no site header/footer). Add `?kiosk=1` to hide the exit link for a full-viewport check-in surface.

On load, `registerDoorServiceWorker()` registers `public/sw-door-kiosk.js`, which caches successful `GET /api/v1/conventions/:slug/door/roster` responses. After the first online load, roster lookup and check-in can fall back to the cached roster when the network is unavailable.

## Production checklist

- Set `VITE_HOME_DEMO_FALLBACK` unset or `false`
- Set `VITE_LEGAL_PUBLISHED=true` after counsel approves legal copy
- Ensure `public/og-default.png` and `public/sw-door-kiosk.js` ship with the build (PWA + door kiosk)

## Docs

- Monorepo: [`../../README.md`](../../README.md)
- Routes & features: [`../../docs/FEATURE_REGISTRY.md`](../../docs/FEATURE_REGISTRY.md)
- Organizer console: [`../../docs/ORGANIZER_CONSOLE.md`](../../docs/ORGANIZER_CONSOLE.md)
- Local demo URLs: [`../../docs/LOCALHOST_DEMO_LINKS.md`](../../docs/LOCALHOST_DEMO_LINKS.md)
