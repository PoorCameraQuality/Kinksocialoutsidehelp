import {
  type CommandRequirement,
  type ConventionCommandPermissions,
  commandPermissionIncludes,
} from '@c2k/shared'
import {
  ALL_PEOPLE_SUB_TABS,
  ORGANIZER_SIDEBAR_SECTIONS,
  type OrganizerSidebarSection,
  type OrganizerTab,
  type PeopleSubTab,
} from '@/components/dancecard/organizer/shell/organizerNavConfig'
import { tabAllowsWrite } from '@/lib/dancecard/conventionCommandPermissions'
import type { SetupTaskId } from '@/lib/dancecard/setupTasks'

export const TAB_PERMISSIONS: Record<OrganizerTab, CommandRequirement> = {
  dashboard: 'any',
  program: 'scheduler',
  applications: ['registration', 'scheduler'],
  venues: 'scheduler',
  import: 'scheduler',
  people: 'any',
  messaging: ['staff_ops', 'scheduler'],
  settings: 'admin',
  exports: 'staff_ops',
  integrations: 'admin',
  staff: 'staff_ops',
  swaps: 'staff_ops',
  vetting: 'registration',
  registrants: 'registration',
  assignments: 'scheduler',
  dm: 'staff_ops',
  media: 'staff_ops',
  badges: 'staff_ops',
}

export const PEOPLE_SUB_TAB_PERMISSIONS: Record<PeopleSubTab, CommandRequirement> = {
  signups: 'registration',
  roster: 'staff_ops',
  staff: 'staff_ops',
  applications: 'registration',
  swaps: 'staff_ops',
  badges: 'staff_ops',
  coverage: 'staff_ops',
  incidents: 'staff_ops',
  compliance: 'staff_ops',
}

export const SETUP_TASK_PERMISSIONS: Record<SetupTaskId, CommandRequirement> = {
  'quick-setup': 'admin',
  basics: 'admin',
  branding: 'admin',
  rooms: 'admin',
  'program-published': 'scheduler',
  import: 'scheduler',
  agreements: 'admin',
  staff: 'staff_ops',
  registration: 'admin',
}

export function isSetupTaskAllowed(taskId: SetupTaskId, permissions: ConventionCommandPermissions): boolean {
  return commandPermissionIncludes(SETUP_TASK_PERMISSIONS[taskId], permissions)
}

export function isTabAllowed(tab: OrganizerTab, permissions: ConventionCommandPermissions): boolean {
  if (tab === 'people') {
    return filterPeopleSubTabs(ALL_PEOPLE_SUB_TABS, permissions).length > 0
  }
  return commandPermissionIncludes(TAB_PERMISSIONS[tab] ?? 'any', permissions)
}

export function filterPeopleSubTabs(
  tabs: PeopleSubTab[],
  permissions: ConventionCommandPermissions,
): PeopleSubTab[] {
  return tabs.filter((t) => commandPermissionIncludes(PEOPLE_SUB_TAB_PERMISSIONS[t], permissions))
}

const MUNCH_PEOPLE_SUB_TABS = new Set<PeopleSubTab>(['signups', 'roster'])

/** Identity Phase 7 - simplified People hub for munch-scale events. */
export function filterPeopleSubTabsForTemplate(
  tabs: PeopleSubTab[],
  template: 'full' | 'munch',
  permissions: ConventionCommandPermissions,
): PeopleSubTab[] {
  const allowed = filterPeopleSubTabs(tabs, permissions)
  if (template !== 'munch') return allowed
  return allowed.filter((t) => MUNCH_PEOPLE_SUB_TABS.has(t))
}

export function filterNavByPermissions(
  sections: OrganizerSidebarSection[],
  permissions: ConventionCommandPermissions,
): OrganizerSidebarSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isTabAllowed(item.key, permissions)),
    }))
    .filter((section) => section.items.length > 0)
}

export function firstAllowedTab(permissions: ConventionCommandPermissions): OrganizerTab {
  for (const section of ORGANIZER_SIDEBAR_SECTIONS) {
    for (const item of section.items) {
      if (isTabAllowed(item.key, permissions)) return item.key
    }
  }
  return 'dashboard'
}

export function readOnlyForPeopleSubTab(
  subTab: PeopleSubTab,
  permissions: ConventionCommandPermissions,
): boolean {
  return !tabAllowsWrite(PEOPLE_SUB_TAB_PERMISSIONS[subTab], permissions)
}

export function readOnlyForTab(
  tab: OrganizerTab,
  permissions: ConventionCommandPermissions,
): boolean {
  if (tab === 'people') {
    const allowed = filterPeopleSubTabs(ALL_PEOPLE_SUB_TABS, permissions)
    return allowed.every((t) => readOnlyForPeopleSubTab(t, permissions))
  }
  const req = TAB_PERMISSIONS[tab]
  if (!req) return true
  return !commandPermissionIncludes(req, permissions)
}
