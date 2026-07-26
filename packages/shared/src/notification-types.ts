/**
 * In-app notification type strings - shared contract between API emitters and web inbox.
 * Register new types here before use in routes or workers (C2K-STRATEGIC-GUIDANCE §12).
 */
export const NOTIFICATION_TYPES = {
  connectionRequest: 'connection_request',
  connectionAccepted: 'connection_accepted',
  dmRequest: 'dm_request',
  newMessage: 'new_message',
  eventRsvpConfirmedVirtual: 'event_rsvp_confirmed_virtual',
  eventVirtualReminder24h: 'event_virtual_reminder_24h',
  eventVirtualReminder1h: 'event_virtual_reminder_1h',
  orgAnnouncement: 'org_announcement',
  groupOwnerInactive: 'group_owner_inactive',
  groupIdleWarning: 'group_idle_warning',
  groupDisbandedIdle: 'group_disbanded_idle',
  scheduleConflictDetected: 'schedule_conflict_detected',
  conventionStaffAssignmentUpdated: 'convention_staff_assignment_updated',
  conventionParticipationOfferSent: 'convention_participation_offer_sent',
  conventionParticipationOfferResponded: 'convention_participation_offer_responded',
  conventionApplicationSubmitted: 'convention_application_submitted',
  conventionApplicationApproved: 'convention_application_approved',
  conventionApplicationRejected: 'convention_application_rejected',
  dancecardBookingRequested: 'dancecard_booking_requested',
  dancecardBookingAccepted: 'dancecard_booking_accepted',
  dancecardBookingDeclined: 'dancecard_booking_declined',
  dancecardSceneCancelled: 'dancecard_scene_cancelled',
  dancecardRescheduleRequested: 'dancecard_reschedule_requested',
  dancecardRescheduleAccepted: 'dancecard_reschedule_accepted',
  dancecardRescheduleDeclined: 'dancecard_reschedule_declined',
  moderationActionPending: 'moderation_action_pending',
  moderationReportEscalated: 'moderation_report_escalated',
  orgModerationNeeded: 'org_moderation_needed',
  p0ModerationCaseCreated: 'p0_moderation_case_created',
  reportReviewed: 'report_reviewed',
  profileRelationshipRequest: 'profile_relationship_request',
  profileRelationshipAccepted: 'profile_relationship_accepted',
  profileRelationshipDeclined: 'profile_relationship_declined',
  vendorRunnerAdded: 'vendor_runner_added',
  mailIntakeReceived: 'mail_intake_received',
  adminDashboardAlert: 'admin_dashboard_alert',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

const ALL = new Set<string>(Object.values(NOTIFICATION_TYPES))

export function isKnownNotificationType(type: string): type is NotificationType {
  return ALL.has(type)
}
