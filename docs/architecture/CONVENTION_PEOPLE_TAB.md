# Convention Command Bridge — People Tab Reference

**Purpose:** Single source of truth for redesigning the People hub UI. Covers routes, components, permissions, APIs, identity rules, and known gaps.

**Route:**

```
/organizer/orgs/:orgSlug/conventions/:convSlug?tab=people&peopleTab=<subTab>
```

**Related docs:** [`06-organizer-systems.md`](./06-organizer-systems.md), [`03-permission-systems.md`](./03-permission-systems.md), [`07-convention-operations.md`](./07-convention-operations.md), [`FEATURE_REGISTRY.md`](../FEATURE_REGISTRY.md), [`DANCECARD_ORGANIZER_PARITY.md`](../DANCECARD_ORGANIZER_PARITY.md)

---

## 1. Product frame

The People tab is the **attendee + staff operations hub** for a convention — not a social “find people” surface (that lives at `/discovery`).

Organizers work here to:

| Job | Primary sub-tab |
|-----|-----------------|
| Manage registration records, check-in, import/export | **Signups** |
| See unified directory (presenters, staff, attendees) | **Roster** |
| Schedule volunteer/staff shifts | **Staff shifts** |
| Review trusted-role applications, send comp offers | **Applications** |
| Approve shift trade requests | **Shift swaps** |
| Print badges | **Badges** |
| DM/coverage windows and gap assignment | **Coverage** |
| Log safety incidents | **Incidents** |
| Track volunteer hour deficits | **Compliance** |

**Core identity rule (must stay visible in UI):**

- One **C2K user account** (`users.id`) per person.
- **Signups** = `convention_registrants` (attendance/registration records).
- **Roster** = `convention_persons` (directory row; may or may not link `user_id`).
- The same linked account can appear in both; directory is rebuilt by a **people sync job** from registrants, program slots, shifts, access grants, etc.
- **Staff shifts** store `personId` as **`users.id`**, not `convention_persons.id` — a common confusion point.

**Munch mode:** When `event.settings.eventSystems.peopleHubTemplate === 'munch'`, only **Signups** and **Roster** sub-tabs are shown (after permission filter). Full ops tabs are hidden until template is switched in Event settings.

---

## 2. Entry point & component tree

```
OrganizerConventionPageClient          (auth + org/convention resolve)
└── ConventionDancecardOrganizerClient   packages/web/src/components/organizer/convention/
    ├── GET /organizer/bootstrap         permissions, event, shifts, window, peopleHubTemplate
    ├── tab === 'people'
    └── PeopleHubPanel                   packages/web/src/components/dancecard/organizer/PeopleHubPanel.tsx
        ├── PeopleHubParticipationStrip  (viewer's own registration — optional banner)
        ├── Hub intro copy
        ├── OrganizerSectionTabs         (sub-tab switcher: mobile `<select>`, desktop tablist)
        └── [one sub-panel by peopleTab]
```

**Shell (shared with all Command Bridge tabs):**

| Piece | File |
|-------|------|
| Sidebar “People” nav | `shell/OrganizerEventSidebar.tsx` |
| Sticky header, read-only badge, wide toggle | `shell/OrganizerEventHeader.tsx` |
| Wide layout (1400px / 1600px canvas) | `ConventionDancecardOrganizerClient.tsx` — `wideLayoutForTab` includes `people` |
| Workspace hrefs | `organizerWorkspaceContext.tsx` — `organizerTabHref`, `useOrganizerTabHref` |
| API client | `organizerApi.ts` — `organizerDancecardFetch` → `/api/v1/conventions/:slug/...` |

**People hub orchestrator props** (`PeopleHubPanel.tsx`):

| Prop | Source |
|------|--------|
| `eventSlug` | Convention slug |
| `readOnly` | From parent — **always `false` on People tab** (see §5) |
| `timezone`, `windowStartsAt`, `windowEndsAt`, `hasEventWindow` | Bootstrap |
| `shifts`, `onRefreshStaff` | Bootstrap + `GET /staff-shifts` refresh |
| `permissions` | Bootstrap `permissions` |
| `peopleHubTemplate` | Bootstrap `event.peopleHubTemplate` (`'full' \| 'munch'`) |

