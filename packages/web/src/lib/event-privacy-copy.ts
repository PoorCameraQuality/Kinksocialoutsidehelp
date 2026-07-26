/** Public copy when venue/details are gated until RSVP or registration. */
export const EVENT_LOCATION_AFTER_RSVP = 'Location shared after RSVP'
export const EVENT_DETAILS_AFTER_RSVP = 'Details unlock after RSVP'

export const EVENT_RSVP_PRIVACY_TITLE = 'Before you RSVP'

export const EVENT_RSVP_PRIVACY_BODY =
  'Event attendance can reveal where you go and what communities you are part of. This event controls who can see the attendee list. Your RSVP should only appear where the event privacy settings allow it.'

export type AttendeeListVisibility = 'public' | 'count_only' | string

/** Plain-language attendee list summary for event detail RSVP area. */
export function attendeeListVisibilitySummary(
  visibility: AttendeeListVisibility | null | undefined,
  opts?: { viewerIsHost?: boolean; viewerIsGoing?: boolean },
): string | null {
  if (visibility === 'count_only') {
    if (opts?.viewerIsHost) return 'Only hosts can see attendee names (counts are public)'
    if (opts?.viewerIsGoing) return 'Attendees can see each other; others see counts only'
    return 'Only hosts can see attendees'
  }
  if (visibility === 'public') return 'Public attendee list'
  return null
}

export function formatGatedEventLocation(
  location?: string | null,
  options?: { locationRedacted?: boolean; joinLinkRedacted?: boolean },
): string {
  const trimmed = location?.trim()
  if (trimmed) return trimmed
  if (options?.locationRedacted || options?.joinLinkRedacted) return EVENT_LOCATION_AFTER_RSVP
  return 'TBA'
}
