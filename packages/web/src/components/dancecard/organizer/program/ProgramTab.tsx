'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGuideState } from '@/lib/dancecard/guides/useGuideState'
import { ProgramScheduleGrid } from '@/components/dancecard/organizer/ProgramScheduleGrid'
import { ConflictDock } from '@/components/dancecard/organizer/program/ConflictDock'
import { useProgramConflicts } from '@/components/dancecard/organizer/program/useProgramConflicts'
import { PresenterRequestsPanel } from '@/components/dancecard/organizer/program/PresenterRequestsPanel'
import { ProgramListView } from '@/components/dancecard/organizer/program/ProgramListView'
import { useEventProfileLabels } from '@/hooks/useEventProfileLabels'
import { ProgramEventWindowBar } from '@/components/dancecard/organizer/program/ProgramEventWindowBar'
import { ProgramVisibilityCard } from '@/components/dancecard/organizer/program/ProgramVisibilityCard'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import { computeProgramSlotStats } from '@/lib/dancecard/programSlotStats'

type Props = {
  eventSlug: string
  eventProfile?: string | null
  eventStatus?: string
  timezone: string
  windowStartsAt: string
  windowEndsAt: string
  slots: ProgramSlotRow[]
  onRefresh: () => Promise<void>
  readOnly: boolean
  initialSlotId: string | null
  onSlotLinkChange: (slotId: string | null) => void
  hasEventWindow: boolean
  onGoSettings: () => void
  onEventWindowUpdated: (window: { windowStartsAt: string; windowEndsAt: string }) => void
  onConflictsScanned?: () => void
  conflictSonarActive?: boolean
  onOpenScheduleCredits?: () => void
  onLaunchConflictGuide?: () => void
  publishFilterDraft?: boolean
  onPublishFilterChange?: (draft: boolean) => void
  onOpenImport?: () => void
  onPreviewAttendeeSchedule?: () => void
  wideCanvas?: boolean
}

