export type EventSettingsPanelId =
  | 'guide'
  | 'basics'
  | 'branding'
  | 'gallery'
  | 'channels'
  | 'registration'
  | 'venue'
  | 'program'
  | 'policies-agreements'
  | 'attendee-guide'
  | 'attendee-profile'
  | 'team'
  | 'participation'
  | 'advanced'

export type EventSettingsTier = 'essential' | 'more' | 'advanced'

export const EVENT_SETTINGS_PANEL_PARAM = 'settingsPanel'

export const EVENT_SETTINGS_PANELS: {
  id: EventSettingsPanelId
  label: string
  description: string
  tier: EventSettingsTier
}[] = [
  { id: 'basics', label: 'Basics', description: 'Dates, timezone, publish state, and event profile.', tier: 'essential' },
  { id: 'branding', label: 'Public page', description: 'Titles and branding attendees see.', tier: 'essential' },
  { id: 'gallery', label: 'Gallery', description: 'Curated photos on the public More tab.', tier: 'more' },
  { id: 'channels', label: 'Chat channels', description: 'Attendee-only locks for org chat.', tier: 'more' },
  { id: 'registration', label: 'Registration', description: 'Ticket types and signup form.', tier: 'essential' },
  {
    id: 'policies-agreements',
    label: 'Policies & agreements',
    description: 'Policy documents, required types, and acceptance stats.',
    tier: 'essential',
  },
  { id: 'venue', label: 'Rooms & maps', description: 'Venue list and floor plans.', tier: 'essential' },
  { id: 'program', label: 'Tracks & tags', description: 'Program organization labels.', tier: 'more' },
  {
    id: 'attendee-guide',
    label: 'Attendee guide',
    description: 'Links and on-site notes on the public dancecard.',
    tier: 'more',
  },
  {
    id: 'attendee-profile',
    label: 'Attendee profile',
    description: 'Public card fields (photo, bio, contacts) on the Profile tab.',
    tier: 'more',
  },
  {
    id: 'participation',
    label: 'Participation',
    description: 'Presenter, vendor, staff, and volunteer apply windows.',
    tier: 'essential',
  },
  {
    id: 'team',
    label: 'Command team',
    description: 'Grant registration, staff ops, and scheduler access per convention.',
    tier: 'more',
  },
  { id: 'advanced', label: 'Advanced', description: 'Access codes, theme, and badge JSON.', tier: 'advanced' },
]

export const EVENT_SETTINGS_ESSENTIAL = EVENT_SETTINGS_PANELS.filter((p) => p.tier === 'essential')
export const EVENT_SETTINGS_MORE = EVENT_SETTINGS_PANELS.filter((p) => p.tier === 'more')

export const WIZARD_STORAGE_KEY = (eventSlug: string) => `dancecard-settings-wizard-done:${eventSlug.toLowerCase()}`

export const SETTINGS_FIELD_CLASS =
  'mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text placeholder:text-dc-muted/60 focus:border-dc-accent-border focus:outline-none focus:ring-1 focus:ring-dc-accent/30 disabled:opacity-50'

export const SETTINGS_LABEL_CLASS = 'block text-xs font-medium uppercase tracking-wide text-dc-muted'

/** Map legacy panel ids from bookmarks to the merged panel. */
export function normalizeSettingsPanelId(raw: string | null): EventSettingsPanelId | null {
  if (!raw) return null
  if (raw === 'policies' || raw === 'agreements') return 'policies-agreements'
  if (EVENT_SETTINGS_PANELS.some((p) => p.id === raw)) return raw as EventSettingsPanelId
  if (raw === 'guide') return 'guide'
  return null
}
