import type { UserEcosystemPayload } from '@/lib/user-ecosystem'

import ProfileCard from './ProfileCard'

import { profileStoryEyebrow } from './profile-story-classes'

import { IconUsers } from './ProfileStoryIcons'

type Props = {
  ecosystem: UserEcosystemPayload | null
  memberSince?: string | null
  roles: string[]
  lifestyleActivity?: string | null
  eventsAttended?: number
}

type SnapshotStatProps = {
  value: number
  label: string
  emptyHint?: string
}

function SnapshotStat({ value, label, emptyHint }: SnapshotStatProps) {
  return (
    <div className="rounded-xl border border-dc-border-subtle/55 bg-dc-surface-muted/70 px-3 py-3">
      <p className="text-2xl font-bold tabular-nums tracking-tight text-dc-text">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-dc-muted/80">{label}</p>
      {value === 0 && emptyHint ?
        <p className="mt-1 text-[10px] leading-snug text-dc-muted/70">{emptyHint}</p>
      : null}
    </div>
  )
}

/** At-a-glance activity — references and writing live under Community / Media tabs. */
export default function ProfileCommunitySnapshotCard({
  ecosystem,
  memberSince,
  roles,
  lifestyleActivity,
  eventsAttended = 0,
}: Props) {
  const upcoming = ecosystem?.upcomingEvents.length ?? 0
  const orgCount = ecosystem?.orgs.length ?? 0
  const groupCount = ecosystem?.groups.length ?? 0
  const isOrganizer = ecosystem?.orgs.some((o) => /organizer|host|admin/i.test(o.role)) ?? false
  const isEducator = Boolean(ecosystem?.presenter?.headline?.trim())

  const communityRoles = [
    ...(isOrganizer ? ['Event host'] : []),
    ...(isEducator ? ['Educator'] : []),
    ...(lifestyleActivity ? [lifestyleActivity] : []),
    ...roles.slice(0, 2),
  ].filter((v, i, a) => a.indexOf(v) === i)

  const affiliationParts = [
    orgCount > 0 ? `${orgCount} org${orgCount === 1 ? '' : 's'}` : null,
    groupCount > 0 ? `${groupCount} group${groupCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean)

  return (
    <ProfileCard title="At a glance" icon={<IconUsers />}>
      <div className="grid grid-cols-2 gap-2.5">
        <SnapshotStat value={upcoming} label="Upcoming events" emptyHint="None listed publicly" />
        <SnapshotStat value={eventsAttended} label="Events attended" emptyHint="Not shared yet" />
      </div>

      {affiliationParts.length > 0 ?
        <p className="mt-4 text-xs text-dc-text-muted">
          Active in{' '}
          <span className="font-medium text-dc-text/90">{affiliationParts.join(' · ')}</span>
        </p>
      : null}

      {communityRoles.length > 0 ?
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className={profileStoryEyebrow}>Community roles</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {communityRoles.map((role) => (
              <li
                key={role}
                className="rounded-full border border-dc-accent/20 bg-dc-accent/[0.08] px-2.5 py-1 text-[11px] font-medium text-dc-accent"
              >
                {role}
              </li>
            ))}
          </ul>
        </div>
      : null}

      {memberSince ?
        <p className="mt-4 border-t border-white/[0.06] pt-4 text-xs text-dc-muted/80">
          Member since <span className="text-dc-text/90">{memberSince}</span>
        </p>
      : null}
    </ProfileCard>
  )
}
