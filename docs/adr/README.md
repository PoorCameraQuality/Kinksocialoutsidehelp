# Architecture Decision Records (ADR)

Short, durable notes for decisions that constrain how we extend the codebase. **Authoritative feature inventory:** [`../FEATURE_REGISTRY.md`](../FEATURE_REGISTRY.md). **Priorities:** [`../MASTER_NEXT_STEPS.md`](../MASTER_NEXT_STEPS.md).

| ADR | Title | Status |
|-----|--------|--------|
| [002-org-realtime-chat-and-digests.md](./002-org-realtime-chat-and-digests.md) | Org WebSocket subscribe auth, LiveKit voice token, org digest email | Accepted (**implemented** 2026-04-06) |
| [003-irl-event-location-privacy.md](./003-irl-event-location-privacy.md) | In-person event location privacy, RSVP approval, waitlist, attendee list | Accepted (implemented) |
| [004-ecke-member-presentation-layer.md](./004-ecke-member-presentation-layer.md) | ECKE/Dancecard member UI themes (midnight-brass, parchment) | Accepted (implemented) |
| [005-media-section-link-out.md](./005-media-section-link-out.md) | Link-out Media section (`media_shows`, RSS sync, moderation gate) | Accepted (implemented) |
| [006-stripe-connect-per-org.md](./006-stripe-connect-per-org.md) | Per-org + per-vendor Stripe Connect (seller-owned funds; platform UI/webhooks) | Accepted (MVP implemented) |
| [ECKE_SUPABASE_INGEST.md](./ECKE_SUPABASE_INGEST.md) | C2K→ECKE Supabase upsert idempotency | Accepted |
| [EVENT_SYSTEMS_IDENTITY.md](../EVENT_SYSTEMS_IDENTITY.md) | Event Systems — one C2K identity, registration, roster/staff | Accepted; **Phase 1–2 implemented** 2026-05-22 |

When adding an ADR, use the next number (`003-...md`), link it here, and reference it from `FEATURE_REGISTRY.md` or `NEXT_STEPS.md` if it affects shipped vs backlog behavior.
