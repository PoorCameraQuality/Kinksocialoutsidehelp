export type OrganizerTab =

  | 'dashboard'

  | 'program'

  | 'applications'

  | 'staff'

  | 'swaps'

  | 'vetting'

  | 'import'

  | 'settings'

  | 'people'

  | 'registrants'

  | 'venues'

  | 'assignments'

  | 'dm'

  | 'media'

  | 'exports'

  | 'messaging'

  | 'badges'

  | 'integrations'



/** Sub-tabs when `tab=people` (People hub). */

export type PeopleSubTab =
  | 'signups'
  | 'roster'
  | 'staff'
  | 'applications'
  | 'swaps'
  | 'badges'
  | 'coverage'
  | 'incidents'
  | 'compliance'



export const PEOPLE_SUB_TAB_PARAM = 'peopleTab'



export const ALL_PEOPLE_SUB_TABS: PeopleSubTab[] = [

  'signups',

  'roster',

  'staff',

  'applications',

  'swaps',

  'badges',

  'coverage',

  'incidents',

  'compliance',

]



export function isPeopleSubTab(value: string | null): value is PeopleSubTab {

  return value !== null && (ALL_PEOPLE_SUB_TABS as string[]).includes(value)

}



export type OrganizerNavItem = {

  key: OrganizerTab

  label: string

  description: string

}



export type OrganizerSidebarSection = {

  id: string

  label: string

  items: OrganizerNavItem[]

}



/** Sidebar navigation grouped by organizer job (generic ECKE platform). */

export const ORGANIZER_SIDEBAR_SECTIONS: OrganizerSidebarSection[] = [

  {

    id: 'home',

    label: 'Home',

    items: [

      {

        key: 'dashboard',

        label: 'Overview',

        description: 'Readiness checks and shortcuts for this event.',

      },

    ],

  },

  {

    id: 'schedule',

    label: 'Schedule',

    items: [

      {

        key: 'program',

        label: 'Program',

        description:

          'Build the schedule attendees see on the Program tab and their dancecards. Use the grid to place classes, then publish when ready.',

      },

      {

        key: 'venues',

        label: 'Room availability',

        description: 'Room availability across the event window.',

      },

      {

        key: 'import',

        label: 'Import',

        description: 'Bring in a schedule from CSV or a spreadsheet.',

      },

    ],

  },

  {

    id: 'applications',

    label: 'Applications',

    items: [

      {

        key: 'applications',

        label: 'Applications',

        description:
          'One control surface for presenter, educator, photographer, performer, volunteer, staff, and vendor applications. Open or close each window and review submissions.',

      },

    ],

  },

  {

    id: 'people',

    label: 'People',

    items: [

      {

        key: 'people',

        label: 'People',

        description: 'Signups, roster, staff, and trusted-role applications in one place.',

      },

    ],

  },

  {

    id: 'communications',

    label: 'Communications',

    items: [

      {

        key: 'messaging',

        label: 'Message campaign',

        description: 'Message going or interested people in kink.social Messaging with rich text and images.',

      },

    ],

  },

  {

    id: 'settings',

    label: 'Settings',

    items: [

      {

        key: 'settings',

        label: 'Settings',

        description: 'Setup guide, dates, branding, registration, policies, and agreements.',

      },

    ],

  },

  {

    id: 'tools',

    label: 'Tools',

    items: [

      {

        key: 'exports',

        label: 'Exports',

        description: 'Download schedules, directories, and reports.',

      },

      {

        key: 'integrations',

        label: 'Integrations',

        description: 'Sheets, API keys, RabbitSign, and external links.',

      },

    ],

  },

]



/** Legacy tabs still routable via redirects in OrganizerDancecardClient. */

export const LEGACY_PEOPLE_TABS: OrganizerTab[] = [

  'registrants',

  'vetting',

  'staff',

  'swaps',

  'badges',

  'dm',

]



export const ALL_ORGANIZER_TABS: OrganizerTab[] = [

  ...ORGANIZER_SIDEBAR_SECTIONS.flatMap((s) => s.items.map((i) => i.key)),

  ...LEGACY_PEOPLE_TABS.filter((t) => !ORGANIZER_SIDEBAR_SECTIONS.some((s) => s.items.some((i) => i.key === t))),

]



export function isOrganizerTab(value: string | null): value is OrganizerTab {

  return value !== null && (ALL_ORGANIZER_TABS as string[]).includes(value)

}



export function navItemForTab(tab: OrganizerTab): OrganizerNavItem | undefined {

  if (tab === 'people' || LEGACY_PEOPLE_TABS.includes(tab)) {

    return ORGANIZER_SIDEBAR_SECTIONS.find((s) => s.id === 'people')?.items[0]

  }

  for (const section of ORGANIZER_SIDEBAR_SECTIONS) {

    const hit = section.items.find((i) => i.key === tab)

    if (hit) return hit

  }

  return undefined

}



export function labelForTab(tab: OrganizerTab): string {

  return navItemForTab(tab)?.label ?? tab

}



export function descriptionForTab(tab: OrganizerTab): string {

  return navItemForTab(tab)?.description ?? ''

}



export function legacyTabToPeopleSubTab(tab: OrganizerTab): PeopleSubTab | null {

  const map: Partial<Record<OrganizerTab, PeopleSubTab>> = {

    registrants: 'signups',

    people: 'roster',

    staff: 'staff',

    vetting: 'applications',

    swaps: 'swaps',

    badges: 'badges',

    dm: 'coverage',

  }

  return map[tab] ?? null

}


