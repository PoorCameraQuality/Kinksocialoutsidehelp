import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export type PeopleSuggestionRow = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  sharedCount?: number
}

type SuggestedApiItem = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  sharedCount?: number
}

function mapItem(row: SuggestedApiItem): PeopleSuggestionRow {
  return {
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    sharedCount: row.sharedCount,
  }
}

export function usePeopleConnectionSuggestions(enabled: boolean) {
  const { isAuthenticated, status } = useAuth()
  const [coAttendance, setCoAttendance] = useState<PeopleSuggestionRow[]>([])
  const [nearby, setNearby] = useState<PeopleSuggestionRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!enabled || !isAuthenticated) {
      setCoAttendance([])
      setNearby([])
      return
    }
    setLoading(true)
    try {
      const [coRes, nearbyRes] = await Promise.all([
        fetch('/api/v1/connections/suggested?source=co_attendance&limit=4', { credentials: 'include' }),
        fetch('/api/v1/connections/suggested?source=nearby&limit=8', { credentials: 'include' }),
      ])
      if (coRes.ok) {
        const data = (await coRes.json()) as { items: SuggestedApiItem[] }
        setCoAttendance((data.items ?? []).map(mapItem))
      } else {
        setCoAttendance([])
      }
      if (nearbyRes.ok) {
        const data = (await nearbyRes.json()) as { items: SuggestedApiItem[] }
        setNearby((data.items ?? []).map(mapItem))
      } else {
        setNearby([])
      }
    } catch {
      setCoAttendance([])
      setNearby([])
    } finally {
      setLoading(false)
    }
  }, [enabled, isAuthenticated])

  useEffect(() => {
    if (status !== 'ready') return
    void load()
  }, [status, load])

  return { coAttendance, nearby, loading, reload: load }
}
