import type { ApiBookmarkEvent } from '@/hooks/useApiBookmarks'
import type { ApiEventListItem } from '@/lib/api-event-mapper'
import { mapApiEventToMockEvent } from '@/lib/api-event-mapper'

export function bookmarkEventToListItem(row: ApiBookmarkEvent): ApiEventListItem {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    imageUrl: row.imageUrl,
    eventFormat: row.eventFormat,
    location: row.location,
    publicLocationSummary: row.publicLocationSummary,
    locationRedacted: row.locationRedacted,
    joinLinkRedacted: row.joinLinkRedacted,
    rsvpCount: row.rsvpCount,
  }
}

export function bookmarkEventToMockEvent(row: ApiBookmarkEvent) {
  return mapApiEventToMockEvent(bookmarkEventToListItem(row))
}
