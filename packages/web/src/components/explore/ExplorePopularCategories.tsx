import { Link } from 'react-router-dom'
import { EXPLORE_POPULAR_CATEGORIES, type ExplorePopularCategory } from '@/lib/explore-hub'

function CategoryIcon({ icon }: { icon: ExplorePopularCategory['icon'] }) {
  const className = 'h-6 w-6 text-dc-accent'
  switch (icon) {
    case 'rope':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.5} strokeLinecap="round" d="M8 6c2 2 4 6 4 10M16 6c-2 2-4 6-4 10" />
        </svg>
      )
    case 'impact':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.5} strokeLinecap="round" d="M12 3v4M8 7h8M6 11l3 10h6l3-10" />
        </svg>
      )
    case 'leather':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.5} strokeLinecap="round" d="M6 8h12v10a2 2 0 01-2 2H8a2 2 0 01-2-2V8z" />
        </svg>
      )
    case 'education':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path strokeWidth={1.5} strokeLinecap="round" d="M12 6l8 4-8 4-8-4 8-4zM4 14l8 4 8-4" />
        </svg>
      )
    case 'community':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path
            strokeWidth={1.5}
            strokeLinecap="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      )
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2l2.4 4.8L20 8l-4 3.9.9 5.5L12 15.8 7.1 17.4 8 11.9 4 8l5.6-1.2L12 2z"
          />
        </svg>
      )
  }
}

export default function ExplorePopularCategories() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 c2k-no-scrollbar -mx-1 px-1">
      {EXPLORE_POPULAR_CATEGORIES.map((cat) => (
        <Link
          key={cat.id}
          to={cat.href}
          className="flex min-w-[7.5rem] shrink-0 flex-col gap-2 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)] transition-colors hover:border-dc-accent-border/50 hover:bg-dc-elevated-hover"
        >
          <CategoryIcon icon={cat.icon} />
          <div>
            <p className="text-sm font-semibold text-dc-text">{cat.label}</p>
            {cat.countLabel ?
              <p className="text-xs text-dc-muted">{cat.countLabel}</p>
            : null}
          </div>
        </Link>
      ))}
    </div>
  )
}
