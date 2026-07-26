import type { UserEcosystemGroup, UserEcosystemOrg } from '@/lib/user-ecosystem'

export type AffiliationTier = 'lead' | 'staff' | 'member'

export type AffiliationItem = {
  key: string
  href: string
  name: string
  kind: 'org' | 'group'
  role: string
  tier: AffiliationTier
  logoUrl?: string | null
  bannerUrl?: string | null
}

export function normalizeMembershipRole(role: string | null | undefined): string {
  return (role ?? 'MEMBER').trim().toUpperCase() || 'MEMBER'
}

export function getAffiliationTier(role: string | null | undefined): AffiliationTier {
  const normalized = normalizeMembershipRole(role)
  if (normalized === 'OWNER' || normalized === 'ADMIN') return 'lead'
  if (normalized === 'MODERATOR' || normalized === 'STAFF') return 'staff'
  return 'member'
}

export function formatMembershipRoleLabel(role: string | null | undefined): string {
  const normalized = normalizeMembershipRole(role)
  if (normalized === 'OWNER') return 'Owner'
  return normalized.charAt(0) + normalized.slice(1).toLowerCase()
}

export function buildAffiliationItems(
  orgs: UserEcosystemOrg[],
  groups: UserEcosystemGroup[],
): AffiliationItem[] {
  const items: AffiliationItem[] = []

  for (const org of orgs) {
    items.push({
      key: `org-${org.slug}`,
      href: `/orgs/${encodeURIComponent(org.slug)}`,
      name: org.displayName,
      kind: 'org',
      role: org.role,
      tier: getAffiliationTier(org.role),
      logoUrl: org.logoUrl,
    })
  }

  for (const group of groups) {
    items.push({
      key: `group-${group.id}`,
      href: `/groups/${encodeURIComponent(group.id)}`,
      name: group.name,
      kind: 'group',
      role: group.role ?? 'member',
      tier: getAffiliationTier(group.role),
      logoUrl: group.logoUrl,
      bannerUrl: group.bannerUrl,
    })
  }

  const tierOrder: Record<AffiliationTier, number> = { lead: 0, staff: 1, member: 2 }
  return items.sort((a, b) => {
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier]
    if (tierDiff !== 0) return tierDiff
    if (a.kind !== b.kind) return a.kind === 'org' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export const AFFILIATION_SECTIONS: ReadonlyArray<{
  tier: AffiliationTier
  title: string
  hint: string
}> = [
  { tier: 'lead', title: 'Leading', hint: 'Organizations and groups they run' },
  { tier: 'staff', title: 'Staff & moderation', hint: 'Elevated team roles' },
  { tier: 'member', title: 'Member of', hint: 'Community participation' },
]
