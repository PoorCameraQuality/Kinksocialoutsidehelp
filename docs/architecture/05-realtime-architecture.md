# Realtime architecture

Realtime today is **in-process pub/sub** on the API server, exposed via **WebSocket**. It is not a separate realtime service. Optional **Redis pub/sub** (`C2K_REALTIME_REDIS_BRIDGE`) fans publishes across API replicas.

**Subscribe contract (authoritative):** [10-websocket-scopes.md](./10-websocket-scopes.md) — scopes, auth, `eventType` tables.

**Multi-replica / staging:** [REALTIME_SCALING.md](../REALTIME_SCALING.md) — Redis bridge env, symptoms, smokes.

---

## Components

| Piece | File | Role |
|-------|------|------|
| **Bus** | `lib/realtime-bus.ts` | `Map<scope, Set<listener>>` |
| **Local fan-out** | `publishLocalToScope(scope, eventType, payload)` | Synchronous fan-out to listeners on **this** process |
| **Publish** | `publishToScope(scope, eventType, payload)` | Local fan-out + optional Redis `publishRemote` |
| **Redis bridge** | `lib/realtime-redis-bridge.ts` | When `C2K_REALTIME_REDIS_BRIDGE=true`, subscribes to `c2k:ws:{scope}` and calls `publishLocalToScope` on inbound messages |
| **WS endpoint** | `server.ts` `GET /api/ws` | Client subscribe/unsubscribe; `initRealtimeRedisBridge` at API startup |
| **Auth** | `lib/ws-subscribe-auth.ts` | Scope must match REST rules |

---

## Client protocol

See [10-websocket-scopes.md](./10-websocket-scopes.md) for connect/subscribe messages, auth parity rules, and outbound `eventType` vocabulary. This doc covers bus/publish only.

---

## Publishers (who calls `publishToScope`)

| Scope pattern | eventType examples | Source |
|---------------|-------------------|--------|
| `convention:{uuid}:schedule` | `schedule_slot_created`, `updated`, `deleted`, `schedule_import_publish`, `schedule_slot_signup`, `schedule_staff_updated`, `schedule_slot_promoted` | `conventions-routes.ts`, `lib/convention-organizer/scheduleImportPublish.ts` |
| `org:{uuid}:channel:{uuid}` | `org_channel_message_created`, `org_channel_message_reply_created`, `org_channel_message_reaction_added`, `org_channel_message_reaction_removed` | `organizations.ts` |
| `org:{uuid}:announcements` | `org_announcement_created` | `organizations.ts` (broadcast posts) |

**Not published today:** convention hub chat (`convention_hub_channels` in `convention-hub-channels-routes.ts`) — no `publishToScope` call; clients poll/refetch on action; **web push** covers offline pinned users. See [10-websocket-scopes.md](./10-websocket-scopes.md) § scopes NOT implemented.

---

## Authorization parity

`authorizeWebSocketSubscribe` duplicates logic from:

- `isPublicProgramListing` + grants + org mod — for schedule
- Org membership + `chatEnabled` — for channel/announcements

**Gap risk:** If REST adds a new visibility rule, WS must update in lockstep.

---

## Multi-replica scaling

In-process bus alone does not fan out across API replicas. **`publishToScope`** already calls the Redis bridge when `C2K_REALTIME_REDIS_BRIDGE=true` (requires `REDIS_URL`). Mitigations: sticky sessions (short-term) or enable the bridge (recommended). Full diagram, env flags, and operator checklist → **[REALTIME_SCALING.md](../REALTIME_SCALING.md)**.

---

## LiveKit (voice — parallel path)

Org channels with kind `VOICE` use `livekit-voice-routes.ts` → room token.

- Not routed through `realtime-bus`
- Requires `LIVEKIT_*` env on API
- Client: `livekit-client` in web package

---

## PWA schedule cache

`public/sw-program.js` — caches schedule GET responses (best-effort offline). Independent of WS bus.

---

## Federation

External consumers should **not** connect to internal scopes without a gateway that:

1. Maps foreign tenant IDs → C2K UUIDs
2. Re-issues subscribe auth
3. Optionally translates `eventType` vocabulary

Stable contract: scope string + eventType + payload keys documented in [10-websocket-scopes.md](./10-websocket-scopes.md).
