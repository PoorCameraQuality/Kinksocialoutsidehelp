# Background workers

**Last updated:** 2026-06-06 (queue list vs `worker.ts`; shutdown behavior)

**Process:** `packages/api/src/worker.ts`**Queue backend:** Redis + BullMQ  
**Must share:** `DATABASE_URL`, `REDIS_URL`, mail env with API

---

## Queues

| Queue name | Worker handler | Purpose |
|------------|----------------|---------|
| `c2k-moderation` | `moderationWorker` | P0 case notify, legacy `moderation_jobs` completion, forum-post hooks |
| `c2k-external-sync` | `externalSyncWorker` | Vendor listing sync (Etsy, Shopify, Woo) |
| `c2k-lifecycle` | `lifecycleWorker` | Sweeps, digests, credit sync, retention, trust decay |
| `c2k-convention-people-sync` | `peopleSyncWorker` | Convention people-directory rebuild |
| `c2k-convention-participation-offer` | `participationOfferWorker` | Participation-offer transactional email |
| `c2k-feed-activities` | `feedActivitiesWorker` | `feed_activities` row inserts |
| `c2k-ecke-publish` | `eckePublishWorker` | Outbound ECKE publish jobs |
| `c2k-media-rss` | `mediaRssWorker` | Media show RSS ingest |

---

## Job catalog

### Moderation (`c2k-moderation`)

| Job name | Payload | Behavior |
|----------|---------|----------|
| `p0_report_notify` | `{ caseId, policyReason, queue }` | `notifyP0ModerationCaseCreated` — platform mod in-app notify |
| `process` | `{ jobId }` | `UPDATE moderation_jobs SET status='COMPLETED'` |
| `org_forum_post` / `group_forum_post` | post/thread/org ids | Enqueued on forum post create; **no worker logic yet** (placeholder hook) |
| (unnamed / legacy) | `{ jobId }` | Same as `process` when `jobId` present |

**Enqueue sources:**

- `p0_report_notify` — `moderation-ts-intake.ts` `enqueueP0ReportNotify()` on P0 policy reasons (inline fallback if Redis down)
- `process` — `POST /api/v1/moderation/jobs` in `ecosystem-stubs.ts` via `getModerationQueue().add('process', …)`
- Forum hooks — `organizations.ts`, `group-forums.ts`

**Gap:** Legacy `moderation_jobs` and forum hooks complete without analysis; P0 path only notifies humans.

---

### External sync (`c2k-external-sync`)

| Job name | Behavior |
|----------|----------|
| `sync-vendor` | `syncVendorExternalListings(vendorId)` |
| `sync-all` | All vendors — Etsy, Shopify, Woo |

**Repeat:** `sync-all` on interval — `EXTERNAL_SYNC_REPEAT_MS` (default 45 min; legacy alias `ETSY_SYNC_REPEAT_MS`)

**Disable:** `EXTERNAL_SYNC_DISABLE_REPEAT=true` or legacy `ETSY_SYNC_DISABLE_REPEAT`

---

### Lifecycle (`c2k-lifecycle`)

| Job name | Function | Default repeat |
|----------|----------|----------------|
| `sweep` | `runLifecycleSweep()` — group dormancy | ~24h (`C2K_LIFECYCLE_REPEAT_MS`) |
| `virtual-event-reminders` | `runVirtualEventReminderSweep()` | ~15 min |
| `org-digest-sweep` | `runOrgDigestSweep()` | ~7 days |
| `pinned-digest-sweep` | `runPinnedDigestSweep()` | ~7 days |
| `presenter-teaching-credit-sync` | `runPresenterTeachingCreditSync()` | ~15 min |
| `vendor-event-credit-sync` | `runVendorEventCreditSync()` | ~15 min |
| `retention-sweep` | `runRetentionSweep()` | **On-demand only** (no repeat scheduler in worker; use `npm run db:retention-sweep -w @c2k/api`) |
| `trust-decay-sweep` | `runTrustDecaySweep()` | ~1h |

**Disable all repeats:** `C2K_LIFECYCLE_DISABLE_REPEAT=true`  
**Per-job:** `C2K_ORG_DIGEST_DISABLE`, `C2K_PINNED_DIGEST_DISABLE`, `C2K_VIRTUAL_EVENT_REMINDER_DISABLE`, `C2K_PRESENTER_CREDIT_SYNC_DISABLE`, `C2K_VENDOR_EVENT_CREDIT_SYNC_DISABLE`, `C2K_TRUST_DECAY_DISABLE`

**Repeat tuning:** `C2K_ORG_DIGEST_REPEAT_MS`, `C2K_PINNED_DIGEST_REPEAT_MS`, `C2K_VIRTUAL_EVENT_REMINDER_MS`, `C2K_PRESENTER_CREDIT_SYNC_EVERY_MS`, `C2K_VENDOR_EVENT_CREDIT_SYNC_EVERY_MS`, `C2K_TRUST_DECAY_REPEAT_MS`

