import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  personAvatarGradientClass,
  personDisplayLabel,
  personInitials,
} from '@/components/PersonAvatar'
import ReportAction from '@/components/moderation/ReportAction'
import Card from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/cn'
import { profileTarget } from '@/lib/moderation/report-targets'
import { activityIndicatorFromISO } from '@/lib/profile-activity'
import {
  getPersonCommunityBadges,
  getPersonDirectoryStats,
} from '@/lib/people-directory-utils'
import type { MockPerson } from '@/data/types'

type Props = {
  person: MockPerson
  /** Highlight card when surfaced as a recommended pick (not merely first in list). */
  recommended?: boolean
  /** Lower visual weight on mobile for cards deeper in the list */
  mobileCompact?: boolean
}

const BADGE_TONE_CLASS: Record<string, string> = {
  gold: 'border-dc-accent/30 bg-dc-accent-muted/30 text-dc-accent/90',
  green: 'border-dc-border bg-dc-elevated-muted/60 text-dc-text-muted',
  blue: 'border-dc-border bg-dc-elevated-muted/60 text-dc-text-muted',
  purple: 'border-dc-border bg-dc-elevated-muted/60 text-dc-text-muted',
  orange: 'border-dc-border bg-dc-elevated-muted/60 text-dc-text-muted',
}

export default function FindPeopleProfileCard({ person, recommended, mobileCompact = false }: Props) {
  const { isAuthenticated, isFallback, viewerUserId } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const canReport =
    Boolean(isAuthenticated && !isFallback && viewerUserId && viewerUserId !== person.id)

  const { username, sceneName, location, verified, distance, avatarUrl, lastActiveAt } = person

  const displayName = sceneName?.trim() || username
  const photoLabel = personDisplayLabel(username, sceneName)
  const hasAvatar = Boolean(avatarUrl?.trim())
  const communityBadges = getPersonCommunityBadges(person)
  const visibleBadges = mobileCompact ? communityBadges.slice(0, 2) : communityBadges.slice(0, 3)
  const extraBadgeCount = Math.max(0, communityBadges.length - visibleBadges.length)
  const contentStats = getPersonDirectoryStats(person)
  const activity = activityIndicatorFromISO(lastActiveAt ?? undefined)
  const showActivity = activity.label && !activity.hidden
  const locationLine = [location?.trim(), distance?.trim()].filter(Boolean).join(' · ')
  const profileHref = `/profile/${username}`
  const shopHref = person.vendorShopSlug ? `/vendors/${encodeURIComponent(person.vendorShopSlug)}` : null

  return (
    <Card
      interactive
      className={cn(
        'group/card relative flex h-full min-h-[11.5rem] min-w-0 flex-col overflow-hidden p-0 sm:min-h-[12.5rem]',
        recommended && 'border-dc-accent-border/50 ring-1 ring-dc-accent/15',
      )}
    >
      <Link
        to={profileHref}
        className="absolute inset-0 z-0 block overflow-hidden bg-gradient-to-br from-dc-surface-muted to-dc-elevated-solid"
        aria-label={`View ${displayName}'s profile`}
      >
        {hasAvatar ?
          <img
            src={avatarUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[center_22%] transition-transform duration-300 group-hover/card:scale-[1.03]"
          />
        : <div
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-gradient-to-br',
              personAvatarGradientClass(username),
            )}
          >
            <span className="text-2xl font-bold text-white/95 sm:text-3xl">{personInitials(photoLabel)}</span>
          </div>
        }
      </Link>

      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/90 via-black/30 to-transparent"
        aria-hidden
      />

      {verified ?
        <span className="absolute right-2 top-2 z-[2] flex h-4 w-4 items-center justify-center rounded-full bg-dc-accent ring-2 ring-black/40">
          <svg className="h-2.5 w-2.5 text-dc-text" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      : null}
      {recommended ?
        <span className="absolute left-2 top-2 z-[2] rounded-md bg-dc-accent/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-dc-text">
          Recommended
        </span>
      : null}

      <div className="relative z-[2] mt-auto min-w-0 px-2.5 pb-2 pt-1.5 backdrop-blur-[1px] sm:px-3 sm:pb-2.5">
        <div className="relative min-w-0">
          <div className="absolute right-0 top-0 z-10" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setMenuOpen((o) => !o)
              }}
              className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-black/35 text-dc-text-muted hover:border-dc-accent-border/50 hover:text-dc-accent"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={`More options for ${displayName}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {menuOpen ?
              <ul
                role="menu"
                className="pointer-events-auto absolute right-0 z-20 mt-1 min-w-[9rem] rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-lg"
              >
                <li role="none">
                  <Link
                    to={profileHref}
                    role="menuitem"
                    className="block w-full px-3 py-1.5 text-left text-xs text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text"
                    onClick={() => setMenuOpen(false)}
                  >
                    View profile
                  </Link>
                </li>
                {shopHref ?
                  <li role="none">
                    <Link
                      to={shopHref}
                      role="menuitem"
                      className="block w-full px-3 py-1.5 text-left text-xs text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text"
                      onClick={() => setMenuOpen(false)}
                    >
                      View shop
                    </Link>
                  </li>
                : null}
                {canReport ?
                  <li role="none" onClick={() => setMenuOpen(false)}>
                    <ReportAction
                      variant="menu-item"
                      targetType={profileTarget(String(person.id)).targetType}
                      targetId={profileTarget(String(person.id)).targetId}
                      targetLabel="profile"
                      surface="people_directory"
                      className="px-3 py-1.5 text-xs text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text"
                    />
                  </li>
                : null}
              </ul>
            : null}
          </div>

          <div className="min-w-0 pr-7">
            <Link to={profileHref} className="block min-w-0 hover:text-dc-accent">
              <h3 className="line-clamp-1 text-sm font-semibold leading-tight text-dc-text">{displayName}</h3>
              <p className="line-clamp-1 text-[11px] text-dc-text-muted">@{username}</p>
            </Link>

            {(showActivity || locationLine) ?
              <p className="mt-0.5 line-clamp-1 text-[10px] text-dc-text-muted">
                {[showActivity ? activity.label : null, locationLine || null].filter(Boolean).join(' · ')}
              </p>
            : null}

            {contentStats.length > 0 ?
              <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-dc-text-muted">
                {contentStats.map((stat) => (
                  <li key={stat.key}>
                    <span className="font-medium text-dc-text">{stat.value}</span> {stat.label}
                  </li>
                ))}
              </ul>
            : null}

            {visibleBadges.length > 0 ?
              <div className="mt-1 flex flex-wrap gap-1">
                {visibleBadges.map((badge) => (
                  <span
                    key={badge.id}
                    className={`inline-flex rounded border px-1 py-px text-[9px] font-semibold uppercase tracking-wide ${BADGE_TONE_CLASS[badge.tone] ?? BADGE_TONE_CLASS.gold}`}
                  >
                    {badge.label}
                  </span>
                ))}
                {extraBadgeCount > 0 ?
                  <span className="inline-flex rounded border border-dc-border px-1 py-px text-[9px] font-medium text-dc-muted">
                    +{extraBadgeCount}
                  </span>
                : null}
              </div>
            : null}
          </div>
        </div>
      </div>
    </Card>
  )
}
