import { roleKindMeta } from '@/lib/dancecard/registrationCategoryRoleKinds'

export type PersonCompPackage = {
  registrantId: string
  categoryId: string
  categoryName: string
  accessCode: string | null
  roleKind: string
  roleKindLabel: string
  expectedHours: number | null
}

export function formatServiceHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '-'
  const h = Number(hours)
  if (h <= 0) return 'None required'
  return `${h} hr${h === 1 ? '' : 's'}`
}

export function roleKindLabelFor(kind: string): string {
  return roleKindMeta(kind).label
}
