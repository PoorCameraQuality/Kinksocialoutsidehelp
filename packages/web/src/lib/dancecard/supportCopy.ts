/** Layman-facing messages - no migrations, buckets, or internal paths. */

export const supportCopy = {
  setupIncomplete:
    'This part of your event is not fully set up yet. Contact your platform administrator or East Coast Kink Events support.',
  featureUnavailableAttendee:
    'This feature is not available for your event yet. Check back later or ask the organizer.',
  featureUnavailableOrganizer:
    'This feature is not available on your account yet. Contact your platform administrator if you expected it to be on.',
  serviceUnavailable:
    'We could not reach the server. Refresh the page and try again. If it keeps happening, contact support.',
  tryAgainLater: 'Something went wrong. Please try again in a moment.',

  mapsUploadIntro:
    'Upload a floor plan image (PNG or JPG). Attendees open Map from their dancecard to see rooms and sessions.',
  placeRoomZonesIntro:
    'Select a room, pick a shape, then click the map to place it (or drag the zone). Adjust width, height, and rotation to match your layout. Zoom in for fine detail.',
  mapsNotReady: 'Venue maps are not set up for this event yet. Open the Venues tab to upload a floor plan.',
  floorPlansNotReady: 'Floor plans are not set up yet. Upload a map on the Venues tab under Rooms & floor plan.',

  isoModerationNotReady: 'The ISO board is not set up for this event yet.',
  groupsModerationNotReady: 'Attendee groups are not set up for this event yet.',
  sessionFeedbackNotReady: 'Session feedback is not set up for this event yet.',
  shiftSwapsNotReady: 'Shift swaps are not set up for this event yet.',
  messagingNotReady: 'Email and announcements are not set up for this event yet.',
  embedTokensNotReady: 'Embed links are not set up for this event yet.',
  notificationsNotReady: 'Notifications are not available yet. Your organizer may still be finishing setup.',
  vettingNotReady: 'Special role applications are not set up for this event yet.',
  trustedRolesNotReady: 'Trusted roles are not set up for this event yet.',
  importNotReady:
    'Program import is not fully set up yet. Contact your platform administrator to finish event setup.',
  locationsNotReady: 'Rooms and locations need to be set up before import. Contact your platform administrator.',
  activityNotesNotReady: 'Session notes are not available until your event setup is finished.',
  calendarFeedsNotReady: 'Calendar subscribe links are not enabled yet. Contact your platform administrator.',

  dashboardLoadFailed:
    'We could not load setup status. Try Refresh. If this keeps happening, your event may need a platform update.',
  preflightFailed:
    'Pre-flight checks could not run. Try again, or contact support if the problem continues.',
} as const

/** Strip technical API errors before showing them in the UI. */
export function toUserFacingErrorMessage(raw: string): string {
  const msg = raw.trim()
  if (!msg) return supportCopy.tryAgainLater

  if (
    /migration|\.sql\b|supabase|database is missing|dancecard_\d|npm run dancecard|DATABASE_URL|apply locally/i.test(
      msg,
    )
  ) {
    return supportCopy.setupIncomplete
  }
  if (/vercel|redeploy from github|\/api\/dancecard|expected json.*html/i.test(msg)) {
    return supportCopy.serviceUnavailable
  }
  if (/organizer api route was not found|returned html instead of json/i.test(msg)) {
    return supportCopy.serviceUnavailable
  }
  if (msg.length > 280) return supportCopy.tryAgainLater
  return msg
}

/** Pin list label for map editor sidebar. */
export function formatPinPlacementLabel(x: string | undefined, y: string | undefined): string {
  const nx = Number(x ?? 0.5)
  const ny = Number(y ?? 0.5)
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return 'Not placed'
  if (Math.abs(nx - 0.5) < 0.02 && Math.abs(ny - 0.5) < 0.02) return 'Not placed'
  return 'On map'
}
