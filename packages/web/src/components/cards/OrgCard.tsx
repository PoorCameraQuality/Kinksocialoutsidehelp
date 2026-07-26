import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { cardSurfaceInteractiveClass, cardSurfaceSolidClass } from '@/lib/card-surface'
import {
  formatOrgRating,
  orgReputationTier,
  orgReputationTierLabel,
} from '@/lib/org-reputation-display'
import { stripHtml } from '@/lib/stripHtml'

export type OrgCardModel = {
  id: string
  slug: string
  displayName: string
  bio?: string | null
  bioFormat?: 'text' | 'html'
  logoUrl?: string | null
  memberCount?: number
  rating: number
  reviewCount: number
}

function orgBioCardPreview(bio: string, bioFormat?: 'text' | 'html'): string {
  if (bioFormat === 'html' || bio.includes('<')) return stripHtml(bio)
  return bio.trim()
}

function orgInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

const tierBorderClasses: Record<ReturnType<typeof orgReputationTier>, string> = {
  unrated: 'border-dc-border',
  newOrg: 'border-dc-border',
  limitedFeedback: 'border-dc-border',
  rated: 'border-dc-border',
  trusted: 'border-dc-accent/45 ring-1 ring-dc-accent/15',
  highlyTrusted: 'border-dc-accent/60 ring-1 ring-dc-accent/25',
}

export default function OrgCard({ org }: { org: OrgCardModel }) {
  const tier = orgReputationTier(org.rating, org.reviewCount)
  const tierLabel = orgReputationTierLabel(tier)
  const members = org.memberCount ?? 0
  const bioPreview = org.bio ? orgBioCardPreview(org.bio, org.bioFormat) : null

  return (
    <Link
      to={`/orgs/${encodeURIComponent(org.slug)}`}
      className={cn(
        'flex h-full flex-col p-5',
        cardSurfaceSolidClass,
        cardSurfaceInteractiveClass,
        tierBorderClasses[tier],
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {org.logoUrl ?
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 p-1 ring-1 ring-dc-border/60">
            <img
              src={org.logoUrl}
              alt=""
              className="h-full w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>
        : <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-dc-elevated-muted text-sm font-bold text-dc-accent"
            aria-hidden
          >
            {orgInitials(org.displayName)}
          </div>
        }
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-dc-text">{org.displayName}</h2>
            {tierLabel ?
              <Badge variant="accent" className="shrink-0">
                {tierLabel}
              </Badge>
            : null}
          </div>
          <p className="text-xs text-dc-muted mt-0.5 truncate">/{org.slug}</p>
        </div>
      </div>
      {bioPreview ?
        <p className="text-sm text-dc-text-muted mt-3 line-clamp-2 leading-snug">{bioPreview}</p>
      : null}
      <p className="mt-auto pt-3 text-xs text-dc-muted">
        {tier === 'newOrg' || tier === 'limitedFeedback' ?
          <>
            {orgReputationTierLabel(tier) ?? 'Limited feedback'} · {members.toLocaleString()} members
          </>
        : <>
            ★ {formatOrgRating(org.rating, org.reviewCount)} · {org.reviewCount.toLocaleString()} review
            {org.reviewCount === 1 ? '' : 's'} · {members.toLocaleString()} members
          </>
        }
      </p>
    </Link>
  )
}
