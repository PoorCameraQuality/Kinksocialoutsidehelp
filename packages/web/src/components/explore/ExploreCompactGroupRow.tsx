import { Link } from 'react-router-dom'
import { mediaDisplayUrl } from '@/lib/media-display-url'

type Props = {
  group: {
    id: string
    name: string
    members: number
    category?: string | null
    description?: string
    descriptionSnippet?: string | null
    coverImageUrl?: string | null
  }
}

export default function ExploreCompactGroupRow({ group }: Props) {
  const cover = mediaDisplayUrl(group.coverImageUrl)
  const snippet = group.descriptionSnippet ?? group.description

  return (
    <Link
      to={`/groups/${encodeURIComponent(group.id)}`}
      className="xpl-row-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dc-accent"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dc-border bg-dc-surface-muted">
        {cover ?
          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        : (
          <svg className="h-7 w-7 text-dc-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {group.category ?
          <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">{group.category}</p>
        : null}
        <p className="text-sm font-semibold text-dc-text line-clamp-2">{group.name}</p>
        <p className="mt-0.5 text-xs text-dc-muted">
          {group.members} member{group.members === 1 ? '' : 's'}
        </p>
        {snippet ?
          <p className="mt-1 text-xs leading-relaxed text-dc-text-muted line-clamp-2">{snippet}</p>
        : null}
      </div>
    </Link>
  )
}