---

## 3. URL & navigation model

### Query parameters

| Param | Constant | Purpose |
|-------|----------|---------|
| `tab=people` | — | Activates People hub |
| `peopleTab=<subTab>` | `PEOPLE_SUB_TAB_PARAM` in `organizerNavConfig.ts` | Active sub-section |
| `vettingRoleId=<uuid>` | `VETTING_ROLE_PARAM` | Filter applications queue to one trusted role |
| `applicationId=<uuid>` | `VETTING_APPLICATION_PARAM` | Pre-select one application in queue |

**Not wired today:**

| Param | Intended use | Gap |
|-------|--------------|-----|
| `person=<uuid>` | Open roster `PersonDetailDrawer` | Signups links to `?peopleTab=roster&person=…` but roster **does not read** `person` |
| `registrant=<uuid>` | Open signups detail | Not implemented as URL sync |

### Sub-tab hook

`usePeopleSubTab.ts`:

- Reads `peopleTab` from URL; falls back to first **allowed** tab if missing/invalid.
- `setPeopleTab(next)` → `router.replace(`${workspacePath}?tab=people&peopleTab=...`)`.
- Does **not** clear `vettingRoleId` / `applicationId` when switching sub-tabs.

### Legacy top-level tabs (redirected)

Old URLs still work via `ConventionDancecardOrganizerClient` legacy redirect:

| Legacy `tab=` | → `peopleTab=` |
|---------------|----------------|
| `registrants` | `signups` |
| `staff` | `staff` |
| `vetting` | `applications` |
| `swaps` | `swaps` |
| `badges` | `badges` |
| `dm` | `coverage` |

### Deep link examples

```
?tab=people&peopleTab=signups
?tab=people&peopleTab=staff
?tab=people&peopleTab=applications&vettingRoleId=<roleUuid>&applicationId=<appUuid>
?tab=people&peopleTab=coverage   # requires event window set
```

**Inbound links from other tabs:**

| Source | Target |
|--------|--------|
| Dashboard quick actions | `peopleTab=staff`, `badges`, signups |
| Live ops console | signups, coverage, incidents |
| Door mode exit | signups |
| Program → Session drawer People tab | Separate from People hub |
| Integrations → Exhibitors | **Not** People hub — `ExhibitorsOrganizerPanel` lives under Integrations |
| Setup task “Add staff shifts” | `peopleTab=staff` |

---

## 4. Sub-tabs matrix

Defined in `organizerNavConfig.ts` (`PeopleSubTab` union). Labels in `PeopleHubPanel.tsx` `TAB_LABELS`.

| `peopleTab` | UI label | Permission (`commandBridgeNavPermissions.ts`) | Panel component |
|-------------|----------|-----------------------------------------------|-----------------|
| `signups` | Product copy `copy.signups` | `registration` | `RegistrantsPanel` |
| `roster` | Staff roster (overview) | `staff_ops` | `PeopleDirectoryPanel` |
| `staff` | Staff shifts | `staff_ops` | `StaffShiftsPanel` |
| `applications` | Special roles & applications | `registration` | `VettingQueuePanel` |
| `swaps` | Shift swaps | `staff_ops` | `ShiftSwapsPanel` |
| `badges` | Badges | `staff_ops` | `BadgesPrintPanel` |
| `coverage` | Coverage & assignments | `staff_ops` | `DmCoveragePanel` |
| `incidents` | Safety incidents | `staff_ops` | `SafetyIncidentsPanel` |
| `compliance` | Volunteer compliance | `staff_ops` | `VolunteerCompliancePanel` |

**Top-level `people` sidebar item:** visible if **any** sub-tab passes permission filter (`isTabAllowed('people')`).

**Sub-tab UI control:** `OrganizerSectionTabs.tsx`

- **Mobile:** full-width `<select>` (better for overhaul: consider sticky segment control or bottom nav for ops-heavy tabs).
- **Desktop:** horizontal underline tablist.

---

## 5. Permissions & read-only behavior

