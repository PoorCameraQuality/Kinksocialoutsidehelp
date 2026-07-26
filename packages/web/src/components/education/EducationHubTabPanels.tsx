import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import EducationClassLibraryCard from '@/components/education/EducationClassLibraryCard'
import EducationVideoStripCard from '@/components/education/EducationVideoStripCard'
import MediaChannelCard from '@/components/media/MediaChannelCard'
import EmptyState from '@/components/ui/EmptyState'
import TabButton from '@/components/ui/TabButton'
import type { ApiEducationArticle } from '@/lib/education-article-types'
import type { ApiMediaShowListItem } from '@/hooks/useApiMediaShows'
import {
  buildClassLibrarySnapshot,
  CLASS_FORMAT_FILTER_ORDER,
  CLASS_FORMAT_META,
  filterClassLibrary,
  type ClassFormat,
} from '@/lib/education-class-library'
import type { EducationStripVideo } from '@/lib/education-discover-data'

type VideosProps = {
  workshopVideos: EducationStripVideo[]
  mediaShows: ApiMediaShowListItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

export function EducationVideosPanel({ workshopVideos, mediaShows, loading, error, onRetry }: VideosProps) {
  return (
    <div className="space-y-8">
      {workshopVideos.length > 0 ?
        <section aria-label="Workshop recordings">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-dc-text">Workshop recordings</h2>
          <p className="mb-4 text-sm text-dc-text-muted">Articles with embedded walkthroughs and demo sessions.</p>
          <div className="c2k-snap-carousel">
            <div className="c2k-snap-carousel__track">
              {workshopVideos.map((video) => (
                <EducationVideoStripCard key={video.slug} video={video} />
              ))}
            </div>
            <div className="c2k-snap-carousel__fade" aria-hidden />
          </div>
        </section>
      : null}

      <section aria-label="Video channels">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-dc-text">Community channels</h2>
            <p className="mt-1 text-sm text-dc-text-muted">Creator shows and playlists from the media directory.</p>
          </div>
          <Link to="/education?view=videos" className="text-sm font-medium text-dc-accent hover:underline">
            Browse all videos →
          </Link>
        </div>
        {error ?
          <EmptyState inline title="Could not load channels" message={error} actionLabel="Retry" onAction={onRetry} />
        : loading ?
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="dc-skeleton-bone h-28 rounded-2xl" />
            ))}
          </div>
        : mediaShows.length === 0 ?
          <EmptyState
            inline
            title="No video channels yet"
            message="When creators publish video shows, they appear here and on the media hub."
            ctaLabel="Browse media"
            ctaHref="/education?view=videos"
          />
        : <div className="grid gap-4 sm:grid-cols-2">
            {mediaShows.map((show) => (
              <MediaChannelCard key={show.id} show={show} layout="compact" />
            ))}
          </div>
        }
      </section>
    </div>
  )
}

type PodcastsProps = {
  mediaShows: ApiMediaShowListItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

export function EducationPodcastsPanel({ mediaShows, loading, error, onRetry }: PodcastsProps) {
  return (
    <section aria-label="Podcasts">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-dc-text-muted">
            Listen on Spotify, Apple Podcasts, or RSS — surfaced from community media listings.
          </p>
        </div>
          <Link to="/education?view=podcasts" className="text-sm font-medium text-dc-accent hover:underline">
            Browse all podcasts →
          </Link>
      </div>
      {error ?
        <EmptyState inline title="Could not load podcasts" message={error} actionLabel="Retry" onAction={onRetry} />
      : loading ?
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="dc-skeleton-bone h-28 rounded-2xl" />
          ))}
        </div>
      : mediaShows.length === 0 ?
        <EmptyState
          inline
          title="No podcasts listed yet"
          message="Podcast feeds from educators and organizers show up here when published to the media hub."
          ctaLabel="Browse media"
          ctaHref="/education?view=podcasts"
        />
      : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mediaShows.map((show) => (
            <MediaChannelCard key={show.id} show={show} layout="compact" />
          ))}
        </div>
      }
    </section>
  )
}

type ArticlesProps = {
  articles: ApiEducationArticle[]
  loading: boolean
}

