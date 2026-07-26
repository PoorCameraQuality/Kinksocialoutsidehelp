import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import type { EducationTopicFilter } from '@/lib/education-discover-data'
import { resolveEducationNavMatch, type EducationNavMatch } from '@/lib/education-section-mode'

const NAV: ReadonlyArray<{
  href: string
  label: string
  match: EducationNavMatch
  soon?: boolean
}> = [
  { href: '/education', label: 'Overview', match: 'overview' },
  { href: '/education?view=paths', label: 'Learning paths', match: 'paths' },
  { href: '/education?view=articles', label: 'Articles', match: 'articles' },
  { href: '/education?view=videos', label: 'Videos', match: 'videos' },
  { href: '/education?view=podcasts', label: 'Podcasts', match: 'podcasts' },
  { href: '/education?view=library', label: 'Class library', match: 'library' },
  { href: '/saved', label: 'Saved', match: 'saved' },
  { href: '/education?view=progress', label: 'My progress', match: 'progress' },
]

type Props = {
  selectedCategory: string | null
  onCategoryChange: (cat: string | null) => void
  onBrowseTopics: () => void
  topicFilters?: EducationTopicFilter[]
  embedded?: boolean
}

export default function EducationLeftRail({
  selectedCategory,
  onCategoryChange,
  onBrowseTopics,
  topicFilters = [],
  embedded = false,
}: Props) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const current = resolveEducationNavMatch(pathname, search)
  const onEducationHub = pathname === '/education'

  const onArticlesNav = () => {
    if (pathname === '/education' && searchParams.get('view') === 'articles') {
      onBrowseTopics()
    }
  }

  const applyTopicFilter = (category: string | null) => {
    if (!onEducationHub) {
      onCategoryChange(category)
      navigate(category ? `/education?view=articles&category=${encodeURIComponent(category)}` : '/education?view=articles')
      return
    }
    onCategoryChange(category)
    const params = new URLSearchParams(searchParams)
    params.set('view', 'articles')
    if (category) params.set('category', category)
    else params.delete('category')
    setSearchParams(params, { replace: false })
    onBrowseTopics()
  }

  const shellClass = embedded ? 'space-y-4' : 'space-y-4 lg:sticky lg:top-24 lg:self-start'
  const Shell = embedded ? 'div' : 'aside'

  return (
    <Shell className={shellClass} aria-label="Education navigation">
      <div className="edu-rail-panel">
        <nav aria-label="Education sections">
          <ul className="space-y-0.5 border-b border-dc-border pb-4">
            {NAV.map((item) => {
              const active = item.match === current
              const isArticles = item.match === 'articles'
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    onClick={isArticles ? onArticlesNav : undefined}
                    className={`edu-rail-nav-link ${active ? 'edu-rail-nav-link--active' : ''}`}
                  >
                    <span>{item.label}</span>
                    {item.soon ?
                      <span className="shrink-0 rounded-md border border-dc-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-dc-muted">
                        Soon
                      </span>
                    : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      <div className="edu-rail-panel">
        <h3 className="mb-2 text-sm font-semibold text-dc-text">My Learning</h3>
        <p className="text-xs leading-relaxed text-dc-muted">
          Preview progress on{' '}
          <Link to="/education?view=progress" className="font-medium text-dc-accent hover:underline">
            My progress
          </Link>
          . Bookmarks live on{' '}
          <Link to="/saved" className="font-medium text-dc-accent hover:underline">
            Saved
          </Link>
          .
        </p>
      </div>

      <div className="edu-rail-panel">
        <h3 className="mb-1 text-sm font-semibold text-dc-text">Browse by topic</h3>
        <p className="mb-3 text-[11px] leading-snug text-dc-muted">From article tags in the hub catalogue.</p>
        {topicFilters.length === 0 ?
          <p className="text-xs text-dc-muted">Topics appear as educators publish tagged articles.</p>
        : <ul className="space-y-1.5 text-sm" aria-label="Topic filters">
            {topicFilters.map((topic) => {
              const pressed = selectedCategory?.toLowerCase() === topic.category.toLowerCase()
              return (
                <li key={topic.category}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => applyTopicFilter(pressed ? null : topic.category)}
                    className={`edu-rail-topic-btn ${pressed ? 'edu-rail-topic-btn--active' : ''}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden>{topic.icon}</span>
                      <span>{topic.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-dc-muted">{topic.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        }
      </div>
    </Shell>
  )
}