### Command Bridge domains (`@c2k/shared`)

| Domain | DB flag | People relevance |
|--------|---------|------------------|
| `registration` | `can_registration` | Signups, applications, vetting |
| `staff_ops` | `can_staff_ops` | Roster, shifts, badges, coverage, incidents, compliance, swaps |
| `scheduler` | `can_scheduler` | Not a People sub-tab; needed for `/locations` read in staff/coverage panels |
| `admin` | Org OWNER/ADMIN | Category CRUD, registration form, policy docs, participation settings, command team |

`isFullAdmin` satisfies any requirement.

### Field-level helpers (`conventionCommandPermissions.ts`)

| Helper | Grants |
|--------|--------|
| `canSeeRegistrantInternalNotes` | full admin, registration, or staff_ops |
| `canEditVettingSafetyNotes` | full admin or registration |
| `canMutateInCommandBridge` | any command domain |

### Read-only shell quirk

```typescript
// commandBridgeNavPermissions.ts
readOnlyForTab('people') → always false
```

The header “Read-only” badge **never appears** on People tab. Sub-tab visibility is the primary gate; individual panels still accept `readOnly` but it is effectively unused from the parent.

**Overhaul recommendation:** Either honor real read-only for registration-only viewers on staff_ops panels, or remove dead `readOnly` props and rely on permission-filtered sub-tabs + API 403.

### API vs UI permission mismatches (footguns)

| Feature | UI sub-tab gate | API gate | Notes |
|---------|-----------------|----------|-------|
| Registration category edit | Signups visible with `registration` | **`admin`** for POST/PATCH/DELETE categories | Registration-only users can list but not mutate categories |
| Policy documents | Loaded in signups detail | **`admin`** | May fail silently for registration-only |
| Session tags on registrants | Signups | **`scheduler`** | Panel uses `.catch` → empty tags |
| Presenter requests | Program tab | Org **`canManage`** (MODERATOR+) | Not command grants — different team role |
| Exhibitors / vendor booths | Integrations tab | **`admin`** for CRUD | Vendor **applications** flow through applications/offers |
| Participation settings | Settings | **`admin`** | Applications panel reads offers, not settings |

---

## 6. Sub-panel reference (UI overhaul detail)

### 6.1 Shared strip — `PeopleHubParticipationStrip`

**File:** `PeopleHubParticipationStrip.tsx`

**API:** `GET /api/v1/conventions/:slug/me/participation` (direct `fetch`, not `organizerDancecardFetch`)

**Behavior:** Shows only when logged-in viewer has registrant/access summary. Renders nothing otherwise.

**Overhaul:** Could become a richer “your ops context” card (your shifts, your applications) for organizers who are also attendees.

---

### 6.2 Signups — `RegistrantsPanel`

**Files:**

| File | Role |
|------|------|
| `RegistrantsPanel.tsx` | Main panel (~1000 LOC) |
| `registrants/RegistrantsMasterDetail.tsx` | Responsive master/detail layout |
| `registrants/RegistrationAttendeePreview.tsx` | Attendee-facing preview (settings-adjacent) |

**Purpose:** Registration records — list, filter, check-in, import/export, per-record editing.

**Props:** `eventSlug`, `readOnly`, `permissions`

**Layout sections:**

1. Intro + link to Roster (`organizerTabHref(..., { peopleTab: 'roster' })`)
2. **Filter bar:** status, vetting, ticket type (category), search (paginated `PAGE_SIZE = 50`)
3. **Actions (hidden when readOnly):** Add signup (C2K user picker), Export CSV, Import CSV/JSON (`<details>`)
4. **Master/detail:**
   - Mobile: card list → slide-over detail with “Back to list”
   - Desktop: table + sticky detail column
5. **Detail tabs:** general, vetting, answers, payment, tags
6. **Check-in UX:** tone-coded rows (gold on-site, blue late, red early) via `registrantCheckIn.ts`
7. **Door mode link:** `useOrganizerSubPath('door')` — separate full-screen door workflow

**Registrant row shape (client `RegRow`):**

