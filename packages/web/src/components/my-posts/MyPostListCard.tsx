import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import { contentBadgeClass, type ContentBadge } from '@/components/my-posts/my-posts-ui'

type Props = {
  badge: ContentBadge
  title: string
  excerpt: string
  metaLine: string
  statusLabel?: string
  engagementLine?: string
  imageUrl?: string | null
  viewHref: string
  editHref?: string
}

export default function MyPostListCard({
  badge,
  title,
  excerpt,
  metaLine,
  statusLabel,
  engagementLine,
  imageUrl,
  viewHref,
  editHref,
}: Props) {
  return (
    <li className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
      <div className="flex gap-3">
        {imageUrl ?
          <img src={imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        : <PlaceholderAvatar size="md" className="!h-16 !w-16 !rounded-xl" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${contentBadgeClass(badge)}`}
            >
              {badge}
            </span>
            {statusLabel ?
              <span className="text-[11px] text-dc-muted">{statusLabel}</span>
            : null}
          </div>
          <h3 className="mt-1 line-clamp-2 font-semibold text-dc-text">
            <Link to={viewHref} className="hover:text-dc-accent">
              {title}
            </Link>
          </h3>
          {excerpt ?
            <p className="mt-1 line-clamp-2 text-sm text-dc-text-muted">{excerpt}</p>
          : null}
          <p className="mt-2 text-xs text-dc-muted">{metaLine}</p>
          {engagementLine ?
            <p className="mt-0.5 text-xs text-dc-muted">{engagementLine}</p>
          : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to={viewHref}
              className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-sm font-medium text-dc-text hover:border-dc-accent-border"
            >
              View
            </Link>
            {editHref ?
              <Link
                to={editHref}
                className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-sm font-medium text-dc-text-muted hover:text-dc-text"
              >
                Edit
              </Link>
            : null}
          </div>
        </div>
      </div>
    </li>
  )
}
