/** Granular Event Systems command-bridge permission domains. */
export type CommandPermissionDomain = 'registration' | 'staff_ops' | 'scheduler'

export type ConventionCommandPermissions = {
  registration: boolean
  staffOps: boolean
  scheduler: boolean
  /** Org OWNER or ADMIN - implicit full access. */
  isFullAdmin: boolean
  /** Can grant/revoke convention command team members. */
  canManageTeam: boolean
}

/**
 * What a route or UI action needs from convention command permissions.
 * any means any command domain: registration, staff_ops, or scheduler.
 * It is not TypeScript any and not full platform access.
 */
export type CommandRequirement =
  | 'any'
  | 'admin'
  | CommandPermissionDomain
  | CommandPermissionDomain[]

export function emptyCommandPermissions(): ConventionCommandPermissions {
  return {
    registration: false,
    staffOps: false,
    scheduler: false,
    isFullAdmin: false,
    canManageTeam: false,
  }
}

export function fullCommandPermissions(): ConventionCommandPermissions {
  return {
    registration: true,
    staffOps: true,
    scheduler: true,
    isFullAdmin: true,
    canManageTeam: true,
  }
}

/** True when the viewer has full admin or at least one command domain. */
export function hasAnyCommandPermission(permissions: ConventionCommandPermissions): boolean {
  return (
    permissions.isFullAdmin ||
    permissions.registration ||
    permissions.staffOps ||
    permissions.scheduler
  )
}

/**
 * Whether permissions meet a command-bridge requirement.
 * Full org admins always pass. any needs at least one domain.
 */
export function commandPermissionIncludes(
  requirement: CommandRequirement,
  permissions: ConventionCommandPermissions,
): boolean {
  if (permissions.isFullAdmin) return true
  if (requirement === 'any') return hasAnyCommandPermission(permissions)
  if (requirement === 'admin') return permissions.isFullAdmin
  const requiredDomains = Array.isArray(requirement) ? requirement : [requirement]
  return requiredDomains.some((domain) => {
    if (domain === 'registration') return permissions.registration
    if (domain === 'staff_ops') return permissions.staffOps
    if (domain === 'scheduler') return permissions.scheduler
    return false
  })
}
