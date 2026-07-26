import { Link } from 'react-router-dom'

import PersonAvatar from '@/components/PersonAvatar'

import PresenterBadges from '@/components/presenters/PresenterBadges'

import CommunityTrustChip from '@/components/trust/CommunityTrustChip'

import Badge from '@/components/ui/Badge'

import { cn } from '@/lib/cn'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'

import type { PresenterBadgeKey } from '@/lib/presenter-badges-types'

import {

  formatPresenterRating,

  presenterReputationTier,

  presenterReputationTierLabel,

  presenterRoleLabel,

} from '@/lib/presenter-reputation-display'

import type { ProfileFocus } from '@/lib/presenter-focus'

import { PRESENTER_MIN_REVIEWS_FOR_TIER } from '@c2k/shared'



export type PresenterCardModel = {

  userId: string

  username: string

  displayName: string | null

  avatarUrl: string | null

  headline: string | null

  bioShort: string | null

  profileKind: string

  profileFocuses?: ProfileFocus[] | null

  primaryProfileFocus?: ProfileFocus | null

  expertiseTags: string[] | null

  ratingAvg: number

  reviewCount: number

  badges?: PresenterBadgeKey[]

  verifiedTeachingCredits?: number

  featuredOfferingTitle?: string | null

  publishedArticleCount?: number

}



const tierBorderClasses: Record<ReturnType<typeof presenterReputationTier>, string> = {

  unrated: 'border-dc-border',

  rated: 'border-dc-border',

  trusted: 'border-dc-accent/45 ring-1 ring-dc-accent/15',

  highlyTrusted: 'border-dc-accent/60 ring-1 ring-dc-accent/25',

}



type PresenterCardProps = {

  presenter: PresenterCardModel

  activeTag?: string

  onTagFilter?: (tag: string) => void

}



export default function PresenterCard({ presenter, activeTag, onTagFilter }: PresenterCardProps) {

  const tier = presenterReputationTier(presenter.ratingAvg, presenter.reviewCount)

  const tierLabel = presenterReputationTierLabel(tier, presenter.reviewCount)

  const showRating = presenter.reviewCount >= PRESENTER_MIN_REVIEWS_FOR_TIER && presenter.ratingAvg > 0

  const kindLabel = presenterRoleLabel(

    presenter.profileKind,

    presenter.profileFocuses,

    presenter.primaryProfileFocus,

  )

  const profileHref = `/presenters/${encodeURIComponent(presenter.username)}`

  const writingHref = `${profileHref}#writing`

  const creditCount = presenter.verifiedTeachingCredits ?? 0

  const displayName = presenter.displayName || presenter.username



  return (

    <article

      className={cn(

        'flex h-full flex-col p-4',
        cardSurfaceSolidClass,
        cardSurfaceInteractiveClass,

        tierBorderClasses[tier],

      )}

    >

      <div className="flex min-w-0 gap-3">

        <Link to={profileHref} className="shrink-0">

          <PersonAvatar

            username={presenter.username}

            sceneName={displayName}

            avatarUrl={presenter.avatarUrl}

            size="lg"

            rounded="xl"

          />

        </Link>

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <Link to={profileHref} className="truncate font-semibold text-dc-text hover:text-dc-accent">

              {displayName}

            </Link>

            {kindLabel ?

              <Badge variant="neutral" className="shrink-0 text-[10px]">

                {kindLabel}

              </Badge>

            : null}

          </div>

          <p className="mt-0.5 truncate text-xs text-dc-muted">@{presenter.username}</p>

          {presenter.headline ?

            <p className="mt-1 line-clamp-2 text-sm text-dc-text-muted">{presenter.headline}</p>

          : null}

        </div>

      </div>



      {presenter.badges && presenter.badges.length > 0 ?

        <PresenterBadges badges={presenter.badges} compact className="mt-3" />

      : null}



      {presenter.expertiseTags && presenter.expertiseTags.length > 0 ?

        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5 c2k-no-scrollbar">

          {presenter.expertiseTags.slice(0, 6).map((t) => {

            const normalized = t.trim().toLowerCase()

            const isActive = activeTag === normalized

            if (onTagFilter) {

              return (

                <button

                  key={t}

                  type="button"

                  onClick={() => onTagFilter(normalized)}

                  className={cn(

                    'shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors',

                    isActive ?

                      'border border-dc-accent-border/40 bg-dc-accent/15 text-dc-accent'

                    : 'bg-dc-elevated-muted text-dc-muted hover:text-dc-text',

                  )}

                >

                  {t}

                </button>

              )

            }

            return (

              <span key={t} className="shrink-0 rounded-full bg-dc-elevated-muted px-2.5 py-1 text-xs text-dc-muted">

                {t}

              </span>

            )

          })}

        </div>

      : null}



      <div className="mt-3 space-y-1 text-xs text-dc-text-muted">

        {creditCount > 0 ?

          <p>{creditCount} verified teaching {creditCount === 1 ? 'credit' : 'credits'}</p>

        : presenter.featuredOfferingTitle ?

          <p>

            Featured workshop:{' '}

            <Link to={profileHref} className="text-dc-accent hover:underline">

              {presenter.featuredOfferingTitle}

            </Link>

          </p>

        : null}

        {(presenter.publishedArticleCount ?? 0) > 0 ?

          <p>

            <Link to={writingHref} className="text-dc-accent hover:underline">

              {presenter.publishedArticleCount} article{presenter.publishedArticleCount === 1 ? '' : 's'}

            </Link>

          </p>

        : null}

        {showRating ?

          <p>{formatPresenterRating(presenter.ratingAvg, presenter.reviewCount)} from community reviews</p>

        : tierLabel && presenter.reviewCount > 0 ?

          <p className="text-dc-muted">{tierLabel}</p>

        : null}

      </div>



      <div className="mt-2">

        <CommunityTrustChip username={presenter.username} />

      </div>



      <div className="mt-auto pt-4">

        <Link

          to={profileHref}

          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"

        >

          View profile

        </Link>

      </div>

    </article>

  )

}


