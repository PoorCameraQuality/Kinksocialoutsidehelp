# ADR 002: Organization realtime chat and digests

## Status

**Implemented (2026-04-06)** — core pieces shipped; horizontal scaling of realtime bus is a follow-up.

## Context

Organization chat uses REST: `GET`/`POST` on `/api/v1/organizations/:orgKey/channels/:channelId/messages`. Realtime updates use the same `publishToScope` bus as convention schedule changes.

Email “weekly org digest” requires transport, user preferences, and unsubscribe hints.

## Decision (original)

1. **Realtime org chat:** Prefer a first-party WebSocket with the same authorization rules as REST.
2. **Digests:** Compose from existing org/event activity; use `user_notification_preferences` and a worker job.

## Implementation

### WebSocket (`GET /api/ws`)

- Client sends `{ "type": "subscribe", "scope": "<scope>" }` after connect (cookie session).
- **Authorized scopes** (see `packages/api/src/lib/ws-subscribe-auth.ts`):
  - `convention:{uuid}:schedule` — allowed if program listing is public, or viewer has attendee/staff access (same rules as `GET .../slots`).
  - `org:{uuid}:channel:{uuid}` — org member, `chatEnabled`, channel exists.
  - `org:{uuid}:announcements` — org member, `chatEnabled`.
- Unknown or forbidden scopes receive `{ "type": "error", "code": "forbidden" }` and are not subscribed.

### In-process bus

- `packages/api/src/lib/realtime-bus.ts` delivers only within **one API process**. Multiple API replicas need Redis pub/sub (or equivalent) later.

### Voice (LiveKit)

- `POST /api/v1/organizations/:orgKey/channels/:channelId/voice/token` returns `{ token, url, roomName }` for channel kinds `VOICE`, `VIDEO`, `LIVE_STREAM` when `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` are set.
- Room name: `{LIVEKIT_ROOM_PREFIX}_org_{orgId}_channel_{channelId}` (prefix default `c2k`).
- Web: `OrgVoicePanel` uses `livekit-client` (minimal join / mute / leave).

### Org digest email

- Worker job `org-digest-sweep` calls `runOrgDigestSweep()` in `packages/api/src/lib/org-digest-sweep.ts`.
- Sends when `C2K_MAIL_TRANSPORT` is `smtp` or `resend`; otherwise logs eligibility only.
- `List-Unsubscribe` header points at `C2K_PUBLIC_WEB_URL/settings` (or default localhost).

## Consequences

- REST remains the source of truth for message history and moderation hooks.
- Product copy may describe near-real-time chat when the user has the org hub open and subscribed.
- Guards preserved: non-text channel kinds for **text** POST, slow mode, announcements-only posting, org chat disclaimer in UI.