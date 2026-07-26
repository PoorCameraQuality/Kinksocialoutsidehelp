import { NOTIFICATION_TYPES } from '@c2k/shared'
import { inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { loadBlockedUserIds, loadUserIdsWhoBlockedUser } from './blocks.js'

type NotificationRow = {
  id: string
  type: string
  payload: unknown
}

export type NotificationActorKey =
  | { kind: 'userId'; userId: string }
  | { kind: 'username'; username: string }
  | null

type ActorResolver = (payload: Record<string, unknown>) => NotificationActorKey

function userIdActor(value: unknown): NotificationActorKey {
  return typeof value === 'string' && value.length > 0 ? { kind: 'userId', userId: value } : null
}

function usernameActor(value: unknown): NotificationActorKey {
  return typeof value === 'string' && value.length > 0 ? { kind: 'username', username: value } : null
}

/**
 * PR 3 (P4): every notification type is explicitly classified.
 *
 * - `social` types carry a user-actor in their payload; when the viewer has
 *   blocks, an unresolvable actor DROPS the notification (fail closed) so new
 *   payload shapes cannot bypass block filtering.
 * - `system` types are platform/org/moderation-driven (or counterparty
 *   responses inside an already-consented flow, e.g. dancecard accept/decline
 *   where the payload carries no actor) and are always delivered.
 *
 * The registry unit test fails when a type in @c2k/shared NOTIFICATION_TYPES
 * is missing here — classify new types before shipping them.
 */
export const NOTIFICATION_PRIVACY_REGISTRY: Record<
  string,
  { class: 'social'; actor: ActorResolver } | { class: 'system' }
> = {
  [NOTIFICATION_TYPES.connectionRequest]: {
    class: 'social',
    actor: (p) => usernameActor(p.requesterUsername),
  },
  [NOTIFICATION_TYPES.connectionAccepted]: {
    class: 'social',
    actor: (p) => usernameActor(p.accepterUsername),
  },
  [NOTIFICATION_TYPES.dmRequest]: { class: 'social', actor: (p) => userIdActor(p.fromUserId) },
  [NOTIFICATION_TYPES.newMessage]: {
    class: 'social',
    actor: (p) => usernameActor(p.senderUsername),
  },
  [NOTIFICATION_TYPES.profileRelationshipRequest]: {
    class: 'social',
    actor: (p) => usernameActor(p.requesterUsername),
  },
  [NOTIFICATION_TYPES.profileRelationshipAccepted]: {
    class: 'social',
    actor: (p) => usernameActor(p.partnerUsername),
  },
  [NOTIFICATION_TYPES.profileRelationshipDeclined]: {
    class: 'social',
    actor: (p) => usernameActor(p.partnerUsername),
  },
  [NOTIFICATION_TYPES.dancecardBookingRequested]: {
    class: 'social',
    actor: (p) => userIdActor(p.guestUserId),
  },
  [NOTIFICATION_TYPES.dancecardSceneCancelled]: {
    class: 'social',
    actor: (p) => userIdActor(p.cancelledByUserId),
  },
  // Counterparty responses within an existing booking (no payload actor).
  [NOTIFICATION_TYPES.dancecardBookingAccepted]: { class: 'system' },
  [NOTIFICATION_TYPES.dancecardBookingDeclined]: { class: 'system' },
  [NOTIFICATION_TYPES.dancecardRescheduleRequested]: { class: 'system' },
  [NOTIFICATION_TYPES.dancecardRescheduleAccepted]: { class: 'system' },
  [NOTIFICATION_TYPES.dancecardRescheduleDeclined]: { class: 'system' },
  // Platform / org / moderation / reminders.
  [NOTIFICATION_TYPES.eventRsvpConfirmedVirtual]: { class: 'system' },
  [NOTIFICATION_TYPES.eventVirtualReminder24h]: { class: 'system' },
  [NOTIFICATION_TYPES.eventVirtualReminder1h]: { class: 'system' },
  [NOTIFICATION_TYPES.orgAnnouncement]: { class: 'system' },
  [NOTIFICATION_TYPES.groupOwnerInactive]: { class: 'system' },
  [NOTIFICATION_TYPES.groupIdleWarning]: { class: 'system' },
  [NOTIFICATION_TYPES.groupDisbandedIdle]: { class: 'system' },
  [NOTIFICATION_TYPES.scheduleConflictDetected]: { class: 'system' },
  [NOTIFICATION_TYPES.conventionStaffAssignmentUpdated]: { class: 'system' },
  [NOTIFICATION_TYPES.conventionParticipationOfferSent]: { class: 'system' },
  [NOTIFICATION_TYPES.conventionParticipationOfferResponded]: { class: 'system' },
  [NOTIFICATION_TYPES.conventionApplicationSubmitted]: { class: 'system' },
  [NOTIFICATION_TYPES.conventionApplicationApproved]: { class: 'system' },
  [NOTIFICATION_TYPES.conventionApplicationRejected]: { class: 'system' },
  [NOTIFICATION_TYPES.moderationActionPending]: { class: 'system' },
  [NOTIFICATION_TYPES.moderationReportEscalated]: { class: 'system' },
  [NOTIFICATION_TYPES.orgModerationNeeded]: { class: 'system' },
  [NOTIFICATION_TYPES.p0ModerationCaseCreated]: { class: 'system' },
  [NOTIFICATION_TYPES.reportReviewed]: { class: 'system' },
  [NOTIFICATION_TYPES.vendorRunnerAdded]: { class: 'system' },
  [NOTIFICATION_TYPES.mailIntakeReceived]: { class: 'system' },
  [NOTIFICATION_TYPES.adminDashboardAlert]: { class: 'system' },
}

/** Resolve actor user id from a social notification payload when possible. */
export function notificationActorKey(
  type: string,
  payload: Record<string, unknown>,
): NotificationActorKey {
  const entry = NOTIFICATION_PRIVACY_REGISTRY[type]
  if (!entry || entry.class !== 'social') return null
  return entry.actor(payload)
}

export async function filterNotificationsForViewer<T extends NotificationRow>(
  viewerId: string,
  rows: T[],
): Promise<T[]> {
  const blocked = new Set([
    ...(await loadBlockedUserIds(viewerId)),
    ...(await loadUserIdsWhoBlockedUser(viewerId)),
  ])
  if (blocked.size === 0) return rows

  const usernames = new Set<string>()
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    const actor = notificationActorKey(row.type, payload)
    if (actor?.kind === 'username') usernames.add(actor.username)
  }

  const usernameToId = new Map<string, string>()
  if (usernames.size > 0) {
    const users = await db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(inArray(schema.users.username, [...usernames]))
    for (const user of users) usernameToId.set(user.username, user.id)
  }

  return rows.filter((row) =>
    notificationVisibleToViewer(row, { blocked, usernameToId }),
  )
}

/**
 * Pure visibility decision (exported for unit tests). Applies only when the
 * viewer has blocks; social rows with unresolvable actors are dropped.
 */
export function notificationVisibleToViewer(
  row: NotificationRow,
  ctx: { blocked: Set<string>; usernameToId: Map<string, string> },
): boolean {
  const entry = NOTIFICATION_PRIVACY_REGISTRY[row.type]
  if (!entry) {
    // Unregistered type: fail closed for viewers with blocks (P4).
    return false
  }
  if (entry.class === 'system') return true

  const payload = (row.payload ?? {}) as Record<string, unknown>
  const actor = entry.actor(payload)
  if (!actor) return false
  const actorId =
    actor.kind === 'userId' ? actor.userId : (ctx.usernameToId.get(actor.username) ?? null)
  if (!actorId) return false
  return !ctx.blocked.has(actorId)
}
