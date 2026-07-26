'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConventionCommandPermissions } from '@c2k/shared'
import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import { Panel } from '@/components/dancecard/ui/Panel'
import { isTabAllowed } from '@/lib/dancecard/commandBridgeNavPermissions'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import { computeProgramSlotStats } from '@/lib/dancecard/programSlotStats'
import { parseEckeControlPlaneSummary } from '@/lib/ecke-control-plane-summary'
import { cn } from '@/lib/cn'

type PublishTarget = {
  targetKind: 'ecke_listing' | 'dancecard_event' | 'ecke_event'
  status: 'never' | 'draft' | 'published' | 'error' | 'stale'
}

const TARGET_LABELS: Record<string, string> = {
  dancecard_event: 'Dancecard on kink.social',
  ecke_listing: 'ECKE Events',
  ecke_event: 'ECKE Events',
}

function statusRow(status: PublishTarget['status'] | 'unknown'): { label: string; tone: string } {
  switch (status) {
    case 'published':
      return { label: 'Published', tone: 'text-emerald-300' }
    case 'draft':
      return { label: 'Preview ready', tone: 'text-amber-200' }
    case 'stale':
      return { label: 'Changes pending', tone: 'text-amber-200' }
    case 'error':
      return { label: 'Publish failed', tone: 'text-red-300' }
    case 'never':
      return { label: 'Not published', tone: 'text-dc-muted' }
    default:
      return { label: 'Unknown', tone: 'text-dc-muted' }
  }
}

function programVisibilityStatus(stats: ReturnType<typeof computeProgramSlotStats>): PublishTarget['status'] {
  if (stats.published === 0) return 'never'
  if (stats.draft > 0) return 'stale'
  return 'published'
}

export function DashboardAttendeeSurfaces({
  eventSlug,
  event,
  slots,
  permissions,
  publicHref,
  readOnly,
  onOpenIntegrations,
  onOpenExports,
}: {
  eventSlug: string
  event: EventSettingsEventDto | null
  slots: ProgramSlotRow[]
  permissions: ConventionCommandPermissions
  publicHref?: string
  readOnly?: boolean
  onOpenIntegrations: () => void
  onOpenExports?: () => void
}) {
  const [publish, setPublish] = useState<ReturnType<typeof parseEckeControlPlaneSummary> | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/conventions/${encodeURIComponent(eventSlug)}/ecke-publish`, {
        credentials: 'include',
      })
      if (!r.ok) return
      setPublish(parseEckeControlPlaneSummary(await r.json()))
    } catch {
      /* optional */
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  const eckeStatus = publish?.aggregateStatus ?? (publish?.bridgeConnected ? 'never' : 'unknown')
  const eventPagePublished = event?.status === 'published'
  const slotStats = useMemo(() => computeProgramSlotStats(slots), [slots])
  const canAccessIntegrations = permissions.isFullAdmin || isTabAllowed('integrations', permissions)

  const rows = [
    {
      label: 'Public event page',
      status: eventPagePublished ? ('published' as const) : ('never' as const),
    },
    {
      label: TARGET_LABELS.ecke_event,
      status: eckeStatus,
    },
    {
      label: TARGET_LABELS.dancecard_event,
      status: 'unknown' as const,
    },
    {
      label: 'Program visibility (kink.social)',
      status: programVisibilityStatus(slotStats),
    },
  ]

  return (
    <Panel className="h-full">
      <h2 className="font-serif text-lg text-dc-text">Attendee surfaces</h2>
      <p className="mt-1 text-xs text-dc-muted">
        What attendees see on the public page and Dancecard app.
      </p>
      {!eventPagePublished ? (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
          Attendees cannot see the final program until you publish attendee surfaces.
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {rows.map((row) => {
          const st = statusRow(row.status as PublishTarget['status'])
          return (
            <li key={row.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-dc-text">{row.label}</span>
              <span className={cn('text-xs font-medium', st.tone)}>{st.label}</span>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {publicHref ? (
          <a
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-dc-border px-3 py-1.5 text-xs font-medium text-dc-text hover:border-dc-accent-border"
          >
            Preview attendee page ↗
          </a>
        ) : null}
        {!readOnly && canAccessIntegrations ? (
          <button
            type="button"
            className="rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
            onClick={onOpenIntegrations}
          >
            Build publish preview
          </button>
        ) : null}
        {!readOnly && onOpenExports ? (
          <button
            type="button"
            className="rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-muted hover:text-dc-text"
            onClick={onOpenExports}
          >
            Exports
          </button>
        ) : null}
      </div>
    </Panel>
  )
}
