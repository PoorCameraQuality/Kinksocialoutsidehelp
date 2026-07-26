'use client'

import { useEffect, useState } from 'react'
import {
  OrganizerCommandPalette,
  useOrganizerCommandPaletteHotkey,
} from '@/components/dancecard/organizer/OrganizerCommandPalette'
import { OrganizerShortcutsLegend } from '@/components/dancecard/organizer/OrganizerShortcutsLegend'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useOrganizerCommandContext } from '@/components/dancecard/organizer/OrganizerCommandContext'

export function OrganizerCommandShell({
  eventSlug,
  children,
}: {
  eventSlug: string | null
  children: React.ReactNode
}) {
  const commandCtx = useOrganizerCommandContext()
  const [open, setOpen] = useState(false)
  const [fuzzy, setFuzzy] = useState<{ id: string; label: string; kind: 'person' | 'location' | 'track' }[]>([])

  useOrganizerCommandPaletteHotkey(() => setOpen(true))

  useEffect(() => {
    if (!eventSlug || !open) return
    let cancelled = false
    ;(async () => {
      try {
        const [people, locs, tracks] = await Promise.all([
          organizerDancecardFetch<{ people: { id: string; sceneName: string }[] }>(eventSlug, '/people'),
          organizerDancecardFetch<{ locations: { id: string; name: string }[] }>(eventSlug, '/locations'),
          organizerDancecardFetch<{ tracks: { id: string; name: string }[] }>(eventSlug, '/tracks'),
        ])
        if (cancelled) return
        setFuzzy([
          ...(people.people ?? []).map((p) => ({ id: p.id, label: p.sceneName, kind: 'person' as const })),
          ...(locs.locations ?? []).map((l) => ({ id: l.id, label: l.name, kind: 'location' as const })),
          ...(tracks.tracks ?? []).map((t) => ({ id: t.id, label: t.name, kind: 'track' as const })),
        ])
      } catch {
        if (!cancelled) setFuzzy([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventSlug, open])

  const context = commandCtx

  return (
    <>
      {children}
      {context ? (
        <OrganizerCommandPalette
          open={open}
          onClose={() => setOpen(false)}
          context={context}
          fuzzyOptions={fuzzy}
        />
      ) : null}
      <OrganizerShortcutsLegend />
    </>
  )
}
