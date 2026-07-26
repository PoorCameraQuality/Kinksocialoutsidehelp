# ADR: C2K → ECKE Supabase ingest

**Status:** Accepted (2026-05-27) · **Phase C pilot:** events path verified 2026-05-27 (`preview-c2k-weekend`)  
**Supersedes:** Listing-webhook-only mental model for entity types with ECKE tables.

## Context

ECKE public pages for **events** and **dungeons** historically read static JS (`events.js`, `dungeons.js`) with optional Supabase merge. C2K must become the single update surface. Pushes that write Supabase rows are invisible until ECKE enables `UNIFIED_*_PREFER_DB=true`.

## Decision

1. **Transport:** C2K API worker upserts ECKE Supabase via service role REST (same as Dancecard), not a second ingest stack.
2. **Idempotency:** Every C2K-owned row carries `(c2k_source_type, c2k_source_id)` on ECKE tables (`events`, `vendors`, `articles`, `dungeon_venues`). Upsert conflict target: unique index on `(c2k_source_type, c2k_source_id)`; slug remains the public URL key.
3. **Source types:**

| `c2k_source_type` | C2K UUID | ECKE table |
|-------------------|----------|------------|
| `convention` | `conventions.id` | `public.events` |
| `organization` | `organizations.id` | `dungeon_venues` when org is a dungeon listing |
| `vendor_profile` | `vendor_profiles.id` | `public.vendors` |
| `education_article` | `education_articles.id` | `public.articles` |

4. **Publish modes:**
   - **Explicit:** conventions, orgs, groups — Preview/Publish UI; optional listing webhook retained until direct upsert proven.
   - **Auto:** vendors and education articles when `ecke_publish=true` and published — BullMQ `c2k-ecke-publish` after commit.

5. **Dungeon orgs:** Same `organizations` row; `feature_flags.listingKind === 'dungeon'` (or `eckeDungeonListing: true`) selects `ecke_dungeon` target instead of generic listing-only path.

6. **ECKE prerequisite:** Apply additive SQL (`c2k_ingest_external_ids.sql`) before enabling C2K bridge. **`UNIFIED_*_PREFER_DB` optional** — leave false for seamless legacy behavior; see [`ECKE_C2K_HOOKUP_MASTER.md`](../ECKE_C2K_HOOKUP_MASTER.md) §0.

## Consequences

- ECKE admin manual creates for migrated entity types become read-only / emergency override.
- Slug collisions between static JS and DB require audit before prefer-DB cutover.
- Listing webhook (`ECKE_PUBLISH_LISTING_WEBHOOK_URL`) remains optional for org/group until retired.

## References

- [`docs/ECKE_C2K_ENTITY_MAP.md`](../ECKE_C2K_ENTITY_MAP.md)
- ECKE: `database/c2k_ingest_external_ids.sql`, `scripts/migrate-static-*-to-supabase.mjs`
- C2K: `packages/api/src/lib/ecke-directory-sync.ts`, `ecke-publish-queue.ts`
