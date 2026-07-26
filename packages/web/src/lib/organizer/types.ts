export const ORGANIZER_TABS = [
  'home',
  'schedule',
  'people',
  'communications',
  'moderation',
  'ecke',
  'payments',
  'payments-setup',
  'settings',
  'tools',
] as const

export type OrganizerTab = (typeof ORGANIZER_TABS)[number]

export const ORGANIZER_TAB_LABELS: Record<OrganizerTab, string> = {
  home: 'Home',
  schedule: 'Events & conventions',
  people: 'People',
  communications: 'Communications',
  moderation: 'Moderation',
  ecke: 'ECKE Publish',
  payments: 'Payments',
  'payments-setup': 'Payments setup',
  settings: 'Settings',
  tools: 'Tools',
}

export function parseOrganizerTab(raw: string | null): OrganizerTab {
  if (raw && ORGANIZER_TABS.includes(raw as OrganizerTab)) return raw as OrganizerTab
  return 'home'
}

export type OrganizerScopeOrg = {
  id: string
  slug: string
  displayName: string
  role: string
}

export type OrganizerScopeGroup = {
  id: string
  slug: string
  name: string
  role: string
  organizationId?: string | null
  parentOrganizationSlug?: string | null
}

export function canAccessOrganizerSettings(orgRole: string | null, groupRole: string | null): boolean {
  if (orgRole === 'OWNER' || orgRole === 'ADMIN') return true
  if (groupRole === 'owner' || groupRole === 'admin' || groupRole === 'moderator') return true
  return false
}

/** Org moderation tab and report queues - not available to STAFF volunteers. */
export function canAccessOrganizerModeration(orgRole: string | null): boolean {
  if (!orgRole) return false
  return orgRole === 'OWNER' || orgRole === 'ADMIN' || orgRole === 'MODERATOR'
}

/** Group settings tab: group mod or parent org owner (not org admin alone). */
export function canAccessGroupOrganizerSettings(parentOrgRole: string | null, groupRole: string | null): boolean {
  if (parentOrgRole === 'OWNER') return true
  const normalized = groupRole?.toLowerCase() ?? ''
  return normalized === 'owner' || normalized === 'admin' || normalized === 'moderator'
}
