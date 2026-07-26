'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { VenueAvailabilityGrid } from '@/components/dancecard/organizer/VenueAvailabilityGrid'
import { VenuesSetupPanel } from '@/components/dancecard/organizer/venue/VenuesSetupPanel'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import type { OrganizerStaffShiftDto } from '@/lib/dancecard/organizerStaffShiftDto'
import { cn } from '@/lib/cn'

export const VENUES_PANEL_PARAM = 'venuesPanel'
export type VenuesPanel = 'assign' | 'setup'

function parseVenuesPanel(raw: string | null): VenuesPanel {
  return raw === 'setup' ? 'setup' : 'assign'
}

export function VenuesTabPanel({
  eventSlug,
  timezone,
  slots,
  shifts,
  onRefresh,
  onSlotUpdated,
  readOnly,
}: {
  eventSlug: string
  timezone: string
  slots: ProgramSlotRow[]
  shifts?: OrganizerStaffShiftDto[]
  onRefresh: () => void | Promise<void>
  onSlotUpdated?: (slot: ProgramSlotRow) => void
  readOnly: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const panel = parseVenuesPanel(searchParams.get(VENUES_PANEL_PARAM))
  const [mapRefreshToken, setMapRefreshToken] = useState(0)

  const setPanel = useCallback(
    (next: VenuesPanel) => {
      const params = new URLSearchParams(searchParams)
      params.set('tab', 'venues')
      if (next === 'setup') params.set(VENUES_PANEL_PARAM, 'setup')
      else params.delete(VENUES_PANEL_PARAM)
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const bumpMapRefresh = useCallback(() => {
    setMapRefreshToken((n) => n + 1)
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-dc-text">Room availability</h2>
          <p className="mt-1 max-w-2xl text-sm text-dc-muted">
            Create rooms, upload a floor plan, place pins, then assign classes by time or on the map.
          </p>
        </div>
        <div
          className="inline-flex rounded-full border border-dc-border bg-dc-surface-muted p-1"
          role="tablist"
          aria-label="Venues views"
        >
          {(
            [
              ['assign', 'Assign classes'],
              ['setup', 'Rooms & floor plan'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={panel === key}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                panel === key
                  ? 'bg-dc-accent text-dc-accent-foreground shadow-sm'
                  : 'text-dc-muted hover:text-dc-text',
              )}
              onClick={() => setPanel(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {panel === 'setup' ? (
        <VenuesSetupPanel eventSlug={eventSlug} canEdit={!readOnly} onChanged={bumpMapRefresh} />
      ) : (
        <VenueAvailabilityGrid
          eventSlug={eventSlug}
          timezone={timezone}
          slots={slots}
          shifts={shifts}
          onRefresh={onRefresh}
          onSlotUpdated={onSlotUpdated}
          readOnly={readOnly}
          mapRefreshToken={mapRefreshToken}
          onGoSetup={() => setPanel('setup')}
        />
      )}
    </div>
  )
}