Key fields: `id`, `categoryId`, `categoryName`, `personId` (user), `directoryPersonId`, `status`, `sceneDisplayName`, `email`, `vettingStatus`, check-in fields (`checkInEligibility`, `checkInTiming`, `checkedInAt`), `internalNotes`, `vettingSafetyNotes`, external sync fields.

**Status values:** `imported`, `pending`, `confirmed`, `cancelled`, `waitlisted`, `checked_in`

**Vetting values:** `none`, `pending`, `approved`, `rejected`, `hold`

**APIs:**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/registrants` | Query: `limit`, `offset`, `q`, `status`, `categoryId` |
| GET | `/registrants/:id` | Full detail + answers |
| POST | `/registrants` | `{ userId, categoryId?, badgeName?, ... }` → triggers people sync |
| PATCH | `/registrants/:id` | Status, vetting, check-in, answers; `409 EARLY_CHECK_IN` |
| DELETE | `/registrants/:id` | |
| POST | `/registrants/import` | CSV rows |
| GET | `/registrants/export` | CSV download |
| POST | `/registrants/check-in` | Door-adjacent |
| GET | `/registration-categories` | Ticket types |
| GET | `/organizer/user-picker` | Add signup |
| GET | `/policy-documents` | Admin-only |
| GET | `/tags?scope=session` | Scheduler-only; best-effort |

**Master/detail features:**

- Column chooser + saved views in `localStorage` (`dc-registrants-views:{slug}`)
- Optional `renderPersonRosterLink` when `directoryPersonId` set — links to roster (person param not consumed)

**Empty states:**

- “No registrants match filters.”
- “Loading signups…”

**Overhaul opportunities:**

- Unified search across signups + roster (today separate)
- URL-sync selected registrant (`?registrant=`)
- Fix roster deep link (`?person=`)
- Surface check-in counts / on-site summary at hub level (Live ops duplicates partially)
- Payment tab is display-oriented — no Stripe (by design)

---

### 6.3 Roster — `PeopleDirectoryPanel` + `PersonDetailDrawer`

**Files:** `PeopleDirectoryPanel.tsx`, `PersonDetailDrawer.tsx`

**Purpose:** Unified people directory with role buckets and comp package columns; manual add for unlinked presenters/staff.

**Props (directory):** `eventSlug`, `timezone`, `readOnly`

**Layout sections:**

1. Explainer + link to Signups
2. Read-only banner when `readOnly`
3. Search (debounced 200ms → `GET /people?q=`)
4. **Role filter pills:** All, Presenters, Staff & volunteers, Photographers, Attendees, Registered
5. **Add person form** (scene name + email) — hidden when readOnly
6. **Data table:** scene, email, pronouns, roles, comp columns (`peopleCompPackages.ts`)
7. Row click → **`PersonDetailDrawer`**

**Person row (`PersonRow`):** `id`, `sceneName`, `legalName`, `email`, `phone`, `publicBio`, `internalNotes`, `pronouns`, `photoUrl`, `showLegalNameOnPublic`

**Role buckets:** from API `roleBuckets: Record<personId, PeopleRoleBucket[]>` — `presenter`, `staff`, `photographer`, `attendee`, `registered`, etc.

**APIs:**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/people` | **Triggers people sync job** on every load |
| GET | `/people/:personId` | Person + `programSlots[]` + linked `registrant?` + `compPackage?` |
| POST | `/people` | Manual directory row (no user link) |
| PATCH | `/people/:personId` | Updates profile + linked registrant when applicable |
| DELETE | `/people/:personId` | |

**PersonDetailDrawer tabs:**

| Tab | Content |
|-----|---------|
| `overview` | Scene name, email, pronouns, bio, photo |
| `sessions` | Program slots from **`schedule_slot_persons`** path (convention people on slots) |
| `registration` | Linked registrant category; can PATCH category via signups API |

**Empty states:**

- “No people match this filter…”
- “No people yet. Add presenters and staff…”
- Skeleton: `DancecardTableSkeleton`

**Overhaul opportunities:**

