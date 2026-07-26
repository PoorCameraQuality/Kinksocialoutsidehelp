# WebSocket scopes

**Endpoint:** `GET /api/ws` (upgrade)  
**Auth:** Session cookie on handshake (same as REST)  
**Implementation:** `packages/api/src/lib/ws-subscribe-auth.ts`, handler in `server.ts`

---

## Subscribe message

```json
{ "type": "subscribe", "scope": "<scope-string>" }
```

Server:

1. `authorizeWebSocketSubscribe(req, scope)` — async DB checks (`USE_DATABASE=true` required; otherwise all scopes denied)
2. On success: register listener on `subscribeToScope(scope, …)`
3. Reply `{ "type": "subscribed", "scope": "…" }`
4. On failure: `{ "type": "error", "code": "forbidden", "scope": "…" }`
5. On authorize exception: `{ "type": "error", "code": "authorize_failed", "scope": "…" }`

**Unsubscribe:** `{ "type": "unsubscribe", "scope" }` — removes the listener for that scope only; replies `{ "type": "unsubscribed", "scope", "removed" }`.

**Ping:** `ping` or `{"type":"ping"}` → `{ "type": "pong" }`

---

## Authorized scope patterns

Scope strings are matched with strict UUID regex (`ws-subscribe-auth.ts`).

### `convention:{conventionUuid}:schedule`

**Who may subscribe:**

- Anyone if `settings.publicProgramListing` is true (`isPublicProgramListing`), OR
- User with `convention_access_grants` where `paidConfirmed` **and** `attendingConfirmed`, OR
- Grant role `STAFF` / `MODERATOR`, or `staffPreAccess`, OR
- Org member with role ≥ `MODERATOR` on owning org

**Logic:** `conventionScheduleAllowed()` in `ws-subscribe-auth.ts`

**Events published (`eventType`):**

| eventType | When |
|-----------|------|
| `schedule_slot_created` | New slot |
| `schedule_slot_updated` | Patch slot |
| `schedule_slot_deleted` | Delete slot |
| `schedule_import_publish` | Bulk import / publish (`scheduleImportPublish.ts`) |
| `schedule_slot_signup` | Attendee signup on slot |
| `schedule_slot_promoted` | Presenter promote |
| `schedule_staff_updated` | Staff assignment change |

**Payload:** Minimal IDs (`slotId`, `dutyId`, counts) — clients refetch schedule API.

---

### `org:{orgUuid}:channel:{channelUuid}`

**Who may subscribe:**

- Signed-in org **member**
- Org `feature_flags.chatEnabled`
- Channel belongs to org
- User **not** `scope_banned` on the org (`isUserScopeBanned('organization', orgId, userId)`)

**Events:**

| eventType | When |
|-----------|------|
| `org_channel_message_created` | New message |
| `org_channel_message_reply_created` | Thread reply |
| `org_channel_message_reaction_added` | Reaction |
| `org_channel_message_reaction_removed` | Reaction removed |

---

### `org:{orgUuid}:announcements`

**Who may subscribe:**

- Signed-in org member + `chatEnabled`
- User **not** `scope_banned` on the org

**Events:**

| eventType | When |
|-----------|------|
| `org_announcement_created` | Org-wide announcement post |

---

## Event frame shape

```json
{
  "type": "event",
  "scope": "convention:…:schedule",
  "eventType": "schedule_slot_updated",
  "payload": { "slotId": "…" }
}
```

---

## Scopes NOT implemented

| Desired scope | Status |
|---------------|--------|
| `convention:{id}:hub:{channelId}` | Hub chat uses HTTP poll + push, not WS |
| `user:{id}:notifications` | In-app notifications are pull API |
| Federation fan-out | N/A |

---

## Client implementation notes

- File: org chat components subscribe after loading channel id
- Convention schedule: program views subscribe when convention id known
- Send `ping` periodically if behind proxies (optional)

---

## Security checklist

- [x] Scope regex only allows UUID segments
- [x] No subscribe without session for org scopes
- [x] Org scopes deny `scope_bans` (same as REST chat)
- [x] Public program does not leak draft slot content in REST (WS only signals refresh)
- [x] Multi-tenant: convention must belong to org before mod override

---

## Multi-instance deployment

Subscribers only receive events published on **their API instance**. See [05-realtime-architecture.md](./05-realtime-architecture.md) — Redis bridge required.
