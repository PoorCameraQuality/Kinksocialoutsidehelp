# ADR 005: Media section (unified link-out)

## Status

**Accepted (2026-05-30)** — Phase A MVP: directory, outbound playback, RSS metadata sync.

## Context

Kink community podcasts and YouTube channels are scattered across Apple, Spotify, YouTube, and independent sites. C2K already has:

- **Education** (`education_articles`) — long-form **written** content with optional YouTube embeds in articles.
- **Presenters** — educator identity and offerings.
- **No** payment processing or media hosting ([`C2K-STRATEGIC-GUIDANCE.md`](../C2K-STRATEGIC-GUIDANCE.md) §5).

Users want one place to **discover** shows and **leave** C2K to listen/watch on third-party platforms.

## Decision

1. **Single Media section** at `/media` and `/api/v1/media/*` for podcasts, video channels, and hybrid shows.
2. **Link-out only** — C2K stores metadata and outbound URLs, not audio/video binaries.
3. **New tables** `media_shows` and `media_show_episodes` — do not model episodes as `education_articles` or `feed_posts`.
4. **RSS sync** via BullMQ worker (`media-rss-sync`) for podcast/hybrid feeds with `rss_feed_url`; no inline fetch in HTTP handlers.
5. **Moderation** — submit → platform moderator approve before `list_in_media` + `PUBLISHED`.
6. **Phase 2 gate** — `feed_activities` for new episodes and Following integration wait until post-organizer-alpha unless explicitly overridden.

## Consequences

- Bandwidth and DMCA surface stay on third-party platforms.
- Episode freshness for podcasts depends on worker schedule (not real-time).
- YouTube channels may use manual episode rows until Phase B prefill.
- Education hub remains the home for articles; Media may cross-link but does not replace it.

## Implementation

- Schema: `packages/api/src/db/schema.ts`
- Routes: `packages/api/src/routes/media-routes.ts`
- Worker: `packages/api/src/lib/media-rss-sync.ts`, queue `c2k-media-rss`
- Web: `packages/web/src/app/media/`
