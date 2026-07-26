import { Link } from 'react-router-dom'
import TagLink from '@/components/TagLink'
import type { GroupDiscoverBadge } from '@/lib/groups-page-utils'
import { GROUP_CATEGORIES } from '@c2k/shared'

export type GroupDiscoverCardGroup = {
  id: string
  name: string
  members: number
  category?: string | null
  descriptionSnippet?: string | null
  description?: string
  location?: string
  placeLabel?: string | null
  distanceMi?: number
  tags?: string[]
  visibility?: 'public' | 'private' | 'invite-only'
  joinMode?: 'open' | 'apply'
  createdAt?: string
  coverImageUrl?: string | null
  memberAvatars?: Array<{
    userId: string
    avatarUrl?: string | null
    displayName?: string | null
  }>
}

type Props = {
  group: GroupDiscoverCardGroup
  badge?: GroupDiscoverBadge | null
  friendsHere?: number
  onJoin?: () => void
}

const BADGE_CLASS: Record<GroupDiscoverBadge, string> = {
  Featured: 'bg-dc-accent text-dc-accent-foreground',
  Popular: 'bg-amber-500/90 text-black',
  New: 'bg-emerald-600/90 text-white',
  'Near you': 'bg-sky-600/90 text-white',
}

function categoryGlyph(category: string | null | undefined): string {
  switch (category) {
    case GROUP_CATEGORIES.social:
      return 'S'
    case GROUP_CATEGORIES.education:
      return 'E'
    case GROUP_CATEGORIES.playScene:
      return 'P'
    case GROUP_CATEGORIES.affinity:
      return 'A'
    case GROUP_CATEGORIES.marketplace:
      return 'M'
    case GROUP_CATEGORIES.discussion:
      return 'D'
    default:
      return 'G'
  }
}

export default function GroupDiscoverCard({ group, badge, friendsHere, onJoin }: Props) {
  const location = group.placeLabel ?? group.location
  const snippet = group.descriptionSnippet ?? group.description
  const joinLabel = group.joinMode === 'apply' ? 'Apply to join' : 'Join Group'

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)] transition-shadow hover:shadow-[var(--dc-shadow-card)]">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-dc-surface-muted to-dc-elevated-muted">
        {badge ?
          <span
            className={`absolute left-3 top-3 z-10 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${BADGE_CLASS[badge]}`}
          >
            {badge}
          </span>
        : null}
        {group.coverImageUrl ?
          <img
            src={group.coverImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        : <div className="absolute inset-0 flex items-center justify-center text-dc-muted" aria-hidden>
            <svg className="h-14 w-14 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
        }
        <span
          className="absolute -bottom-5 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-dc-elevated-solid bg-dc-accent text-sm font-bold text-dc-accent-foreground shadow-md"
          title={group.category ?? 'Group'}
          aria-hidden
        >
          {categoryGlyph(group.category)}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-7">
        <h3 className="truncate text-base font-semibold text-dc-text">
          <Link to={`/groups/${group.id}`} className="hover:text-dc-accent">
            {group.name}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-dc-muted">
          {group.members.toLocaleString()} member{group.members === 1 ? '' : 's'}
        </p>
        {location ?
          <p className="mt-1 truncate text-xs text-dc-text-muted">
            {location}
            {group.distanceMi != null ? ` · ${group.distanceMi} mi` : null}
          </p>
        : null}
        {snippet ?
          <p className="mt-2 line-clamp-2 text-sm text-dc-text-muted">{snippet}</p>
        : null}
        {group.tags && group.tags.length > 0 ?
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.tags.slice(0, 4).map((t) => (
              <TagLink key={t} tag={t} />
            ))}
          </div>
        : null}
        {friendsHere != null && friendsHere > 0 ?
          <p className="mt-2 text-xs font-medium text-dc-accent">
            {friendsHere} friend{friendsHere === 1 ? '' : 's'} here
          </p>
        : null}
        <div className="mt-auto pt-4">
          {onJoin ?
            <button
              type="button"
              onClick={onJoin}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-dc-accent-border bg-dc-accent-muted text-sm font-semibold text-dc-accent hover:bg-dc-accent hover:text-dc-accent-foreground"
            >
              {joinLabel}
            </button>
          : <Link
              to={`/groups/${group.id}`}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-dc-accent-border bg-dc-accent-muted text-sm font-semibold text-dc-accent hover:bg-dc-accent hover:text-dc-accent-foreground"
            >
              {joinLabel}
            </Link>
          }
        </div>
      </div>
    </article>
  )
}
