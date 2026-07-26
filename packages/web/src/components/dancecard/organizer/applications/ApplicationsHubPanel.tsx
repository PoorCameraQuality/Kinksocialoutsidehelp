'use client'

import { useState } from 'react'
import { RoleWindowsBoard } from '@/components/dancecard/organizer/applications/RoleWindowsBoard'
import { VettingQueuePanel } from '@/components/dancecard/organizer/VettingQueuePanel'
import { PresenterRequestsPanel } from '@/components/dancecard/organizer/program/PresenterRequestsPanel'
import type { ConventionCommandPermissions } from '@c2k/shared'
import { cn } from '@/lib/cn'

type QueueTab = 'trusted' | 'presenters'

const QUEUE_TABS: Array<{ id: QueueTab; label: string }> = [
  { id: 'trusted', label: 'Role applications' },
  { id: 'presenters', label: 'Presenter requests' },
]

export function ApplicationsHubPanel({
  eventSlug,
  permissions,
  readOnly,
  timezone,
  onProgramRefresh,
}: {
  eventSlug: string
  permissions: ConventionCommandPermissions
  readOnly: boolean
  timezone: string
  onProgramRefresh: () => Promise<void>
}) {
  const [queueTab, setQueueTab] = useState<QueueTab>('trusted')

  return (
    <div className="space-y-8 text-sm text-dc-text">
      <header className="space-y-1">
        <h1 className="font-serif text-xl text-dc-text">Applications</h1>
        <p className="max-w-2xl text-sm text-dc-muted">
          One control surface for every way people apply to help at your event. Toggle each window open or closed above,
          then review and decide on submissions below.
        </p>
      </header>

      <RoleWindowsBoard eventSlug={eventSlug} permissions={permissions} readOnly={readOnly} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-dc-border">
          {QUEUE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium transition',
                queueTab === t.id
                  ? 'border-dc-accent text-dc-accent'
                  : 'border-transparent text-dc-muted hover:text-dc-text',
              )}
              aria-current={queueTab === t.id ? 'true' : undefined}
              onClick={() => setQueueTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {queueTab === 'trusted' ? (
          <VettingQueuePanel eventSlug={eventSlug} permissions={permissions} embedded />
        ) : (
          <PresenterRequestsPanel
            conventionKey={eventSlug}
            timezone={timezone}
            readOnly={readOnly}
            onPromoted={onProgramRefresh}
            embedded
          />
        )}
      </section>
    </div>
  )
}
