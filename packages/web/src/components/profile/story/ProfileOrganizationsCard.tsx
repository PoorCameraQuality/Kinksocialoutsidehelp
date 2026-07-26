import { Link } from 'react-router-dom'

import MemberRoleBadge from '@/components/organizer/people/MemberRoleBadge'
import {
  AFFILIATION_SECTIONS,
  buildAffiliationItems,
  normalizeMembershipRole,
  type AffiliationItem,
  type AffiliationTier,
} from '@/lib/ecosystem-affiliation'
import type { UserEcosystemPayload } from '@/lib/user-ecosystem'

import ProfileCard from './ProfileCard'
import ProfileEntityAvatar from './ProfileEntityAvatar'
import { profileStoryEyebrow, profileStoryNestedRow } from './profile-story-classes'
import { IconBuilding } from './ProfileStoryIcons'

type Props = {
  ecosystem: UserEcosystemPayload | null
  username?: string
}

const MAX_PER_SECTION = 4

function AffiliationRow({ item }: { item: AffiliationItem }) {
  return (
    <Link to={item.href} className={profileStoryNestedRow}>
      <ProfileEntityAvatar
        label={item.name}
        imageUrl={item.logoUrl ?? item.bannerUrl}
        variant={item.kind === 'org' || item.logoUrl ? 'logo' : 'photo'}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-dc-text">{item.name}</span>
          <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-dc-muted">
            {item.kind === 'org' ? 'Org' : 'Group'}
          </span>
        </span>
        <span className="mt-1 inline-flex">
          <MemberRoleBadge role={normalizeMembershipRole(item.role)} />
        </span>
      </span>
    </Link>
  )
}

function AffiliationSection({
  title,
  hint,
  items,
  username,
  tier,
}: {
  title: string
  hint: string
  items: AffiliationItem[]
  username?: string
  tier: AffiliationTier
}) {
  if (items.length === 0) return null

  const visible = items.slice(0, MAX_PER_SECTION)
  const hiddenCount = items.length - visible.length

  return (
    <div className="not-first:mt-5 not-first:border-t not-first:border-white/[0.06] not-first:pt-5">
      <p className={profileStoryEyebrow}>{title}</p>
      <p className="mt-1 text-[11px] leading-snug text-dc-muted/75">{hint}</p>
      <ul className="mt-3 space-y-2.5">
        {visible.map((item) => (
          <li key={item.key}>
            <AffiliationRow item={item} />
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && username && tier === 'member' ?
        <Link
          to={`/profile/${encodeURIComponent(username)}?tab=Groups`}
          className="mt-3 inline-block text-xs font-medium text-dc-accent hover:underline"
        >
          View {hiddenCount} more
        </Link>
      : null}
    </div>
  )
}

export default function ProfileOrganizationsCard({ ecosystem, username }: Props) {
  const orgs = ecosystem?.orgs ?? []
  const groups = ecosystem?.groups ?? []
  if (orgs.length === 0 && groups.length === 0) return null

  const items = buildAffiliationItems(orgs, groups)

  return (
    <ProfileCard title="Organizations & Groups" icon={<IconBuilding />}>
      {AFFILIATION_SECTIONS.map((section) => (
        <AffiliationSection
          key={section.tier}
          tier={section.tier}
          title={section.title}
          hint={section.hint}
          items={items.filter((item) => item.tier === section.tier)}
          username={username}
        />
      ))}
    </ProfileCard>
  )
}
