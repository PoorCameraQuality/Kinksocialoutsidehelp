# Moderation and reporting

## Flow

1. A member or organizer submits a report.
2. Intake maps categories to `PolicyReason` values from `@c2k/shared`.
3. The case lands in a platform or scoped queue.
4. Humans review and take action.
5. Action helpers hide, remove, suspend, quarantine media, or apply other allowed outcomes.

Automated systems may help summarize. Humans decide safety outcomes.

## Policy reason sets

| Set | Meaning |
|-----|---------|
| `P0_POLICY_REASONS` | Immediate escalation. Notify platform mods quickly. |
| `PLATFORM_CRITICAL_POLICY_REASONS` | Must not be dismissed as local-only. Broader than P0. |

Every P0 reason is platform-critical. The reverse is not true.

## Code map

| Concern | Module area |
|---------|-------------|
| Report intake | `moderation-ts-intake.ts` and related routes |
| Action execution | `moderation-action-execute.ts` |
| Media moderator mutations | `media-mod-actions.ts` |
| Scan / publish decisions | `media-moderation-decision.ts` |
| Route auth for mod surfaces | `moderation-route-auth.ts` |
| Architecture overview | `architecture/12-moderation-systems.md` |

`HIDE_CONTENT` fails closed when the content kind is unknown.

## Scoped moderation

Orgs, groups, events, and conventions can have scoped tools. Platform T&S remains responsible for platform-critical reasons.

## Operator playbooks

Detailed operator playbooks live in the private development workspace. This slice keeps the engineer-facing module map above.
