import type { PeopleSubTab } from '@/components/dancecard/organizer/shell/organizerNavConfig'

export const PERSON_PARAM = 'person'
export const REGISTRANT_PARAM = 'registrant'
export const PEOPLE_ACTION_PARAM = 'peopleAction'

export type PeopleAction = 'addSignup' | 'importSignups' | 'addShift'

export const PEOPLE_TAB_LABELS: Record<PeopleSubTab, string> = {
  signups: 'Signups',
  roster: 'Roster',
  staff: 'Staff shifts',
  applications: 'Applications',
  swaps: 'Shift swaps',
  badges: 'Badges',
  coverage: 'Coverage',
  incidents: 'Safety incidents',
  compliance: 'Compliance',
}

export type PeopleTabGroup = {
  id: string
  label: string
  tabs: PeopleSubTab[]
}

export const PEOPLE_TAB_GROUPS: PeopleTabGroup[] = [
  {
    id: 'registration',
    label: 'Registration',
    tabs: ['signups', 'badges'],
  },
  {
    id: 'directory',
    label: 'Directory',
    tabs: ['roster'],
  },
  {
    id: 'staffing',
    label: 'Staffing',
    tabs: ['staff', 'coverage', 'swaps', 'compliance'],
  },
  {
    id: 'trust',
    label: 'Trust & Safety',
    tabs: ['applications', 'incidents'],
  },
]

export function groupedPeopleTabs(allowed: PeopleSubTab[]): PeopleTabGroup[] {
  const set = new Set(allowed)
  return PEOPLE_TAB_GROUPS.map((g) => ({
    ...g,
    tabs: g.tabs.filter((t) => set.has(t)),
  })).filter((g) => g.tabs.length > 0)
}
