import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActivityEmptyPanel from '@/components/activity/ActivityEmptyPanel'
import ActivityRightRail from '@/components/activity/ActivityRightRail'
import ActivityTabs from '@/components/activity/ActivityTabs'
import type { ActivityTab } from '@/components/activity/activity-ui'
import PersonalUtilityPageShell from '@/components/layout/PersonalUtilityPageShell'
import SavedBackLink from '@/components/saved/SavedBackLink'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import { FeedCardSkeleton } from '@/components/ui/skeleton'
import {
  useApiActivityInbox,
  type ActivityInboxFilter,
  type ActivityInboxItem,
} from '@/hooks/useApiActivityInbox'
import { shortTime } from '@/lib/format-time'
import { ACTIVITY_PAGE_INTRO } from '@/lib/notifications-copy'

function kindLabel(kind: ActivityInboxItem['kind']): string {
  if (kind === 'message') return 'Message'
  if (kind === 'connection_request') return 'Request'
  if (kind === 'notification') return 'Notification'
  return 'Update'
}

export default function ActivityPageClient() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ActivityTab>('all')
  const apiFilter: ActivityInboxFilter = filter
  const { items, error, loading, reload } = useApiActivityInbox(apiFilter)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const rows = items ?? []
  const isEmpty = !loading && rows.length === 0 && !error

  return (
    <PersonalUtilityPageShell
      showMobileNavToggle
      mobileNavOpen={mobileNavOpen}
      onMobileNavToggle={() => setMobileNavOpen((o) => !o)}
    >
      <div className="mx-auto w-full max-w-[52rem]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0">
            <SavedBackLink />

            <header className="mt-4 mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">Activity</h1>
              <p className="mt-2 text-sm leading-relaxed text-dc-text-muted">{ACTIVITY_PAGE_INTRO}</p>
            </header>

            <ActivityTabs active={filter} onChange={setFilter} />

            {error ?
              <LoadErrorBanner className="mb-4" message={error} onRetry={() => void reload()} />
            : null}

            {loading && items === null ?
              <div className="dc-skeleton-stagger space-y-4">
                <FeedCardSkeleton />
                <FeedCardSkeleton />
              </div>
            : isEmpty ?
              <ActivityEmptyPanel />
            : <ul className="space-y-1.5 sm:space-y-2">
                {rows.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(item.href)}
                      className={`flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors sm:gap-3 sm:px-3 sm:py-3 ${
                        item.unread ?
                          'border-dc-accent-border/40 bg-dc-elevated-solid shadow-[var(--dc-shadow-soft)]'
                        : 'border-dc-border bg-dc-elevated-solid/80 hover:border-dc-accent-border/30'
                      }`}
                    >
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dc-elevated-muted text-[10px] font-semibold uppercase tracking-wide text-dc-muted">
                        {kindLabel(item.kind).slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted sm:text-[11px]">
                            {kindLabel(item.kind)}
                          </span>
                          <span className="text-[11px] text-dc-muted">{shortTime(item.createdAt)}</span>
                          {item.unread ?
                            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-dc-accent" aria-label="Unread" />
                          : null}
                        </div>
                        <p className="text-sm font-medium leading-snug text-dc-text">{item.title}</p>
                        {item.body ?
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-dc-text-muted sm:text-sm">{item.body}</p>
                        : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            }

            <div className="mt-8 lg:hidden">
              <ActivityRightRail />
            </div>
          </div>

          <div className="hidden lg:block">
            <ActivityRightRail />
          </div>
        </div>
      </div>
    </PersonalUtilityPageShell>
  )
}
