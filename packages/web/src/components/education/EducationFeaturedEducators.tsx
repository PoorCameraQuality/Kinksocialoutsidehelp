import { Link } from 'react-router-dom'

import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import type { EducationFeaturedEducator } from '@/lib/education-discover-data'

function EducatorCard({ educator }: { educator: EducationFeaturedEducator }) {
  return (
    <article className="flex w-[min(100%,200px)] shrink-0 flex-col items-center rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 text-center shadow-[var(--dc-shadow-soft)]">
      <Link to={`/presenters/${encodeURIComponent(educator.username)}`} className="block">
        {educator.avatarUrl ?
          <img
            src={educator.avatarUrl}
            alt=""
            className="mx-auto h-20 w-20 rounded-full object-cover ring-2 ring-dc-accent-border/50"
            loading="lazy"
          />
        : <PlaceholderAvatar size="lg" className="!h-20 !w-20" />}
      </Link>
      <Link
        to={`/presenters/${encodeURIComponent(educator.username)}`}
        className="mt-3 block text-sm font-semibold text-dc-text hover:text-dc-accent"
      >
        {educator.displayName}
      </Link>
      <p className="text-xs text-dc-muted">{educator.handle}</p>
      <dl className="mt-2 grid w-full grid-cols-3 gap-1 text-[10px] text-dc-text-muted">
        <div>
          <dt className="sr-only">Articles</dt>
          <dd className="font-semibold tabular-nums text-dc-text">{educator.articleCount}</dd>
          <dd>Articles</dd>
        </div>
        <div>
          <dt className="sr-only">Followers</dt>
          <dd className="font-semibold tabular-nums text-dc-text">{educator.followerCount}</dd>
          <dd>Followers</dd>
        </div>
        <div>
          <dt className="sr-only">Endorsements</dt>
          <dd className="font-semibold tabular-nums text-dc-text">{educator.endorsementCount}</dd>
          <dd>Endorse</dd>
        </div>
      </dl>
      <button
        type="button"
        disabled
        title="Follow educators. Coming soon"
        className="mt-3 inline-flex min-h-9 w-full cursor-not-allowed items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-muted px-3 text-xs font-semibold text-dc-muted"
      >
        Follow. Soon
      </button>
    </article>
  )
}

type Props = {
  educators: EducationFeaturedEducator[]
}

export default function EducationFeaturedEducators({ educators }: Props) {
  if (educators.length === 0) return null

  return (
    <section className="mb-10" aria-label="Featured educators">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dc-text">Featured educators</h2>
        <Link to="/presenters" className="shrink-0 text-xs font-semibold text-dc-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto c2k-no-scrollbar pb-1">
        {educators.slice(0, 4).map((educator) => (
          <EducatorCard key={educator.userId} educator={educator} />
        ))}
      </div>
    </section>
  )
}
