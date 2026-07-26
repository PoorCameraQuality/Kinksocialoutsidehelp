export type EventProfileId = 'camp' | 'hotel' | 'party' | 'conference'

export const EVENT_PROFILE_IDS: EventProfileId[] = ['camp', 'hotel', 'party', 'conference']

export type EventProfileLabelKey =
  | 'scheduledItem'
  | 'scheduledItemPlural'
  | 'leadPerson'
  | 'space'
  | 'volunteerBlock'
  | 'addItemCta'
  | 'attendeeGroup'
  | 'attendeeGroupType'
  | 'attendeeGroupRecruitment'

const LABELS: Record<EventProfileId, Record<EventProfileLabelKey, string>> = {
  camp: {
    scheduledItem: 'activity',
    scheduledItemPlural: 'activities',
    leadPerson: 'instructor',
    space: 'room',
    volunteerBlock: 'shift',
    addItemCta: 'Add activity',
    attendeeGroup: 'Attendee groups',
    attendeeGroupType: 'Tent city',
    attendeeGroupRecruitment: 'Seeking tentmates',
  },
  hotel: {
    scheduledItem: 'activity',
    scheduledItemPlural: 'activities',
    leadPerson: 'presenter',
    space: 'room',
    volunteerBlock: 'shift',
    addItemCta: 'Add activity',
    attendeeGroup: 'Attendee groups',
    attendeeGroupType: 'Room block',
    attendeeGroupRecruitment: 'Open beds in block',
  },
  party: {
    scheduledItem: 'activity',
    scheduledItemPlural: 'activities',
    leadPerson: 'host',
    space: 'room',
    volunteerBlock: 'shift',
    addItemCta: 'Add activity',
    attendeeGroup: 'Attendee groups',
    attendeeGroupType: 'Crew',
    attendeeGroupRecruitment: 'Join our crew',
  },
  conference: {
    scheduledItem: 'activity',
    scheduledItemPlural: 'activities',
    leadPerson: 'speaker',
    space: 'room',
    volunteerBlock: 'shift',
    addItemCta: 'Add activity',
    attendeeGroup: 'Attendee groups',
    attendeeGroupType: 'Group',
    attendeeGroupRecruitment: 'Room share group',
  },
}

export type AttendeeGroupTypeId = 'tent_city' | 'hotel_block' | 'cabin' | 'other'

export function defaultGroupTypeForProfile(profile: EventProfileId): AttendeeGroupTypeId {
  const map: Record<EventProfileId, AttendeeGroupTypeId> = {
    camp: 'tent_city',
    hotel: 'hotel_block',
    party: 'other',
    conference: 'other',
  }
  return map[profile]
}

export function groupTypeLabel(type: AttendeeGroupTypeId): string {
  const labels: Record<AttendeeGroupTypeId, string> = {
    tent_city: 'Tent city',
    hotel_block: 'Room block',
    cabin: 'Cabin',
    other: 'Other',
  }
  return labels[type]
}

export function parseEventProfile(raw: unknown): EventProfileId {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if ((EVENT_PROFILE_IDS as string[]).includes(s)) return s as EventProfileId
  return 'camp'
}

export function labelFor(profile: EventProfileId, key: EventProfileLabelKey): string {
  return LABELS[profile][key]
}

export function profileDisplayName(profile: EventProfileId): string {
  const names: Record<EventProfileId, string> = {
    camp: 'Multi-day camp / retreat',
    hotel: 'Hotel takeover',
    party: 'Single-venue party',
    conference: 'Conference-style',
  }
  return names[profile]
}
