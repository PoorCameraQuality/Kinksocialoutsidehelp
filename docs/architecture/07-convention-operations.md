# Convention operations (attendee + gate)

Operations that occur **during** or **after** setup — distinct from organizer program authoring.

---

## Access gate workflow

```
User opens convention slug
  → getConventionWithAccess(slug, userId?)
  → evaluates:
      - publicProgramListing?
      - convention_access_grants (paid + attending + role)
      - org moderator override
  → returns canView, canManage, isStaff, conv metadata
```

**Grant write paths:**

- Registration: `syncAccessGrantOnRegistration`
- Staff invite tokens: `convention_staff_invite_tokens` (kit)
- Manual grant APIs (organizer)

---

## Pin workflow

```
Authenticated user pins
  → convention_pins (convention_id, user_id)

Effects:
  → Weekly pinned digest email (worker `pinned-digest-sweep`, opt-out via pinnedDigestEmailWeekly)
  → Push audience for hub ANNOUNCEMENTS + CHAT (C215)
```

Pins are **not** the same as follows/connections.

---

## Hub channels (C212+)

**Routes:** `convention-hub-channels-routes.ts` under `/api/v1/conventions/:key/hub-channels/…`

**Auto-seed** (staff with `staff_ops` grant or `isStaff` on first channel list): `#general` (CHAT), `#announcements` (ANNOUNCEMENTS).

| Kind | Who can post | Realtime | Push |
|------|----------------|----------|------|
| CHAT | Anyone with `canView` | HTTP poll/refetch (no WS) | Pinned users, `pushHubChat` pref |
| ANNOUNCEMENTS | `staff_ops` grant or `isStaff` | HTTP poll/refetch (no WS) | Pinned users, `pushHubAnnouncements` pref |

**Read state:** `convention_hub_channel_reads` → `POST …/mark-read`, `GET …/unread-count` per channel.

**Fallback:** If no hub channels, UI may use org channels — prefer hub for convention-scoped comms.

---

## Gallery workflow

```
Attendee upload (multipart or URL)
  → convention_gallery_images (moderation_status: pending)
Staff PATCH …/moderation → approved
Public list filters approved only (unless moderator sees pending count)
```

---

## ISO board workflow

```
User maintains profile ISO (PUT /api/v1/me/iso)
User pins at convention (convention_iso_listings)
Board lists eligible listings (visibility + isoBoardEnabled setting)
Staff moderate remove/restore
DM entry point: folder=iso in messaging
```

---

## Dancecard workflow

```
User builds personal schedule
  → dancecard_entries (slot picks)
Share link
  → convention_dancecard_share_links (token)
Booking between users
  → dancecard_booking_requests + notifications (dancecard_* types)
```

Conflict detection ties to program slot times — `schedule_conflict_detected` in-app notification on clash (`conventions-routes.ts`).

---

## Check-in / door

Organizer door panel (`convention-organizer/door-routes.ts`):

- Search registrants
- `POST …/registrants/check-in` with early/late/override timing
- Updates `checkedInAt`, `checkedInTiming` on registrant row

Does not create new identity — only mutates participation record.

---

## Schedule consumption

| Consumer | Auth |
|----------|------|
| Public web Schedule tab | grant or public listing |
| `.ics` export | `GET …/program.ics` |
| WS subscribers | `convention:{id}:schedule` |
| ECKE Dancecard embed | Published program via bridge |

Slot mutations from organizer, attendee signup, or import publish bus events for live refresh (`publishToScope`).

---

## Operational checklist (runtime)

| Concern | System |
|---------|--------|
| “Who can see program?” | grants + settings |
| “Who gets push?” | pins + notification prefs + VAPID |
| “Who is on site?” | check-in + staff role on grant |
| “Who is in directory?” | people sync from registrants/program/shifts (BullMQ `c2k-convention-people-sync`) |

---

## Scaling notes

- Hub message fan-out: O(pinned users × subscriptions) per post — acceptable for convention scale; cap pins per user in product if needed
- Hub has no WS scope — clients refetch messages; push handles offline pinned users
- Unread counts: per-channel queries — index `(channel_id, user_id)` on reads table
- Gallery: S3 upload — size limits in route handlers