export function EducationLibraryPanel({ articles, loading }: ArticlesProps) {
  const [formatFilter, setFormatFilter] = useState<ClassFormat | ''>('')
  const [topicFilter, setTopicFilter] = useState<string | null>(null)

  const snapshot = useMemo(() => buildClassLibrarySnapshot(articles), [articles])
  const filtered = useMemo(
    () => filterClassLibrary(snapshot, formatFilter, topicFilter),
    [snapshot, formatFilter, topicFilter],
  )

  const topics = useMemo(() => {
    const set = new Set<string>()
    snapshot.all.forEach((c) => {
      set.add(c.topic)
      c.tags.forEach((t) => set.add(t))
    })
    return Array.from(set).slice(0, 8)
  }, [snapshot.all])

  const hasActiveFilters = formatFilter !== '' || topicFilter !== null

  return (
    <div className="space-y-8">
      <div className="edu-panel-intro">
        <p>
          Beta preview: each outline is a publishable session plan — objectives, timing blocks, and safety notes —
          linked to live education articles. Scheduled classes will tie to{' '}
          <Link to="/events" className="font-medium text-dc-accent hover:underline">
            events
          </Link>{' '}
          later.
        </p>
        {!loading ?
          <dl className="edu-stat-grid">
            <div>
              <dt>Outlines</dt>
              <dd>{filtered.stats.classCount}</dd>
            </div>
            <div>
              <dt>Educators</dt>
              <dd>{filtered.stats.educatorCount}</dd>
            </div>
            <div>
              <dt>Topics</dt>
              <dd>{filtered.stats.topicCount}</dd>
            </div>
          </dl>
        : null}
      </div>

      <div className="edu-filter-panel">
        <nav className="flex flex-wrap gap-2" aria-label="Class format">
          <TabButton label="All formats" isActive={formatFilter === ''} onClick={() => setFormatFilter('')} />
          {CLASS_FORMAT_FILTER_ORDER.map((format) => (
            <TabButton
              key={format}
              label={CLASS_FORMAT_META[format].label}
              isActive={formatFilter === format}
              onClick={() => setFormatFilter(formatFilter === format ? '' : format)}
            />
          ))}
        </nav>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Class topics">
          <button
            type="button"
            onClick={() => setTopicFilter(null)}
            className={`edu-chip edu-chip--accent-fill ${topicFilter === null ? 'edu-chip--active' : ''}`}
          >
            All topics
          </button>
          {topics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setTopicFilter(topicFilter === topic ? null : topic)}
              className={`edu-chip ${topicFilter === topic ? 'edu-chip--active' : ''}`}
            >
              {topic}
            </button>
          ))}
        </div>

        {hasActiveFilters ?
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setFormatFilter('')
                setTopicFilter(null)
              }}
              className="text-sm font-medium text-dc-accent hover:underline"
            >
              Clear filters
            </button>
          </div>
        : null}
      </div>

      {loading ?
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="dc-skeleton-bone h-64 rounded-2xl" />
          ))}
        </div>
      : filtered.all.length === 0 ?
        <EmptyState
          inline
          title="No outlines match"
          message="Try another format or topic, or browse the full article catalogue."
          ctaLabel="Browse articles"
          ctaHref="/education?view=articles"
        />
      : <>
          {filtered.featured.length > 0 && !hasActiveFilters ?
            <section className="edu-block" aria-label="Featured class outlines">
              <div className="edu-block__head">
                <h2 className="edu-block__title">Featured this month</h2>
                <p className="edu-block__desc">Educator favorites you can run at a munch or convention track.</p>
              </div>
              <div className="space-y-4">
                {filtered.featured.map((outline) => (
                  <EducationClassLibraryCard key={outline.id} outline={outline} layout="featured" />
                ))}
              </div>
            </section>
          : null}

          {filtered.sections.map((section) => (
            <section key={section.id} className="edu-block" aria-labelledby={`class-section-${section.id}`}>
              <div className="edu-block__head">
                <h2 id={`class-section-${section.id}`} className="edu-block__title">
                  {section.title}
                </h2>
                <p className="edu-block__desc">{section.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {section.items.map((outline) => (
                  <EducationClassLibraryCard key={outline.id} outline={outline} />
                ))}
              </div>
            </section>
          ))}

          <div className="edu-cta-banner">
            <div>
              <p className="text-sm font-semibold text-dc-text">Looking for a live workshop?</p>
              <p className="mt-1 text-sm text-dc-text-muted">
                Outlines here are self-study and facilitator guides. Upcoming in-person sessions live on the events calendar.
              </p>
            </div>
            <Link
              to="/events"
              className="mt-3 inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover sm:mt-0"
            >
              Browse events →
            </Link>
          </div>
        </>
      }
    </div>
  )
}