- Drawer as URL-synced side panel (`?person=`) like Program `?slot=`
- Cross-link to Program session drawer for each slot
- Distinguish **platform presenters** vs **convention persons on slots** in copy (same distinction as Program tab)
- Comp package columns need clearer legend for non-finance users

---

### 6.4 Staff shifts — `StaffShiftsPanel`

**File:** `StaffShiftsPanel.tsx`

**Props:** `eventSlug`, `timezone`, `shifts` (from parent bootstrap), `onRefresh`, `readOnly?`

**Purpose:** CRUD volunteer/staff shifts; filter open/unstaffed/needs_vetting.

**Layout:**

1. Filter pills
2. **Add shift form:** C2K member picker, role, location, status, datetime fields
3. **Mobile:** timeline cards (`lg:hidden`)
4. **Desktop:** grouped-by-day table

**Shift DTO:** `OrganizerStaffShiftDto` — `personId` is **`users.id`**

**APIs:**

| Method | Path |
|--------|------|
| GET/POST/PATCH/DELETE | `/staff-shifts`, `/staff-shifts/:id` |
| GET | `/locations` (scheduler read) |
| GET | `/organizer/user-picker` |

**Empty states:** “No shifts match this filter.” / “No staff shifts yet.”

**Cross-links:** Coverage panel links here when gaps need shifts.

---

### 6.5 Applications — `VettingQueuePanel`

**Files:**

| File | Role |
|------|------|
| `VettingQueuePanel.tsx` | Queue + review UI |
| `TrustedRolesPanel.tsx` | Trusted role CRUD, apply links, `roleKind` |
| `TrustedRoleWorkflowCallout.tsx` | Onboarding callout |
| `ParticipationOfferComposer.tsx` | Send comp/offer letters |
| `hooks/useApiConventionParticipation.ts` | Offer send helper |

**Props:** `eventSlug`, `permissions` (no `readOnly`)

**Purpose:** Trusted-role applications + offer workflow. **Not** presenter requests (those live on Program tab with different auth).

**Layout:**

1. Workflow callout
2. `TrustedRolesPanel` (large — role definitions, questions, public apply URLs)
3. **Master/detail grid** (`lg:grid-cols-2`): application list + review pane
4. Status filter: pending, review, approved, rejected
5. **Send offer** → `ParticipationOfferComposer` when approved
6. URL filters: `vettingRoleId`, `applicationId`

**Application statuses:** `pending`, `review`, `approved`, `rejected`

**APIs:**

| Method | Path | Permission |
|--------|------|------------|
| GET/PATCH/POST | `/vetting-applications` | `registration` |
| CRUD | `/trusted-roles`, questions | `registration` |
| GET/POST/PATCH/send | `/participation-offers` | registration / scheduler / staff_ops by `sourceType` |
| GET/PATCH | `/participation-settings` | **`admin`** |

**Public apply (feeds queue):**

- `POST /api/v1/public/conventions/:key/trusted-roles/:applySlug/apply`
- `POST .../vendor-applications`
- `GET .../participation-opportunities`

**Migration state:** `needsMigration: true` → amber banner “Trusted roles and applications are not enabled yet”

**Empty state:** “No applications in the queue”

**Notifications (BullMQ):**

- `convention_participation_offer_sent` → applicant
- `convention_participation_offer_responded` → organizer

**Overhaul opportunities:**

- Split **Trusted roles setup** vs **Review queue** into clearer steps (setup wizard vs inbox)
- Vendor/exhibitor queue currently split between Integrations (exhibitors admin) and applications — unify story in UX copy
- Presenter requests on Program tab should cross-link here when promoted to offers

---

### 6.6 Shift swaps — `ShiftSwapsPanel`

**File:** `ShiftSwapsPanel.tsx`

**Props:** `eventSlug`, `timezone`, `readOnly?`

**Purpose:** Approve/decline volunteer shift trade requests.

**APIs:** `GET/POST /shift-swaps`, `PATCH /shift-swaps/:id` — `staff_ops`

**Migration:** `needsMigration` banner when schema not ready

**Empty:** “No trade requests yet”

---

### 6.7 Badges — `BadgesPrintPanel`

**File:** `BadgesPrintPanel.tsx`

