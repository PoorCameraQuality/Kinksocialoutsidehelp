import { useMemo } from 'react'

import EducationLearningPaths from '@/components/education/EducationLearningPaths'
import EducationSectionHeader from '@/components/education/EducationSectionHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useApiEducationHubSeries } from '@/hooks/useApiEducationSeries'
import { hubSeriesToLearningPaths, MOCK_LEARNING_PATHS } from '@/lib/education-discover-data'
import { EDUCATION_VIEW_META } from '@/lib/education-section-mode'

export default function EducationPathsPage() {
  const meta = EDUCATION_VIEW_META.paths
  const hubSeries = useApiEducationHubSeries(true)

  const paths = useMemo(() => {
    if (hubSeries.status === 'ready' && hubSeries.items.length > 0) {
      return hubSeriesToLearningPaths(hubSeries.items)
    }
    return MOCK_LEARNING_PATHS
  }, [hubSeries.status, hubSeries.items])

  const usingLiveSeries = hubSeries.status === 'ready' && hubSeries.items.length > 0

  return (
    <div>
      <EducationSectionHeader title={meta.title} subtitle={meta.subtitle} />
      {usingLiveSeries ?
        <p className="mb-6 rounded-xl border border-dc-border bg-dc-elevated/80 px-4 py-3 text-sm text-dc-text-muted">
          Live learning paths from published article series. Progress tracking is planned — modules link to real
          articles you can read now.
        </p>
      : <p className="mb-6 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Paths below use demo progress for now. Account-backed progress and certificates are planned. Modules still link
          to real articles where available.
        </p>
      }
      {hubSeries.error ?
        <EmptyState
          inline
          className="mb-6 rounded-2xl border border-dc-border bg-dc-elevated-solid"
          title="Could not load learning paths"
          message={hubSeries.error}
          actionLabel="Retry"
          onAction={hubSeries.reload}
          secondaryCtaLabel="Browse articles"
          secondaryCtaHref="/education?view=articles"
        />
      : null}
      {hubSeries.status === 'loading' ?
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dc-skeleton-bone h-80 rounded-2xl" />
          ))}
        </div>
      : <EducationLearningPaths paths={paths} showTitle={false} />}
    </div>
  )
}
