import type { ConventionPublicSettings } from '../db/schema.js'

export function getProgramStaffAttendeeRoleAllowlist(settings: ConventionPublicSettings | null | undefined): string[] {
  const raw = settings?.programStaffAttendeeRoles
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
}

export function filterStaffRowsForAttendeeAllowlist<T extends { roleLabel: string }>(
  staff: T[],
  allowlist: string[],
): T[] {
  if (allowlist.length === 0) return []
  return staff.filter((st) =>
    allowlist.some((pat) => st.roleLabel.toLowerCase().includes(pat.toLowerCase())),
  )
}
