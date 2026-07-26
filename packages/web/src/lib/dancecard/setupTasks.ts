import type { OrganizerTab, PeopleSubTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'

export type SetupTaskId =
  | 'quick-setup'
  | 'basics'
  | 'branding'
  | 'rooms'
  | 'program-published'
  | 'import'
  | 'agreements'
  | 'staff'
  | 'registration'

export type SetupTaskGroup = 'essential' | 'optional'

export type SetupTaskHref = {
  tab: OrganizerTab
  settingsPanel?: string
  peopleTab?: PeopleSubTab
  publishFilter?: 'draft'
  venuesPanel?: 'setup'
}

export type SetupTaskDef = {
  id: SetupTaskId
  label: string
  description: string
  group: SetupTaskGroup
  dependsOn?: SetupTaskId[]
  href: SetupTaskHref
}

export const SETUP_TASKS: SetupTaskDef[] = [
  {
    id: 'quick-setup',
    label: 'Run quick setup',
    description: 'Optional 10-minute walkthrough for first-time organizers.',
    group: 'optional',
    href: { tab: 'settings', settingsPanel: 'guide' },
  },
  {
    id: 'basics',
    label: 'Set event dates and timezone',
    description: 'Define when your event runs so rooms and the program grid unlock.',
    group: 'essential',
    href: { tab: 'settings', settingsPanel: 'basics' },
  },
  {
    id: 'branding',
    label: 'Name and brand the public page',
    description: 'Titles and imagery attendees see on the dancecard.',
    group: 'essential',
    dependsOn: ['basics'],
    href: { tab: 'settings', settingsPanel: 'branding' },
  },
  {
    id: 'rooms',
    label: 'Add rooms',
    description: 'Named rooms keep imports, maps, and the program grid consistent.',
    group: 'essential',
    dependsOn: ['basics'],
    href: { tab: 'venues', venuesPanel: 'setup' },
  },
  {
    id: 'program-published',
    label: 'Publish classes on the program',
    description: 'Only published activities appear on the attendee schedule.',
    group: 'essential',
    dependsOn: ['basics'],
    href: { tab: 'program', publishFilter: 'draft' },
  },
  {
    id: 'import',
    label: 'Import a schedule (or skip)',
    description: 'Bring in CSV or spreadsheet rows, then publish to the program grid.',
    group: 'optional',
    dependsOn: ['basics'],
    href: { tab: 'import' },
  },
  {
    id: 'agreements',
    label: 'Configure policies and agreements',
    description: 'Required policy types and signing workflow for registrants.',
    group: 'essential',
    href: { tab: 'settings', settingsPanel: 'policies-agreements' },
  },
  {
    id: 'staff',
    label: 'Add staff shifts',
    description: 'Coverage and volunteer shifts for safety and operations.',
    group: 'optional',
    dependsOn: ['basics'],
    href: { tab: 'people', peopleTab: 'staff' },
  },
  {
    id: 'registration',
    label: 'Set up registration',
    description: 'Ticket categories and a published signup form.',
    group: 'essential',
    href: { tab: 'settings', settingsPanel: 'registration' },
  },
]

export const IMPORT_SKIP_STORAGE_KEY = (eventSlug: string) =>
  `dancecard-import-skipped:${eventSlug.toLowerCase()}`

export const SETUP_LIFECYCLE_COLLAPSED_KEY = (eventSlug: string) =>
  `dancecard-setup-collapsed:${eventSlug.toLowerCase()}`
