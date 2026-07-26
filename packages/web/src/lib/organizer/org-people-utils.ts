import type { OrgMemberRow } from '@/components/organizer/admin/OrgMemberAdminPanel'

export type MemberFilter =
  | 'all'
  | 'owner_admin'
  | 'MODERATOR'
  | 'STAFF'
  | 'MEMBER'
  | 'visible'
  | 'hidden'

export type PeopleStats = {
  total: number
  ownersAdmins: number
  moderators: number
  staff: number
  visible: number
  hidden: number
}

export function computePeopleStats(members: OrgMemberRow[]): PeopleStats {
  let ownersAdmins = 0
  let moderators = 0
  let staff = 0
  let visible = 0
  for (const m of members) {
    if (m.role === 'OWNER' || m.role === 'ADMIN') ownersAdmins++
    if (m.role === 'MODERATOR') moderators++
    if (m.role === 'STAFF') staff++
    if (m.listedInOrgDirectory) visible++
  }
  return {
    total: members.length,
    ownersAdmins,
    moderators,
    staff,
    visible,
    hidden: members.length - visible,
  }
}

export function filterMembers(
  members: OrgMemberRow[],
  query: string,
  roleFilter: MemberFilter,
): OrgMemberRow[] {
  const q = query.trim().toLowerCase()
  return members.filter((m) => {
    if (roleFilter === 'owner_admin' && m.role !== 'OWNER' && m.role !== 'ADMIN') return false
    if (roleFilter !== 'all' && roleFilter !== 'owner_admin' && roleFilter !== 'visible' && roleFilter !== 'hidden') {
      if (m.role !== roleFilter) return false
    }
    if (roleFilter === 'visible' && !m.listedInOrgDirectory) return false
    if (roleFilter === 'hidden' && m.listedInOrgDirectory) return false
    if (!q) return true
    const name = (m.displayName ?? '').toLowerCase()
    const user = m.username.toLowerCase()
    return name.includes(q) || user.includes(q)
  })
}

const ROLE_ORDER = ['OWNER', 'ADMIN', 'MODERATOR', 'STAFF', 'MEMBER'] as const

export function sortMembers(members: OrgMemberRow[]): OrgMemberRow[] {
  return [...members].sort((a, b) => ROLE_ORDER.indexOf(a.role as (typeof ROLE_ORDER)[number]) - ROLE_ORDER.indexOf(b.role as (typeof ROLE_ORDER)[number]))
}

export function isSoleOwner(members: OrgMemberRow[], member: OrgMemberRow): boolean {
  if (member.role !== 'OWNER') return false
  return members.filter((m) => m.role === 'OWNER').length === 1
}

export const ORGANIZER_ACCESS: Record<string, string[]> = {
  OWNER: ['Full console access', 'Settings & publishing', 'Role management', 'All moderation'],
  ADMIN: ['Full console access', 'Settings & publishing', 'Role management', 'All moderation'],
  MODERATOR: ['Communications tab', 'Moderation queues', 'No organization settings'],
  STAFF: ['People & volunteer tags', 'Program assignments where supported', 'No settings access'],
  MEMBER: ['Public hub participation', 'No organizer console'],
}

export const ROLE_GUIDE = [
  {
    role: 'Owner / Admin',
    console: 'Full organization control, including settings, roles, content, publishing, and moderation.',
    public: 'Shown as leadership on the public hub Overview.',
  },
  {
    role: 'Moderator',
    console: 'Can help manage communications and moderation queues without changing organization settings.',
    public: 'Can moderate forums and chat on the public hub.',
  },
  {
    role: 'Staff',
    console: 'Can assist with people, volunteer tags, and event or convention assignments where supported.',
    public: 'May appear on program pages when assigned; tags on Overview when listed.',
  },
  {
    role: 'Member',
    console: 'Can participate in the public hub. No organizer access unless promoted.',
    public: 'Directory listing only when they opt in to public visibility.',
  },
] as const
