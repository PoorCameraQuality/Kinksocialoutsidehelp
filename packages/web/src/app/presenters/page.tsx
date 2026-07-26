import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PresenterCard from '@/components/cards/PresenterCard'
import EmptyState from '@/components/ui/EmptyState'
import TextInput from '@/components/ui/TextInput'
import DirectoryTemplate from '@/components/templates/DirectoryTemplate'
import { useAuth } from '@/contexts/AuthContext'
import { useApiPresenters, type PresenterListSort } from '@/hooks/useApiPresenters'
import { cn } from '@/lib/cn'
import { shellOuterClass } from '@/lib/shell-contract'

const SORT_OPTIONS: { value: PresenterListSort; label: string }[] = [
  { value: 'popular', label: 'Top rated' },
  { value: 'name', label: 'A–Z' },
]

const MAX_TAG_CHIPS = 12

function aggregateTopTags(items: { expertiseTags: string[] | null }[]): string[] {
  const counts = new Map<string, { label: string; n: number }>()
  for (const item of items) {
    for (const raw of item.expertiseTags ?? []) {
      const label = raw.trim()
      if (!label) continue
      const key = label.toLowerCase()
      const prev = counts.get(key)
      if (prev) prev.n += 1
      else counts.set(key, { label, n: 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    .slice(0, MAX_TAG_CHIPS)
    .map((x) => x.label)
}

export default function PresentersDirectoryPage() {
  const { isAuthenticated } = useAuth()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState<PresenterListSort>('popular')
  const { status, items, errorMessage, reload, hasMore, loadingMore, loadMore } = useApiPresenters(true, {
    q,
    tag,
    sort,
  })

  const activeTag = tag.trim().toLowerCase()
  const hasActiveFilters = Boolean(q.trim()) || Boolean(activeTag)
  const topTags = useMemo(() => aggregateTopTags(items), [items])

  const applyTagFilter = (nextTag: string) => {
    setTag(nextTag)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={cn(shellOuterClass, 'c2k-mobile-scroll-pad')}>
      <DirectoryTemplate
        title="Presenters & authors"
        className="py-4 sm:py-6"
        header={
          <div className="mb-6 rounded-2xl border border-dc-border bg-dc-elevated/95 p-4 shadow-[var(--dc-shadow-soft)] sm:p-5">
            <h1 className="text-2xl font-bold text-dc-text">Presenters &amp; authors</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-text-muted">
              Find trusted educators, speakers, photographers, and authors for conventions and classes.
            </p>
            {isAuthenticated ?
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/presenters/onboarding?track=educator"
                  className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                >
                  Build your presenter profile
                </Link>
                <Link
                  to="/education/write"
                  className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm font-medium text-dc-text-muted hover:text-dc-text"
                >
                  Write an article
                </Link>
              </div>
            : null}
          </div>
        }
        toolbar={
          <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="presenter-search" className="sr-only">
              Search presenters
            </label>
            <TextInput
              id="presenter-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, bio, headline…"
              className="w-full min-h-11 max-w-md rounded-xl"
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Sort presenters">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSort(opt.value)}
                  className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    sort === opt.value ?
                      'bg-dc-accent/10 text-dc-accent'
                    : 'text-dc-text-muted hover:bg-dc-elevated-muted hover:text-dc-text'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
        footer={
          <div className="mt-10 rounded-2xl border border-dc-border bg-dc-elevated-muted/50 p-4 text-center sm:p-5">
            <p className="text-sm font-medium text-dc-text">Explore classes and articles</p>
            <p className="mt-1 text-xs text-dc-text-muted">Education hub — workshops, guides, and community writing.</p>
            <Link
              to="/education"
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            >
              Browse Education
            </Link>
          </div>
        }
      >
        {topTags.length > 0 ?
          <div className="mb-6 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 c2k-no-scrollbar">
            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-dc-muted">Expertise</span>
            {topTags.map((t) => {
              const normalized = t.toLowerCase()
              const isActive = activeTag === normalized
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => applyTagFilter(isActive ? '' : normalized)}
                  className={`min-h-9 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive ?
                      'border border-dc-accent-border/40 bg-dc-accent/10 text-dc-accent'
                    : 'border border-transparent bg-dc-elevated-muted text-dc-text-muted hover:text-dc-text'
                  }`}
                >
                  {t}
                </button>
              )
            })}
            {activeTag ?
              <button
                type="button"
                onClick={() => setTag('')}
                className="min-h-9 shrink-0 px-2 text-xs text-dc-accent hover:underline"
              >
                Clear
              </button>
            : null}
          </div>
        : null}

        {status === 'loading' ?
          <ul className="grid gap-4 sm:grid-cols-2" aria-busy="true" role="status">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="h-48 animate-pulse rounded-2xl bg-dc-elevated-muted" />
            ))}
          </ul>
        : status === 'error' ?
          <EmptyState
            inline
            className="mb-6 rounded-2xl border border-dc-border bg-dc-elevated/80 shadow-[var(--dc-shadow-soft)]"
            title="Could not load presenters"
            message={errorMessage ?? 'The presenter directory did not load. Check your connection and try again.'}
            actionLabel="Retry"
            onAction={reload}
            secondaryCtaLabel="Find people"
            secondaryCtaHref="/people"
          />
        : items.length === 0 ?
          <EmptyState
            message={
              !hasActiveFilters ?
                'No public presenter profiles listed yet. Presenters appear here once they opt into the directory in Settings.'
              : 'No public presenter profiles match. Try another search or expertise tag.'
            }
            ctaLabel={hasActiveFilters ? undefined : 'Educator setup'}
            ctaHref={hasActiveFilters ? undefined : '/presenters/onboarding'}
            secondaryCtaLabel={!hasActiveFilters ? 'Find people' : undefined}
            secondaryCtaHref={!hasActiveFilters ? '/people' : undefined}
            actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
            onAction={
              hasActiveFilters ?
                () => {
                  setQ('')
                  setTag('')
                }
              : undefined
            }
          />
        : <>
            <ul className="grid gap-4 pb-2 sm:grid-cols-2">
              {items.map((p) => (
                <li key={p.userId}>
                  <PresenterCard presenter={p} activeTag={activeTag || undefined} onTagFilter={applyTagFilter} />
                </li>
              ))}
            </ul>
            {hasMore ?
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="min-h-11 rounded-xl bg-dc-elevated-muted px-6 py-2 text-sm font-medium text-dc-text hover:bg-dc-elevated-solid disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            : null}
          </>
        }
      </DirectoryTemplate>
    </div>
  )
}