**Props:** `eventSlug`, `readOnly`

**Purpose:** Badge logo upload, search/reprint, batch print by category.

**Sections:**

1. Logo upload → S3 via `POST /badges/logo/upload`
2. Find/reprint single registrant
3. Batch print by roster filter (`checked_in` | `confirmed` | `ready`)

**API:** `GET /badges/print-data?status=...` → `{ eventTitle, logoUrl, badgeLayoutJson, categories[], registrants[] }`

**Related:** Door mode and signups check-in drive “on-site” badge eligibility.

**Empty:** “No logo yet”, “No registrants in this roster filter.”

**Overhaul:** Connect visually to Signups check-in status; preview badge layout inline.

---

### 6.8 Coverage — `DmCoveragePanel`

**File:** `DmCoveragePanel.tsx`

**Props:** `eventSlug`, `timezone`, window, `shifts`, `onRefreshShifts`, `readOnly`

**Guard:** If `!hasEventWindow`, People hub shows static message — set dates in Settings first.

**Purpose:** DM/coverage requirement windows, 2-hour gap heatmap, assign staff from gap modal.

**Sections:**

1. `TrustedRoleWorkflowCallout` (coverage variant)
2. Add coverage window form
3. Requirements list
4. **Grid matrix** (time × day) — heavy UI, needs event window
5. Gap assignment modal (conflict override)

**APIs:**

| Method | Path |
|--------|------|
| CRUD | `/dm-requirements` |
| GET | `/staff-shifts`, `/locations` |

**Scanner:** `dmCoverageScanner.ts` (server-side gap detection)

**Cross-link:** `useOrganizerTabHref('people', { peopleTab: 'staff' })`

---

### 6.9 Incidents — `SafetyIncidentsPanel`

**File:** `SafetyIncidentsPanel.tsx`

**Props:** `eventSlug`, `permissions`, `readOnly`

**Purpose:** Lightweight safety incident log (human decides — no autonomous ML resolution).

**Sections:** Create form (hidden readOnly); restricted notes if `canEditVettingSafetyNotes`; list

**API:** `GET/POST /safety-incidents` — `staff_ops`

**Empty:** “No incidents logged.”

---

### 6.10 Compliance — `VolunteerCompliancePanel`

**File:** `VolunteerCompliancePanel.tsx`

**Props:** `eventSlug` only — **no readOnly prop**

**Purpose:** Read-only table — registrants below required volunteer hours per category.

**API:** `GET /volunteer-compliance` → `{ rows: [{ registrantId, displayName, categoryName, expectedHours, claimedHours, deficitHours }] }`

**Empty:** “Everyone meets required hours, or no categories define expected hours.”

---

## 7. Data model (People-relevant tables)

| Table | Role in People UI |
|-------|-------------------|
| `convention_registrants` | Signups records |
| `convention_registration_categories` | Ticket types, `expected_hours`, check-in windows |
| `convention_registration_forms` / `_questions` | Form builder (Settings/admin) |
| `convention_registrant_answers` | Signups detail “answers” tab |
| `convention_persons` | Roster directory |
| `convention_person_role_assignments` | Role bucket labels (sync) |
| `convention_trusted_roles` / `_questions` | Applications setup |
| `convention_vetting_applications` | Application queue |
| `convention_participation_offers` | Offer letters |
| `convention_volunteer_shifts` | Staff shifts |
| `convention_volunteer_shift_signups` | Volunteer signups on shifts |
| `convention_shift_swap_requests` | Swaps |
| `convention_dm_requirements` | Coverage windows |
| `convention_safety_incidents` | Incidents |
| `convention_command_grants` | Per-user bridge permissions |
| `convention_access_grants` | Attendee/staff access (sync → people) |
| `convention_staff_duties` | Role labels (sync) |
| `schedule_slot_persons` | Roster drawer “sessions” |
| `schedule_slot_presenters` | Platform presenters (Program — separate) |
| `schedule_slot_staff` | Staff on program slots |
| `convention_exhibitors` | Vendors (Integrations admin UI) |
| `convention_presenter_requests` | Presenter apply (Program tab) |

