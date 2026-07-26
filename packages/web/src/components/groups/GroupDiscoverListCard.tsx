import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import TagLink from '@/components/TagLink'
import type { GroupDiscoverCardGroup } from '@/components/groups/GroupDiscoverCard'
import type { GroupAccess, GroupDiscoverBadge } from '@/lib/groups-page-utils'
import { deriveGroupAccess, groupActivityLabel } from '@/lib/groups-page-utils'

type Props = {
  group: GroupDiscoverCardGroup
  badge?: GroupDiscoverBadge | null
  friendsHere?: number
  /** Privacy-safe scope context (e.g. "Suggested from your region"). */
  recommendation?: string | null
}

/** Quiet access/privacy pill — a colored dot + muted label, not a loud chip. */
const ACCESS_DOT: Record<GroupAccess, string> = {
  Public: 'bg-emerald-400/80',
  'Approval required': 'bg-amber-400/80',
  Private: 'bg-dc-muted',
  'Invite only': 'bg-violet-400/80',
}

function AccessPill({ access }: { access: GroupAccess }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dc-border/70 bg-dc-elevated-muted/60 px-2 py-0.5 text-[11px] font-medium text-dc-text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${ACCESS_DOT[access]}`} aria-hidden />
      {access}
    </span>
  )
}

export default function GroupDiscoverListCard({ group, badge, friendsHere, recommendation }: Props) {
  const location = group.placeLabel ?? group.location
  const snippet = group.descriptionSnippet ?? group.description
  const access = deriveGroupAccess(group)
  const activity = groupActivityLabel(group, badge)

  const metaParts = [
    group.category,
    `${group.members.toLocaleString()} member${group.members === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[]

  return (
    <article className="group/card rounded-2xl border border-dc-border/80 bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)] transition-colors hover:border-dc-accent-border/30 focus-within:border-dc-accent-border/40">
      <div className="flex gap-3 sm:gap-4">
        <Link
          to={`/groups/${group.id}`}
          className="relative shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
          aria-label={`${group.name} — view group`}
        >
          <div className="h-16 w-16 overflow-hidden rounded-xl bg-gradient-to-br from-violet-950/60 via-dc-elevated-muted to-amber-950/40 sm:h-[72px] sm:w-[72px]">
            {group.coverImageUrl ?
              <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            : <div className="flex h-full w-full items-center justify-center text-dc-muted" aria-hidden>
                <svg className="h-8 w-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            }
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 text-base font-semibold leading-tight text-dc-text sm:text-[17px]">
              <Link
                to={`/groups/${group.id}`}
                className="rounded hover:text-dc-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
              >
                {group.name}
              </Link>
            </h3>
            <AccessPill access={access} />
            {activity ?
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300/90">
                {activity}
              </span>
            : null}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-dc-muted">
            {metaParts.map((part, i) => (
              <span key={part} className={i === 0 && group.category ? 'font-medium text-dc-text-muted' : ''}>
                {i > 0 ? <span className="mr-1.5 text-dc-border" aria-hidden>·</span> : null}
                {part}
              </span>
            ))}
            {location ?
              <span className="inline-flex items-center gap-1">
                <span className="text-dc-border" aria-hidden>·</span>
                <svg className="h-3 w-3 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {location}
                {group.distanceMi != null ? ` · ${group.distanceMi} mi` : null}
              </span>
            : null}
            {friendsHere != null && friendsHere > 0 ?
              <span className="text-dc-accent">
                <span className="mr-1.5 text-dc-border" aria-hidden>·</span>
                {friendsHere} friend{friendsHere === 1 ? '' : 's'} here
              </span>
            : null}
          </p>

          {snippet ?
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-dc-text-muted">{snippet}</p>
          : null}

          {group.tags && group.tags.length > 0 ?
            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.tags.slice(0, 4).map((t) => (
                <TagLink key={t} tag={t} />
              ))}
            </div>
          : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {group.memberAvatars && group.memberAvatars.length > 0 ?
                <div className="flex -space-x-1.5">
                  {group.memberAvatars.slice(0, 4).map((m) =>
                    m.avatarUrl ?
                      <img
                        key={m.userId}
                        src={m.avatarUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover ring-2 ring-dc-elevated-solid"
                      />
                    : <PlaceholderAvatar
                        key={m.userId}
                        size="sm"
                        className="!h-6 !w-6 !rounded-full ring-2 ring-dc-elevated-solid"
                      />,
                  )}
                </div>
              : null}
              {recommendation ?
                <span className="truncate text-xs text-dc-text-muted">{recommendation}</span>
              : null}
            </div>

            <Link
              to={`/groups/${group.id}`}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text transition-colors hover:border-dc-accent-border/50 hover:text-dc-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
            >
              View group
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