---

### Convention people sync (`c2k-convention-people-sync`)

| Job name | Payload | Behavior |
|----------|---------|----------|
| `sync-directory` | `{ conventionId }` | `syncConventionPeopleDirectory(conventionId)` |

**Enqueue:** `requestConventionPeopleDirectorySync()` from organizer/public routes  
**Inline fallback:** `C2K_PEOPLE_SYNC_INLINE=true` or Redis unavailable

---

### Participation offer email (`c2k-convention-participation-offer`)

| Job name | Payload | Behavior |
|----------|---------|----------|
| (default) | `{ offerId }` | `sendParticipationOfferEmail(offerId)` |

**Enqueue:** `enqueueParticipationOfferEmail()` from `convention-participation-offer-queue.ts`

---

### Feed activities (`c2k-feed-activities`)

| Job name | Payload | Behavior |
|----------|---------|----------|
| `emit` | `EmitActivityParams` (`actorId`, `verb`, `objectType`, `objectId`, …) | `insertFeedActivity()` |

**Enqueue:** `emitActivity()` → `requestFeedActivityEmit()` (RSVP, posts, org join, etc.)  
**Inline fallback:** `C2K_FEED_ACTIVITIES_INLINE=true` or Redis unavailable

---

### ECKE publish (`c2k-ecke-publish`)

| Job name | Payload | Behavior |
|----------|---------|----------|
| `publish-article` | `{ articleId, userId? }` | `executeEckePublishArticle` |
| `publish-vendor` | `{ vendorProfileId, userId? }` | `executeEckePublishVendor` |
| `publish-convention-event` | `{ conventionId, userId? }` | `executeEckePublishConventionEvent` |

**Enqueue:** `requestEcke*Publish()` from `ecke-publish-queue.ts` / publish routes  
**Inline fallback:** `C2K_ECKE_PUBLISH_INLINE=true` or Redis unavailable

---

### Media RSS (`c2k-media-rss`)

| Job name | Behavior |
|----------|----------|
| `sync-show` | `syncMediaShowRss(showId)` |
| `sync-all` | `syncAllMediaShowFeeds()` |

**Repeat:** `sync-all` — `C2K_MEDIA_RSS_REPEAT_MS` (default 6h)  
**Disable:** `C2K_MEDIA_RSS_DISABLE=true`

---

## Worker ↔ API coupling

```
API route ──enqueue──▶ Redis ──▶ Worker ──▶ lib/*.ts sweeps / publish / notify
                │
                └── On Redis down: inline fallback (ECKE, feed, people-sync, P0 notify)
                    or job stays PENDING (legacy moderation_jobs) / log warning (repeat schedule)
```

Digest sweeps and participation-offer email call `sendEmail` directly — transport must be configured or they no-op/log.

---

## Operational commands

```bash
# Dev (second terminal, from repo root)
npm run build -w @c2k/api && npm run start:worker -w @c2k/api

# Or with tsx (no build)
npx tsx packages/api/src/worker.ts
```

Worker logs queue names on startup (see `console.log` after `eckePublishWorker` — **`c2k-media-rss`** is registered separately below that line).

Graceful shutdown (`SIGINT`/`SIGTERM`) currently closes **`moderationWorker`**, **`externalSyncWorker`**, **`lifecycleWorker`**, and **`mediaRssWorker`** only; other workers exit with the process. Prefer a single worker replica in dev unless you accept in-flight job loss on restart.

---

## Scaling workers

| Approach | Notes |
|----------|-------|
| Single worker replica | OK for dev/small prod |
| Horizontal workers | Safe for idempotent jobs (sync, digests, feed emit, ECKE publish with jobId dedupe) |
| Digest / repeat sweeps | BullMQ `jobId` repeat keys avoid duplicate schedulers per replica |

---

## Still synchronous on API (not queued)

- Hub push notifications (`convention-hub-channels-routes.ts`)
- Most `createNotification` calls (including non-P0 moderation paths)

---

## Env reference (quick)

| Variable | Effect |
|----------|--------|
| `REDIS_URL` | Required for queues |
| `USE_DATABASE=true` | Worker mutates DB |
| `C2K_MAIL_TRANSPORT` | Digests / offer email send mail |
| `C2K_PLATFORM_MAIL_BCC` | Owner copy on digest sends |
| `C2K_ECKE_PUBLISH_INLINE` | Skip queue for ECKE |
| `C2K_FEED_ACTIVITIES_INLINE` | Skip queue for feed emit |
| `C2K_PEOPLE_SYNC_INLINE` | Skip queue for people directory |

See [`DEPLOY_MAIL_K8S.md`](../DEPLOY_MAIL_K8S.md).
