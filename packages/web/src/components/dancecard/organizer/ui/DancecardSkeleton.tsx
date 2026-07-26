'use client'

function Bone({ className }: { className?: string }) {
  return <div className={`dc-skeleton-bone animate-pulse rounded-lg motion-reduce:animate-none ${className ?? ''}`} />
}

export function DancecardPanelSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-2xl border border-dc-border bg-dc-elevated-muted p-5">
      <Bone className="h-4 w-32" />
      <Bone className="h-8 w-2/3 max-w-xs" />
      {Array.from({ length: lines }).map((_, i) => (
        <Bone key={i} className="h-3 w-full" />
      ))}
    </div>
  )
}

export function DancecardGridSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Bone className="mb-3 h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Bone key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function DancecardNavSkeleton() {
  return (
    <div className="flex gap-2">
      <Bone className="h-9 w-24" />
      <Bone className="h-9 w-20" />
      <Bone className="h-9 w-28" />
    </div>
  )
}

export function DancecardAttendeeShellSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <DancecardNavSkeleton />
      <DancecardPanelSkeleton lines={6} />
      <DancecardGridSkeleton rows={4} />
    </div>
  )
}

export function DancecardListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="dc-skeleton-stagger space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="rounded-xl border border-dc-border bg-dc-elevated-muted p-4">
          <Bone className="h-3 w-20" />
          <Bone className="mt-2 h-5 w-48" />
          <Bone className="mt-2 h-3 w-full" />
        </li>
      ))}
    </ul>
  )
}

export function DancecardTableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-dc-border">
      <div className="flex gap-2 border-b border-dc-border bg-dc-surface-muted px-3 py-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="dc-skeleton-stagger divide-y divide-dc-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-2 px-3 py-3">
            {Array.from({ length: cols }).map((_, j) => (
              <Bone key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Organizer workspace main panel while bootstrap loads. */
export function OrganizerWorkspaceSkeleton() {
  return (
    <div className="dc-skeleton-stagger space-y-4">
      <DancecardPanelSkeleton lines={3} />
      <DancecardGridSkeleton rows={5} />
      <DancecardPanelSkeleton lines={2} />
    </div>
  )
}

/** Full-page organizer bootstrap (Suspense + first paint). */
export function OrganizerBootstrapScreen({ eventSlug }: { eventSlug?: string }) {
  return (
    <div className="relative flex min-h-[calc(100vh-3.25rem)] w-full">
      <aside className="hidden w-56 shrink-0 border-r border-dc-border bg-dc-surface-muted/40 p-4 lg:block">
        <Bone className="h-4 w-32" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bone key={i} className="h-8 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6">
        <Bone className="h-6 w-48 max-w-full" />
        <Bone className="mt-2 h-4 w-64 max-w-full" />
        <p className="mt-8 text-center text-sm text-dc-muted">
          {eventSlug ? `Loading ${eventSlug}…` : 'Loading event workspace…'}
        </p>
        <div className="mt-8">
          <OrganizerWorkspaceSkeleton />
        </div>
      </div>
    </div>
  )
}
