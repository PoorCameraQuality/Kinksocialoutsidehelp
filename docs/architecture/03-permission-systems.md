# Permission systems

Authorization is **layered**. A request may pass one layer and fail another.

---

## Layer 0: Transport identity

| Mechanism | Implementation |
|-----------|----------------|
| Session cookie | `SESSION_COOKIE_NAME`, signed with `AUTH_SECRET` |
| Resolution | `resolveViewerFromRequest(req)` → `payload.sub` = `users.id` |
| Failure | `401` on protected routes |

File: `packages/api/src/auth/resolve-viewer.ts`, `routes/auth.ts`.

---

## Layer 1: Platform

| Capability | Gate |
|------------|------|
| Platform moderator | `C2K_PLATFORM_MODERATOR_USER_IDS` (UUID list) |
| Email capture export | `C2K_PLATFORM_ADMIN_EMAILS` (email match on session) |
| Identity ban | `identity_bans` checked on login/register |

Files: `lib/platform-moderator.ts`, `lib/peer-reputation.ts`.

---

## Layer 2: Organization membership

`organization_members.role`: `OWNER` | `ADMIN` | `MODERATOR` | `STAFF` | `MEMBER`

| Typical capability | Min role |
|------------------|----------|
| Org settings, branding | ADMIN |
| Forums, channels, slow mode | MODERATOR |
| Member directory, volunteer tags | MODERATOR |
| Join org / RSVP | MEMBER |

Enforced per-route in `organizations.ts`, `group-forums.ts`, etc.

**Feature flags:** `organizations.feature_flags` JSON — e.g. `chatEnabled` gates org WS scopes.

---

## Layer 3: Group

`group_members` + leadership votes (`group_leadership_votes`).

- Event create/manage: `lib/group-access.ts` + organizer routes
- `viewerCanManage` on event payloads for UI

---

## Layer 4: Convention attendee access

Function: `getConventionWithAccess(slug, userId)` in `conventions-routes.ts`.

Inputs:

- `settings.publicProgramListing` — if true, schedule readable without grant
- `convention_access_grants` — `paidConfirmed`, `attendingConfirmed`, `role`, `staffPreAccess`
- Org `MODERATOR+` — manage paths

Outputs used by hub tabs: Chat view, Announcements post (staff), ISO board, gallery submit.

**Hub channel:** `ANNOUNCEMENTS` posts require staff or `canManageConvention`.

---

## Layer 5: Event Systems command bridge

Types: `@c2k/shared` → `ConventionCommandPermissions`

| Flag | Domain |
|------|--------|
| `registration` | Registrants, vetting, trusted roles, applications |
| `staffOps` | Shifts, swaps, incidents, messaging, exports (partial) |
| `scheduler` | Program, venues, import, publish slots |
| `isFullAdmin` | Org OWNER/ADMIN — all domains |
| `canManageTeam` | Grant CRUD for `convention_command_grants` |

Resolution: `resolveConventionCommandAccess(conv, userId)` in `lib/convention-command-access.ts`  
Enforcement: `requireConventionCommand(key, userId, reply, requirement)` (same file)

**Storage:** `convention_command_grants` per `(convention_id, user_id)`.

**Client:** `filterNavByPermissions`, `filterPeopleSubTabsForTemplate` — UI hides tabs; API still enforces.

---

## Layer 6: WebSocket subscribe

`authorizeWebSocketSubscribe(req, scope)` — must match REST visibility.

See [10-websocket-scopes.md](./10-websocket-scopes.md).

---

## Layer 7: Resource-level

Examples:

- DM participant check before `messages` read
- Connection must be `ACCEPTED` for some social actions
- Gallery moderation: staff/org mod on `PATCH …/gallery/:id/moderation`
- ISO board: visibility enums on listings + `isoEligibleForConventionBoard`

---

## Permission evaluation flow (organizer API)

```
Request + session cookie
  → resolveViewerFromRequest
  → requireConventionCommand(key, userId, reply, 'scheduler' | 'staff_ops' | 'registration' | …)
      → load convention by slug
      → org role OWNER/ADMIN? → full permissions
      → else load convention_command_grants
      → commandPermissionIncludes(requirement, permissions)
  → handler runs or 403
```

---

## Anti-patterns

| Bug pattern | Cause |
|-------------|-------|
| UI shows tab, API 403 | Client nav filter out of sync with new route |
| WS receives events without REST access | Missing check in `authorizeWebSocketSubscribe` |
| Orphan registrant without user | Legacy import; new POST requires `userId` |
| MODERATOR on org ≠ staff on convention | Separate grants; intentional |

---

## Federation note

External systems should receive **capabilities as claims** (e.g. `registration: true`), not raw org role strings, mapped at the federation gateway.
