import {
  type UserEcosystemPayload,
  vendorProfilePath,
} from '@/lib/user-ecosystem'

export type AccountManageShortcut = {
  label: string
  href: string
}

const ORG_MANAGE_ROLES = new Set(['OWNER', 'ADMIN', 'MODERATOR'])
const GROUP_MANAGE_ROLES = new Set(['owner', 'admin', 'moderator', 'mod'])

function canManageOrg(role: string): boolean {
  return ORG_MANAGE_ROLES.has(role.trim().toUpperCase())
}

function canManageGroup(role: string | null | undefined): boolean {
  return GROUP_MANAGE_ROLES.has((role ?? '').trim().toLowerCase())
}

/** Profile menu shortcuts — deep-link to organizer consoles and owned ecosystem surfaces. */
export function buildAccountManageShortcuts(
  ecosystem: UserEcosystemPayload | null,
): AccountManageShortcut[] {
  if (!ecosystem) {
    return [
      { label: 'Groups you manage', href: '/groups?tab=my' },
      { label: 'Organizations', href: '/orgs' },
      { label: 'List your shop', href: '/vendors/onboarding' },
      { label: 'Set up presenter profile', href: '/presenters/onboarding' },
    ]
  }

  const links: AccountManageShortcut[] = []
  const managedOrgs = ecosystem.orgs.filter((org) => canManageOrg(org.role))
  const managedGroups = ecosystem.groups.filter((group) => canManageGroup(group.role))

  if (managedOrgs.length === 0) {
    links.push({ label: 'Start an organization', href: '/orgs/new' })
  } else {
    for (const org of managedOrgs.slice(0, 3)) {
      links.push({
        label: `Manage ${org.displayName}`,
        href: `/organizer/orgs/${encodeURIComponent(org.slug)}`,
      })
    }
    if (managedOrgs.length > 3) {
      links.push({ label: 'All organizations', href: '/orgs' })
    }
  }

  if (managedGroups.length === 0) {
    links.push({ label: 'Create a group', href: '/groups/onboarding' })
  } else {
    for (const group of managedGroups.slice(0, 3)) {
      links.push({
        label: `Manage ${group.name}`,
        href: `/organizer/groups/${encodeURIComponent(group.id)}`,
      })
    }
    if (managedGroups.length > 3) {
      links.push({ label: 'Groups you manage', href: '/groups?tab=my' })
    }
  }

  if (ecosystem.vendor) {
    links.push({
      label: `Manage ${ecosystem.vendor.displayName}`,
      href: vendorProfilePath(ecosystem.vendor),
    })
  } else {
    links.push({ label: 'List your shop', href: '/vendors/onboarding' })
  }

  if (ecosystem.presenter) {
    links.push({
      label: 'Manage presenter profile',
      href: '/settings/ecosystem#presenter-catalog',
    })
  } else {
    links.push({ label: 'Set up presenter profile', href: '/presenters/onboarding' })
  }

  return links
}