**People sync job:** Queue `c2k-convention-people-sync`

- Triggered: `GET /people`, registrant POST/import/PATCH, some public registration paths
- Rebuilds `convention_persons` + role assignments from registrants, grants, duties, program, shifts
- Inline fallback when Redis unavailable

---

## 8. Realtime & notifications

**WebSocket:** No People-specific scope. Schedule realtime uses `convention:{id}:schedule` only.

**People freshness:** HTTP polling + people sync job — not live WS.

**Notifications from People flows:**

| Type | Trigger |
|------|---------|
| `convention_participation_offer_sent` | Offer send |
| `convention_participation_offer_responded` | Applicant accept/decline |

Registrant CRUD, vetting PATCH, incidents POST do **not** emit notifications today.

---

## 9. Hooks & data fetching patterns

| Pattern | Usage in People hub |
|---------|---------------------|
| `usePeopleSubTab` | Sub-tab URL sync |
| `useOrganizerTabHref` / `organizerTabHref` | Internal links |
| `useOrganizerSubPath('door')` | Door mode from signups |
| `organizerDancecardFetch` | **All panels** — no dedicated `useApiPeople*` hook |
| `useApiConventionParticipation` | Only `ParticipationOfferComposer` (offer send) |
| Bootstrap parent | `shifts`, `permissions`, `peopleHubTemplate` |

**Caching:** `organizerApi.ts` GET cache (~8s; bootstrap ~5s).

---

## 10. Responsive & layout notes

| Component | Behavior |
|-----------|----------|
| `OrganizerSectionTabs` | Mobile `<select>` vs desktop tablist |
| `RegistrantsMasterDetail` | Mobile cards + slide-over; desktop table |
| `StaffShiftsPanel` | Separate mobile timeline |
| `VettingQueuePanel` | 1-col → `lg:2-col` master/detail |
| People hub width | Wide layout max ~1400px (1600 with wide canvas toggle) |
| Tables | Horizontal scroll (`overflow-x-auto`) |

**Overhaul:** People ops on phone (door-adjacent check-in, incident log, shift view) may deserve dedicated mobile-first layouts beyond master/detail.

---

## 11. Related surfaces (not in People hub)

| Surface | Location | Relationship |
|---------|----------|--------------|
| Door mode | Sidebar / dashboard | Check-in; exits to signups |
| Program → Session drawer → People | `SessionDetailDrawer` | **`schedule_slot_persons`** assignment — scheduler domain |
| Presenter requests | Program tab | Org moderator auth; promote to slot |
| Exhibitors | Integrations tab | Admin CRUD; vendor apply → applications/offers |
| Registration form builder | Settings (admin) | Feeds signups answers |
| Participation settings | Settings (admin) | Apply windows, offer templates |
| Command team grants | Settings | Who gets registration/staff_ops/scheduler |

---

## 12. Known gaps & overhaul backlog

Priority items for a trustworthy People hub redesign:

1. **`readOnlyForTab('people') === false`** — shell read-only never applies; clarify permission UX.
2. **Roster `?person=` deep link** — signups emits it; roster ignores it.
3. **No URL-synced registrant detail** — refresh loses selection.
4. **Signups vs roster mental model** — intro copy exists but tables feel like duplicate people lists; consider unified search or clearer “registration record vs directory row” cards.
5. **ID confusion** — staff shift `personId` = user UUID; roster `convention_persons.id` different; must be explicit in UI labels/tooltips.
6. **Permission/API mismatches** — categories, policies, tags fail silently for registration-only roles.
7. **Applications panel density** — TrustedRolesPanel + queue in one scroll; split setup vs inbox.
8. **Vendor story split** — Integrations exhibitors vs applications queue vs public `/vend/apply`.
9. **No hub-level metrics** — registrant count, on-site count, pending applications, open shifts (partially on Dashboard/Live ops only).
10. **Munch template** — only two tabs; needs clear upgrade CTA in settings.
11. **Compliance panel** — no readOnly; always editable appearance though read-only data.
12. **People sync on every GET /people** — roster refresh is expensive; consider stale-while-revalidate UX indicator.

