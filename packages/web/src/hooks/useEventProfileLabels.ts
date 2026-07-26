import {
  labelFor,
  parseEventProfile,
  type EventProfileId,
} from '@/lib/dancecard/eventProfile'

const LEGACY_LABELS = {
  sessionLabel: 'Session',
  sessionsLabel: 'Sessions',
  presenterLabel: 'Presenter',
  presentersLabel: 'Presenters',
  trackLabel: 'Track',
  tracksLabel: 'Tracks',
  roomLabel: 'Room',
  roomsLabel: 'Rooms',
}

type ProfileLabels = typeof LEGACY_LABELS & {
  scheduledItem: string
  scheduledItemPlural: string
  addItemCta: string
  leadPerson: string
  space: string
  volunteerBlock: string
}

function labelsForProfile(profile: EventProfileId): ProfileLabels {
  return {
    ...LEGACY_LABELS,
    scheduledItem: labelFor(profile, 'scheduledItem'),
    scheduledItemPlural: labelFor(profile, 'scheduledItemPlural'),
    addItemCta: labelFor(profile, 'addItemCta'),
    leadPerson: labelFor(profile, 'leadPerson'),
    space: labelFor(profile, 'space'),
    volunteerBlock: labelFor(profile, 'volunteerBlock'),
  }
}

/** Event profile label overrides for organizer UI. */
export function useEventProfileLabels(
  opts?: string | null | { eventSlug?: string; source?: string; eventProfile?: string | null },
) {
  const rawProfile =
    typeof opts === 'object' && opts ? opts.eventProfile : typeof opts === 'string' ? opts : null
  const profile = parseEventProfile(rawProfile)
  const labels = labelsForProfile(profile)
  return { labels, ...labels }
}
