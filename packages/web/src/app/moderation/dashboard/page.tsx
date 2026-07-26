import { Link, useOutletContext } from 'react-router-dom'
import {
  MODERATION_QUEUES,
  MODERATION_QUEUE_VALUES,
  POLICY_SEVERITIES,
  POLICY_SEVERITY_VALUES,
} from '@c2k/shared'
import { useApiModerationTsDashboard } from '@/hooks/useApiModerationTs'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'
import {
  PlatformModAlert,
  PlatformModDashboardSkeleton,
  PlatformModEmptyState,
  PlatformModListRow,
  PlatformModMetricGrid,
  PlatformModPrinciplesCard,
  PlatformModSection,
  PlatformModSectionHeader,
  PlatformModSeverityGrid,
  type PlatformModMetric,
} from '@/components/moderation/platform-moderation-ui'
import {
  defaultModerationOutletContext,
  type ModerationOutletContext,
} from '@/lib/moderation/moderation-outlet-context'
import {
  labelModerationQueue,
  labelModerationReason,
  labelModerationStatus,
  moderationSeverityBadgeClass,
} from '@/lib/moderation/platform-labels'

export default function ModerationDashboardPage() {
  const { moderationRefreshKey, refreshModeration, summary } =
    useOutletContext<ModerationOutletContext>() ?? defaultModerationOutletContext
  const { status, data, error, reload } = useApiModerationTsDashboard(true, moderationRefreshKey)
  const { staff } = useApiPlatformStaff(true)

  const handleRefresh = () => {
    refreshModeration()
    void reload()
  }

  const visibleQueues = MODERATION_QUEUE_VALUES.filter(
    (queue) =>
      queue !== MODERATION_QUEUES.minorSafetyRestricted || staff?.siteAdmin || data?.canViewRestrictedQueue,
  )

  const isEmpty =
    data &&
    data.openCases === 0 &&
    data.openQueueItems === 0 &&
    Object.values(data.bySeverity).every((n) => n === 0)

  const metrics: PlatformModMetric[] =
    data ?
      [
        {
          label: 'Open cases',
          value: data.openCases,
          hint: 'Open, triaged, or escalated',
          href: '/moderation/cases',
          linkLabel: 'View cases',
          urgent: data.openCases > 0,
        },
        {
          label: 'Queue items',
          value: data.openQueueItems,
          hint: 'Awaiting assignment or claim',
          href: '/moderation/cases?tab=open',
          linkLabel: 'Open cases',
        },
        {
          label: 'Open reports',
          value: summary?.openReports ?? 0,
          hint: 'Legacy member report intake',
          href: '/moderation/cases?tab=legacy-reports',
          linkLabel: 'Review reports',
          urgent: (summary?.openReports ?? 0) > 0,
        },
        {
          label: 'Profile flags',
          value: summary?.openProfileFlags ?? 0,
          hint: 'Trust flags on public profiles',
          href: '/moderation/profile-flags',
          linkLabel: 'Review flags',
          urgent: (summary?.openProfileFlags ?? 0) > 0,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <PlatformModSectionHeader
        title="Overview"
        description="Queue and severity counts for cases awaiting review. Start with P0 alerts, then recent cases."
      />

      {status === 'loading' ?
        <PlatformModDashboardSkeleton />
      : null}

      {error ?
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 space-y-2" role="alert">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-sm font-medium text-dc-accent hover:underline"
          >
            Retry
          </button>
        </div>
      : null}

      {status === 'ready' && data ?
        <>
          <div className="space-y-3">
            {(data.nciiUrgentCount ?? 0) > 0 ?
              <PlatformModAlert tone="critical">
                <strong>{data.nciiUrgentCount}</strong> open NCII-urgent case
                {(data.nciiUrgentCount ?? 0) === 1 ? '' : 's'} —{' '}
                <Link
                  to={`/moderation/cases?queue=${encodeURIComponent(MODERATION_QUEUES.nciiUrgent)}`}
                  className="font-medium text-dc-accent hover:underline"
                >
                  review now
                </Link>
              </PlatformModAlert>
            : null}

            {staff?.siteAdmin && (data.minorSafetyRestrictedCount ?? 0) > 0 ?
              <PlatformModAlert tone="warning">
                <strong>{data.minorSafetyRestrictedCount}</strong> minor-safety restricted case
                {(data.minorSafetyRestrictedCount ?? 0) === 1 ? '' : 's'} (site admin only) —{' '}
                <Link
                  to={`/moderation/cases?queue=${encodeURIComponent(MODERATION_QUEUES.minorSafetyRestricted)}`}
                  className="font-medium text-dc-accent hover:underline"
                >
                  open queue
                </Link>
              </PlatformModAlert>
            : null}
          </div>

          <PlatformModMetricGrid metrics={metrics} />

          {isEmpty ?
            <PlatformModEmptyState
              title="No open moderation cases"
              description="When members report content, cases appear here with queue routing. File a test report from a non-admin account to exercise the workflow."
              actionHref="/moderation/cases?tab=legacy-reports"
              actionLabel="Open reports"
            />
          : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <PlatformModSection>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-dc-text">Recent cases</h3>
                <Link to="/moderation/cases" className="text-xs font-medium text-dc-accent hover:underline">
                  View all
                </Link>
              </div>
              {data.recentCases && data.recentCases.length > 0 ?
                <ul className="space-y-2">
                  {data.recentCases.map((c) => (
                    <li key={c.id}>
                      <PlatformModListRow
                        href={`/moderation/cases/${encodeURIComponent(c.id)}`}
                        title={labelModerationReason(c.policyReason)}
                        meta={`${labelModerationQueue(c.queue)} · ${c.severity} · ${labelModerationStatus(c.status)} · ${new Date(c.createdAt).toLocaleString()}`}
                        badge={c.severity}
                        badgeClassName={moderationSeverityBadgeClass(c.severity)}
                      />
                    </li>
                  ))}
                </ul>
              : (
                <p className="text-sm text-dc-text-muted">No recent cases yet.</p>
              )}
            </PlatformModSection>

            <div className="space-y-6">
              <PlatformModSection>
                <PlatformModSectionHeader
                  title="By severity"
                  description="Filter the case inbox by policy severity."
                />
                <PlatformModSeverityGrid severities={POLICY_SEVERITY_VALUES} counts={data.bySeverity} />
                {data.bySeverity[POLICY_SEVERITIES.critical] ?
                  <p className="mt-3 text-xs leading-relaxed text-amber-200/90">
                    Critical cases may include P0 policy reasons. Prioritize NCII and minor-safety queues first.
                  </p>
                : null}
              </PlatformModSection>

              <PlatformModSection>
                <PlatformModSectionHeader title="By queue" description="Route work to the right specialist queue." />
                <ul className="space-y-2">
                  {visibleQueues.map((queue) => {
                    const count = data.byQueue[queue] ?? 0
                    return (
                      <li key={queue}>
                        <PlatformModListRow
                          href={`/moderation/cases?tab=open&queue=${encodeURIComponent(queue)}`}
                          title={labelModerationQueue(queue)}
                          badge={count}
                          badgeClassName={
                            queue === MODERATION_QUEUES.nciiUrgent && count > 0 ?
                              'bg-red-500/20 text-red-200'
                            : undefined
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              </PlatformModSection>
            </div>
          </div>

          <PlatformModPrinciplesCard />
        </>
      : null}
    </div>
  )
}