---

## 13. Strategic constraints (do not break)

From `C2K-STRATEGIC-GUIDANCE.md` and extend-before-add rules:

- **One `users` row** per identity; writes set `user_id`.
- **No Stripe / payments table** in registration — payment status fields are organizer-entered only.
- **No second forum/people stack** — extend existing registrants + convention_persons.
- **Moderation:** AI may summarize; humans decide (incidents, vetting).
- **Side effects after commit:** offer email via BullMQ, people sync via queue — no new inline email in route handlers.
- **ECKE:** outbound publish only; People tab edits do not auto-sync external dancecard surfaces.
- **Extend before add:** prefer column/JSONB on existing tables over parallel registrant/roster models.

---

## 14. File index (implementation map)

### Orchestration

| File | Role |
|------|------|
| `packages/web/src/components/dancecard/organizer/PeopleHubPanel.tsx` | Hub shell |
| `packages/web/src/components/dancecard/organizer/usePeopleSubTab.ts` | URL sub-tab |
| `packages/web/src/components/dancecard/organizer/shell/organizerNavConfig.ts` | Sub-tab types, legacy map |
| `packages/web/src/lib/dancecard/commandBridgeNavPermissions.ts` | Tab/sub-tab gates |
| `packages/web/src/lib/dancecard/conventionCommandPermissions.ts` | Field-level gates |
| `packages/web/src/components/organizer/convention/ConventionDancecardOrganizerClient.tsx` | Renders People hub |

### Panels

| Sub-tab | Primary file |
|---------|--------------|
| signups | `RegistrantsPanel.tsx`, `registrants/RegistrantsMasterDetail.tsx` |
| roster | `PeopleDirectoryPanel.tsx`, `PersonDetailDrawer.tsx` |
| staff | `StaffShiftsPanel.tsx` |
| applications | `VettingQueuePanel.tsx`, `TrustedRolesPanel.tsx`, `ParticipationOfferComposer.tsx` |
| swaps | `ShiftSwapsPanel.tsx` |
| badges | `BadgesPrintPanel.tsx` |
| coverage | `DmCoveragePanel.tsx` |
| incidents | `SafetyIncidentsPanel.tsx` |
| compliance | `VolunteerCompliancePanel.tsx` |

### API (backend)

| Module | Path |
|--------|------|
| Monolith | `packages/api/src/routes/convention-organizer-routes.ts` |
| People CRUD | `packages/api/src/routes/convention-organizer/people-routes.ts` |
| Registration | `packages/api/src/routes/convention-organizer/registration-routes.ts` |
| Participation offers | `packages/api/src/routes/convention-organizer/participation-routes.ts` |
| Door/check-in | `packages/api/src/routes/convention-organizer/door-routes.ts` |
| Badges | `packages/api/src/routes/convention-organizer/program-ext-routes.ts` |
| Compliance/exhibitors | `packages/api/src/routes/convention-organizer/modules-routes.ts` |
| People sync | `packages/api/src/lib/convention-people-sync.ts` |

### Shared types

| Export | File |
|--------|------|
| `ConventionCommandPermissions` | `@c2k/shared` |
| `ConventionParticipationSettings`, offer types | `@c2k/shared` convention-participation |
| `NOTIFICATION_TYPES` | `@c2k/shared` |

---

## 15. Suggested overhaul information architecture

Optional target structure (product decision — not implemented):

```
People hub
├── Overview (new) — counts, on-site, pending apps, staffing gaps, quick actions
├── Signups — registration inbox (check-in, import, door link)
├── Roster — directory + person drawer (URL-synced)
├── Staffing — merge Staff shifts + Coverage + Swaps sub-nav
├── Applications — queue-first; trusted roles setup linked to Settings
├── Badges & door — badges print + door mode entry
└── Safety — incidents + compliance
```

Use **permission-filtered** sections same as today; munch template collapses to Signups + Roster only.

---

*Last updated: 2026-06-06 — reflects Command Bridge People hub as implemented in repo (paths verified under `packages/web/src/components/dancecard/organizer/`).*
