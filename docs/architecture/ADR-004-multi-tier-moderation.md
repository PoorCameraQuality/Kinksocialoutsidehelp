# ADR-004: Multi-tier moderation

**Status:** Accepted (alpha)  
**Date:** 2026-05-29

## Context

C2K needs human-in-the-loop moderation at three levels: site administrators, a platform mod team with collective approval, and org/group stewards with scoped authority inside their communities. Reports must use a single intake path; enforcement must be auditable and visible when admins override team rules.

## Decision

### Tiers

| Tier | Role | Powers |
|------|------|--------|
| **0 — Site admin** | `platform_staff.role = SITE_ADMIN` (+ `C2K_SITE_ADMIN_USER_IDS` fallback) | Full platform enforcement; `execute-now` on pending actions with `override_by` + `override_reason`; identity bans, org freeze, user suspend |
| **1 — Platform mod** | `platform_staff.role = MODERATOR` (+ `C2K_PLATFORM_MODERATOR_USER_IDS` fallback) | Propose `moderation_actions`; **≥2 distinct approvers** (not proposer) before execution; platform reports inbox |
| **2 — Org/group mod** | Org `MODERATOR+` / group leadership | Scoped inbox (`reports.scope_*`), hide/lock content, `scope_bans` (org/group only); optional **escalate to platform** on ban/report |

### Data

- **`platform_staff`** — canonical staff list; env vars seed dev.
- **`moderation_actions`** + **`moderation_action_approvals`** — propose → approve → execute.
- **`moderation_audit_events`** — append-only; every mutating route records a verb.
- **`scope_bans`** — org/group bans; not `identity_bans` unless escalated or tier-0.
- **`reports.scope_type` / `scope_id`** — set at POST for scoped inboxes.
- **Soft-hide** — `forum_posts.hidden_at`, `org_channel_messages.hidden_at`; thread `locked_at` / `pinned_at`.

### Rules

1. **Single intake:** `POST /api/v1/reports` only.
2. **Humans decide:** no autonomous enforcement from ML in route handlers.
3. **Rule of two:** platform actions default `required_approvals = 2`; site admin override is explicit and audited (`rule_of_two_overridden`).
4. **Org ban ≠ platform ban** unless user checks escalate or tier-0 acts.
5. **Side effects:** notifications via existing async patterns (`moderation-notify`), not blocking route work beyond commit.

### API surface (summary)

- Platform: `/api/v1/moderation/actions`, `/moderation/reports`, `/moderation/admin`, `/moderation/audit`
- Org: `/api/v1/organizations/:orgKey/reports`, hide/lock/ban, `/moderation/audit`
- Group: `/api/v1/groups/:groupId/...` mirror subset

## Consequences

- Forum GET handlers must filter hidden content for non-mods.
- WS scopes unchanged this ADR; future scope changes need migration per guidance.
- Vendor-specific mod inbox deferred; org vendor tools may link to org moderation tab.

## Alternatives considered

- **Env-only moderators** — kept as dev fallback only; DB is source of truth in prod.
- **Second report stack** — rejected per extend-before-add.
- **Auto-execute on first approval** — rejected; conflicts with rule of two.
