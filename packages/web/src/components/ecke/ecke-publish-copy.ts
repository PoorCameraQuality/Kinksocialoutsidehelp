export type EckeWriteKind =
  | 'group_listing'
  | 'event_listing'
  | 'education_article'
  | 'vendor_profile'
  | 'organization_listing'
  | 'dungeon_profile'
  | 'venue_profile'
  | 'convention_listing'
  | 'convention_event_anchor'
  | 'dancecard_event'
  | 'presenter_profile'

const LABELS: Record<EckeWriteKind, string> = {
  group_listing: 'group listing',
  event_listing: 'event',
  education_article: 'education article',
  vendor_profile: 'vendor profile',
  organization_listing: 'organization listing (deprecated)',
  dungeon_profile: 'place listing (legacy org path)',
  venue_profile: 'place listing',
  convention_listing: 'convention listing (deprecated)',
  convention_event_anchor: 'event on ECKE Events',
  dancecard_event: 'Dancecard (kink.social only)',
  presenter_profile: 'presenter profile',
}

const PRIVATE_DATA_NOTE =
  'Only the public-safe fields shown in the preview will be sent. Member lists, RSVP data, private addresses, staff notes, moderation data, and private messages are never sent.'

export const ECKE_FOUR_SURFACES_COPY =
  'East Coast Kink Events publishes four public surfaces from kink.social: Events, Places, Vendors, and Education.'

export function sourceKindLabel(writeKind: string): string {
  return LABELS[writeKind as EckeWriteKind] ?? 'listing'
}

export function publishWarningFor(writeKind: string): string {
  switch (writeKind as EckeWriteKind) {
    case 'event_listing':
      return `This will create or update a public event on ECKE Events (/events/{slug}). ${PRIVATE_DATA_NOTE}`
    case 'convention_event_anchor':
      return `This will publish or update this convention on ECKE Events (/events/{slug}) with Convention metadata. ${PRIVATE_DATA_NOTE}`
    case 'dancecard_event':
      return 'Dancecard program data is not synced to ECKE. Manage Dancecard on kink.social; ECKE event pages may link to it when public.'
    case 'education_article':
      return `This will create or update a public education article on ECKE Education (/education/{slug}). ${PRIVATE_DATA_NOTE}`
    case 'vendor_profile':
      return `This will create or update a public vendor profile on ECKE Vendors (/vendors/{slug}). ${PRIVATE_DATA_NOTE}`
    case 'organization_listing':
      return 'Organization profile pages are not published to ECKE. Publish events, places, vendors, or education instead.'
    case 'dungeon_profile':
    case 'venue_profile':
      return `This will create or update a public place listing on ECKE Places (/dungeons/{slug}). ${PRIVATE_DATA_NOTE}`
    case 'convention_listing':
      return `This will publish or update this convention on ECKE Events (/events/{slug}). ${PRIVATE_DATA_NOTE}`
    case 'presenter_profile':
      return `This will create or update a thin public presenter listing on ECKE (legacy webhook). ${PRIVATE_DATA_NOTE}`
    case 'group_listing':
    default:
      return `This will create or update a thin public group listing on ECKE (legacy webhook). ${PRIVATE_DATA_NOTE}`
  }
}

export function unpublishWarningFor(writeKind: string): string {
  switch (writeKind as EckeWriteKind) {
    case 'event_listing':
      return 'This will remove or hide the public ECKE event page. It will not delete the event on kink.social.'
    case 'convention_event_anchor':
      return 'This will remove or hide the public ECKE Events page for this convention. It will not delete the convention on kink.social.'
    case 'dancecard_event':
      return 'Dancecard is managed on kink.social only and is not removed from ECKE via this control.'
    case 'education_article':
      return 'This will remove or hide the public ECKE education article. It will not delete the article on kink.social.'
    case 'vendor_profile':
      return 'This will remove or hide the public ECKE vendor profile. It will not delete the vendor shop on kink.social.'
    case 'organization_listing':
      return 'Organization profile pages are not an ECKE public surface.'
    case 'dungeon_profile':
    case 'venue_profile':
      return 'This will remove or hide the public ECKE place listing. It will not delete the place on kink.social.'
    case 'convention_listing':
      return 'This will remove or hide the public ECKE Events page for this convention. It will not delete the convention on kink.social.'
    case 'presenter_profile':
      return 'This will remove or hide the public ECKE presenter listing. It will not delete the presenter profile on kink.social.'
    case 'group_listing':
    default:
      return 'This will remove or hide the public ECKE group listing. It will not delete the group on kink.social.'
  }
}

export const ECKE_PUBLISH_RESTRICTED_MESSAGES: Partial<Record<EckeWriteKind, string>> = {
  vendor_profile: 'Only the vendor owner or co-owner can publish this vendor profile to ECKE.',
  presenter_profile: 'Only the presenter owner can publish this presenter profile to ECKE.',
  venue_profile: 'Only the place submitter or linked organization moderator can publish this place.',
  convention_listing: 'Convention ECKE controls require full convention admin access.',
  convention_event_anchor: 'Convention ECKE controls require full convention admin access.',
  dancecard_event: 'Dancecard is not an ECKE publish target.',
}

export const ECKE_PANEL_ACCESS_MESSAGES: Partial<Record<EckeWriteKind, string>> = {
  vendor_profile:
    'You can preview this because you help manage the organization, but only the vendor owner or co-owner can publish it.',
  presenter_profile: 'Only the presenter owner can publish this presenter profile to ECKE.',
  venue_profile: 'Only the place submitter or linked organization moderator can publish this place.',
  convention_listing: 'Convention ECKE controls require full convention admin access.',
  convention_event_anchor: 'Convention ECKE controls require full convention admin access.',
  dancecard_event: 'Dancecard program data is not synced to ECKE.',
}
