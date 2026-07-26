import {
  type CommandRequirement,
  type ConventionCommandPermissions,
  commandPermissionIncludes,
  emptyCommandPermissions,
  hasAnyCommandPermission,
} from '@c2k/shared'

export type { ConventionCommandPermissions, CommandPermissionDomain } from '@c2k/shared'

export function canEditCommandTeam(permissions: ConventionCommandPermissions): boolean {
  return permissions.canManageTeam
}

export function canEditVettingSafetyNotes(permissions: ConventionCommandPermissions): boolean {
  return permissions.isFullAdmin || permissions.registration
}

export function canSeeRegistrantInternalNotes(permissions: ConventionCommandPermissions): boolean {
  return permissions.isFullAdmin || permissions.registration || permissions.staffOps
}

export function canMutateInCommandBridge(permissions: ConventionCommandPermissions): boolean {
  return hasAnyCommandPermission(permissions)
}

export function tabAllowsWrite(
  requirement: CommandRequirement,
  permissions: ConventionCommandPermissions,
): boolean {
  return commandPermissionIncludes(requirement, permissions)
}

export { emptyCommandPermissions }
