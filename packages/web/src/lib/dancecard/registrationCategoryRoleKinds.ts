export const REGISTRATION_ROLE_KINDS = [
  { id: 'attendee', label: 'Attendee', defaultName: 'Weekend pass', defaultHours: null as number | null, defaultStaffUnlock: false },
  { id: 'staff', label: 'Staff', defaultName: 'Staff', defaultHours: 8, defaultStaffUnlock: true },
  { id: 'volunteer', label: 'Volunteer', defaultName: 'Volunteer', defaultHours: 4, defaultStaffUnlock: true },
  { id: 'presenter', label: 'Presenter', defaultName: 'Presenter', defaultHours: null, defaultStaffUnlock: false },
  { id: 'photographer', label: 'Photographer', defaultName: 'Photographer', defaultHours: null, defaultStaffUnlock: false },
  { id: 'vendor', label: 'Vendor', defaultName: 'Vendor', defaultHours: null, defaultStaffUnlock: false },
  { id: 'comp', label: 'Comp / guest', defaultName: 'Comp guest', defaultHours: null, defaultStaffUnlock: false },
  { id: 'other', label: 'Other (custom name)', defaultName: '', defaultHours: null, defaultStaffUnlock: false },
] as const

export type RegistrationRoleKind = (typeof REGISTRATION_ROLE_KINDS)[number]['id']

export const REGISTRATION_ROLE_KIND_IDS = REGISTRATION_ROLE_KINDS.map((r) => r.id) as [
  RegistrationRoleKind,
  ...RegistrationRoleKind[],
]

export function isRegistrationRoleKind(value: string): value is RegistrationRoleKind {
  return (REGISTRATION_ROLE_KIND_IDS as string[]).includes(value)
}

export function roleKindMeta(kind: string) {
  return REGISTRATION_ROLE_KINDS.find((r) => r.id === kind) ?? REGISTRATION_ROLE_KINDS.find((r) => r.id === 'other')!
}

export function formatCategoryOptionLabel(name: string, expectedHours: number | null): string {
  if (expectedHours === null || Number.isNaN(expectedHours)) return name
  const h = Number(expectedHours)
  if (h <= 0) return name
  return `${name} (${h} hr${h === 1 ? '' : 's'} service)`
}