export function ProgramTab({
  eventSlug,
  eventProfile,
  eventStatus = 'draft',
  timezone,
  windowStartsAt,
  windowEndsAt,
  slots,
  onRefresh,
  readOnly,
  initialSlotId,
  onSlotLinkChange,
  hasEventWindow,
  onGoSettings,
  onEventWindowUpdated,
  onConflictsScanned,
  conflictSonarActive,
  onOpenScheduleCredits,
  onLaunchConflictGuide,
  publishFilterDraft = false,
  onPublishFilterChange,
  onOpenImport,
  onPreviewAttendeeSchedule,
  wideCanvas,
}: Props) {
  const { conflicts, loading: conflictsLoading, loadError, refresh, lastScannedAt } = useProgramConflicts(eventSlug)
  const { labels: profileLabels } = useEventProfileLabels({ eventSlug, source: 'organizer', eventProfile })
  const { reset: startProgramTour } = useGuideState(eventSlug, 'program-rehearsal')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [drawerTab, setDrawerTab] = useState<'overview' | 'edit' | 'privacy' | undefined>()
  const [focusSlotId, setFocusSlotId] = useState<string | null>(initialSlotId)
  const [roomCount, setRoomCount] = useState<number | null>(null)
  const [draftOnlyFilter, setDraftOnlyFilter] = useState(publishFilterDraft)

  useEffect(() => {
    setDraftOnlyFilter(publishFilterDraft)
  }, [publishFilterDraft])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 768px)').matches) setView('list')
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await organizerDancecardFetch<{ locations: { id: string; parentId?: string | null }[] }>(
          eventSlug,
          '/locations',
        )
        if (cancelled) return
        const locs = res.locations ?? []
        const leaves = locs.filter((l) => !locs.some((c) => c.parentId === l.id))
        setRoomCount(leaves.length || locs.length)
      } catch {
        if (!cancelled) setRoomCount(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventSlug])

  const slotStats = useMemo(() => computeProgramSlotStats(slots), [slots])
  const displaySlots = useMemo(() => {
    if (!draftOnlyFilter) return slots
    return slots.filter((s) => !s.isPublished)
  }, [slots, draftOnlyFilter])

  const eventPublished = eventStatus === 'published'

  useEffect(() => {
    if (!initialSlotId) {
      setFocusSlotId(null)
      return
    }
    if (slots.some((s) => s.id === initialSlotId)) setFocusSlotId(initialSlotId)
  }, [initialSlotId, slots])

  const openSlot = useCallback(
    (id: string, opts?: { editTab?: 'edit' | 'privacy' }) => {
      setFocusSlotId(id)
      onSlotLinkChange(id)
      if (opts?.editTab) setDrawerTab(opts.editTab)
    },
    [onSlotLinkChange],
  )

  const toggleDraftFilter = useCallback(
    (next: boolean) => {
      setDraftOnlyFilter(next)
      onPublishFilterChange?.(next)
    },
    [onPublishFilterChange],
  )

  return (
    <div className="space-y-3">
      <ProgramEventWindowBar
        eventSlug={eventSlug}
        timezone={timezone}
        windowStartsAt={windowStartsAt}
        windowEndsAt={windowEndsAt}
        hasEventWindow={hasEventWindow}
        slotStats={slotStats}
        roomCount={roomCount}
        readOnly={readOnly}
        onSaved={onEventWindowUpdated}
        onGoSettings={onGoSettings}
      />

      {hasEventWindow ? (
        <ProgramVisibilityCard
          stats={slotStats}
          eventPublished={eventPublished}
          readOnly={readOnly}
          publishFilterDraft={draftOnlyFilter}
          onShowDrafts={() => toggleDraftFilter(true)}
          onClearDraftFilter={() => toggleDraftFilter(false)}
          onOpenListView={() => setView('list')}
          onPreviewAttendeeSchedule={onPreviewAttendeeSchedule}
        />
      ) : null}

      {!hasEventWindow ? (
        <p className="rounded-lg border border-dc-warning/30 bg-dc-warning-muted px-3 py-2 text-sm text-dc-warning">
          Save event start and end above to unlock the schedule grid.
        </p>
      ) : null}

      <PresenterRequestsPanel
        conventionKey={eventSlug}
        timezone={timezone}
        readOnly={readOnly}
        onPromoted={onRefresh}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dc-border-subtle bg-dc-surface-muted/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={
              view === 'grid'
                ? 'rounded-lg bg-dc-accent/20 px-3 py-1 text-sm text-dc-accent'
                : 'rounded-lg border border-dc-border px-3 py-1 text-sm text-dc-muted'
            }
            onClick={() => setView('grid')}
          >
            Grid
          </button>
          <button
            type="button"
            className={
              view === 'list'
                ? 'rounded-lg bg-dc-accent/20 px-3 py-1 text-sm text-dc-accent'
                : 'rounded-lg border border-dc-border px-3 py-1 text-sm text-dc-muted'
            }
            onClick={() => setView('list')}
          >
            List
          </button>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-1.5 border-l border-dc-border-subtle pl-2">
            <button
              type="button"
              className="rounded-lg bg-dc-accent px-3 py-1 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
              onClick={() => {
                setView('grid')
                window.dispatchEvent(new CustomEvent('dc-program-open-create'))
              }}
            >
              + {profileLabels.addItemCta}
            </button>
            {onOpenImport ? (
              <button
                type="button"
                className="rounded-lg border border-dc-border px-3 py-1 text-sm text-dc-text hover:bg-dc-elevated-muted/80"
                onClick={onOpenImport}
              >
                Import schedule
              </button>
            ) : null}
          </div>
        ) : null}
        {slotStats.draft > 0 ? (
          <button
            type="button"
            className={
              draftOnlyFilter
                ? 'rounded-lg bg-amber-500/20 px-3 py-1 text-sm text-amber-200'
                : 'rounded-lg border border-dc-border px-3 py-1 text-sm text-dc-muted'
            }
            onClick={() => toggleDraftFilter(!draftOnlyFilter)}
          >
            {draftOnlyFilter ? 'Draft only (on)' : 'Draft only'}
          </button>
        ) : null}
        {onPreviewAttendeeSchedule ? (
          <button
            type="button"
            className="rounded-lg border border-dc-border px-3 py-1 text-sm text-dc-accent hover:bg-dc-elevated-muted/80"
            onClick={onPreviewAttendeeSchedule}
          >
            Preview attendee schedule ↗
          </button>
        ) : null}
        <button
          type="button"
          className="ml-auto rounded-lg border border-dc-border px-3 py-1 text-sm text-dc-muted hover:bg-dc-elevated-muted/80 hover:text-dc-text"
          onClick={() => startProgramTour()}
        >
          Grid tour
        </button>
      </div>

      {hasEventWindow && view === 'grid' ? (
        <p className="rounded-lg border border-dc-border-subtle bg-dc-surface-muted/50 px-3 py-2 text-xs text-dc-muted">
          Click the gold <span className="font-semibold text-dc-accent">Edit</span> button on any block, or{' '}
          <span className="font-medium text-dc-text">double-click</span> the block, to open session details. Drag
          unscheduled sessions onto the grid to schedule them. Publish per session via the drawer Visibility tab or bulk
          selection. There is no separate “publish program” action.
          {onOpenImport ? (
            <>
              {' '}
              <button type="button" className="text-dc-accent hover:underline" onClick={onOpenImport}>
                Import
              </button>{' '}
              adds rows to the same program; review and publish here.
            </>
          ) : null}
        </p>
      ) : null}

      {hasEventWindow && draftOnlyFilter ? (
        <p className="rounded-lg border border-dc-warning/30 bg-dc-warning-muted px-3 py-2 text-sm text-dc-warning">
          Showing {displaySlots.length} draft (unpublished) session{displaySlots.length === 1 ? '' : 's'}. Use checkboxes
          on the grid for bulk publish, or open a session drawer → Visibility.
        </p>
      ) : null}

      {loadError ? (
        <p className="rounded-lg border border-dc-danger/30 bg-dc-danger-muted px-3 py-2 text-sm text-dc-danger">
          {loadError}
        </p>
      ) : null}

      {hasEventWindow ? (
        <ConflictDock
          loading={conflictsLoading && !loadError}
          conflicts={loadError ? [] : conflicts}
          slots={slots}
          lastScannedAt={lastScannedAt}
          onScan={() => void refresh()}
          onOpenSlot={(slotId, opts) => openSlot(slotId, opts)}
          onOpenBoth={(a) => openSlot(a)}
          onOpenScheduleCredits={onOpenScheduleCredits}
          onLaunchConflictGuide={onLaunchConflictGuide}
        />
      ) : null}

      {hasEventWindow && view === 'list' ? (
        <ProgramListView
          eventSlug={eventSlug}
          timezone={timezone}
          slots={displaySlots}
          readOnly={readOnly}
          draftOnly={draftOnlyFilter}
          onOpenSlot={(id) => openSlot(id)}
          onAddSession={() => {
            setView('grid')
            window.dispatchEvent(new CustomEvent('dc-program-open-create'))
          }}
        />
      ) : null}

      {hasEventWindow && view === 'grid' ? (
        <ProgramScheduleGrid
          eventSlug={eventSlug}
          timezone={timezone}
          windowStartsAt={windowStartsAt}
          windowEndsAt={windowEndsAt}
          slots={displaySlots}
          onRefresh={onRefresh}
          readOnly={readOnly}
          initialSlotId={focusSlotId}
          drawerInitialTab={drawerTab}
          onDrawerTabConsumed={() => setDrawerTab(undefined)}
          onSlotLinkChange={(id) => {
            if (id) {
              openSlot(id)
            } else {
              setFocusSlotId(null)
              onSlotLinkChange(null)
            }
          }}
          conflictSlotIds={conflicts.flatMap((c) => c.relatedSlotIds)}
          conflictSonarActive={conflictSonarActive}
          onConflictsRefresh={async () => {
            await refresh()
            onConflictsScanned?.()
          }}
          wideCanvas={wideCanvas}
          gridLabels={{
            scheduledItem: profileLabels.scheduledItem,
            scheduledItemPlural: profileLabels.scheduledItemPlural,
            addItemCta: profileLabels.addItemCta,
          }}
          onOpenImport={onOpenImport}
        />
      ) : null}

      <p className="text-xs text-dc-muted">
        After the program is ready, run ECKE / Dancecard attendee publish from{' '}
        <span className="text-dc-text">Integrations</span>. Grid edits do not automatically sync to external surfaces.
      </p>
    </div>
  )
}
