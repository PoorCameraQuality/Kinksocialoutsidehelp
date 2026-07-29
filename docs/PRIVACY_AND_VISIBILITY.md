# Privacy and visibility

Privacy is enforced on the API. UI controls are not a security boundary.

## Layers

| Layer | Examples |
|-------|----------|
| Resource visibility | Org/group/event `PUBLIC` / `MEMBERS` / private-style values |
| Field visibility | Profile gender, age, location, etc. |
| Relationship gates | Connections, follow, blocks |
| Media gates | Content rating/status plus scope |
| Feed activity privacy | Per-verb feed surfacing settings |
| Staff bypass | Platform moderators with correct helpers |

## Important vocabulary mismatches

These are easy to get wrong:

| Term in settings or enum | Current runtime meaning |
|--------------------------|-------------------------|
| `friends` on profile/DM settings | Accepted mutual connections |
| Media `FOLLOWERS` | Accepted mutual connections on asset/item paths |
| Feed `connections_only` | Surface-specific: following feed uses connections ∪ follows; discovery post counts use mutual connections |

Do not rename persisted enum values without a migration plan.

## "Public" means more than one thing

| Kind | Meaning | Code area |
|------|---------|-----------|
| SEO public | Allowlisted marketing paths for indexing | `seo-policy` |
| Auth public | Session optional in strict mode | `public-paths` / `isPublicPath` |
| Resource public | Entity visibility such as `PUBLIC` | Domain visibility helpers |

Do not merge those lists.

## Where to look in code

| Concern | Start here |
|---------|------------|
| Profile fields | `packages/shared/.../profile-field-visibility.ts`, API profile access |
| Feed activity | `feed-activity-privacy.ts` |
| Media | `media-types.ts`, `passesMediaRatingAndStatusGate`, scope viewers |
| Orgs / groups / events | `org-visibility.ts`, group/event access libs |
| DMs | `dm-privacy.ts` |
| Connections lists | `connections-list-visibility.ts` |
| Notifications | notification privacy helpers |

## WebSockets

When you change who can see a resource over REST, update `authorizeWebSocketSubscribe` in the same change. Drift leaks data.

## Blocks

Block relationships must stay respected in notification and social delivery paths.

## Legal and data minimization

Engineer-facing summary: minimize what leaves the API, keep retention enforceable in workers (`packages/shared/src/retention-policy.ts`), and protect privileged admin reveals behind staff role plus step-up where required.
