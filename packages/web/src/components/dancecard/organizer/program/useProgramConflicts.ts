'use client'

import { useCallback, useEffect, useState } from 'react'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import type { DancecardConflict } from '@/lib/dancecard/conflictScanner'

export function useProgramConflicts(eventSlug: string) {
  const [conflicts, setConflicts] = useState<DancecardConflict[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lastScannedAt, setLastScannedAt] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await organizerDancecardFetch<{ conflicts: DancecardConflict[] }>(
        eventSlug,
        '/program-conflicts',
      )
      setConflicts(res.conflicts ?? [])
      setLastScannedAt(new Date())
    } catch (e) {
      setConflicts([])
      setLoadError(e instanceof Error ? e.message : 'Could not load schedule conflicts')
    } finally {
      setLoading(false)
    }
  }, [eventSlug])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { conflicts, loading, loadError, refresh, lastScannedAt }
}
