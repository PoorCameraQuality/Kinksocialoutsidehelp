const ROLE_KIND_LABELS: Record<string, string> = {
  attendee: 'Attendee',
  staff: 'Staff',
  volunteer: 'Volunteer',
  presenter: 'Presenter',
  photographer: 'Photographer',
  vendor: 'Vendor',
  comp: 'Comp / guest',
  other: 'Other',
}

export function inferRoleKindFromCategoryName(categoryName: string): string {
  const n = categoryName.toLowerCase()
  if (/presenter|faculty|instructor|teacher/.test(n)) return 'presenter'
  if (/staff|volunteer|crew|ops|dm\b|producer/.test(n)) return 'staff'
  if (/photo/.test(n)) return 'photographer'
  if (/vendor|dealer|tabler/.test(n)) return 'vendor'
  if (/comp|guest|vip/.test(n)) return 'comp'
  return 'attendee'
}

export function roleKindLabel(kind: string): string {
  return ROLE_KIND_LABELS[kind] ?? ROLE_KIND_LABELS.other!
}

export const REGISTRANT_STATUS_VALUES = [
  'imported',
  'pending',
  'confirmed',
  'cancelled',
  'waitlisted',
  'checked_in',
  'registered',
] as const

export const VETTING_STATUS_VALUES = ['none', 'pending', 'approved', 'rejected', 'hold'] as const

export function normalizeRegistrationStatus(status: string | undefined): string | undefined {
  if (!status || status === 'registered') return status === 'registered' ? 'confirmed' : undefined
  if (status === 'checked_in') return 'checked_in'
  return status
}

export function displayRegistrationStatus(
  registrationStatus: string | null | undefined,
  checkedInAt: Date | null | undefined,
): string {
  if (checkedInAt) return 'checked_in'
  return registrationStatus ?? 'confirmed'
}
