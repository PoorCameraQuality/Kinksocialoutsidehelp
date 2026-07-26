import { useCallback, useEffect, useState } from 'react'
import {
  ADULT_CONTENT_PREFERENCES,
  type AdultContentPreference,
} from '@c2k/shared'

export type UseAdultContentPreferenceResult = {
  preference: AdultContentPreference
  setPreference: (next: AdultContentPreference) => void
  loaded: boolean
  saving: boolean
  error: string | null
}

export const ADULT_CONTENT_PREFERENCE_OPTIONS: {
  value: AdultContentPreference
  label: string
}[] = [
  { value: ADULT_CONTENT_PREFERENCES.show, label: 'Show adult content' },
  { value: ADULT_CONTENT_PREFERENCES.blur, label: 'Blur adult content (default)' },
  { value: ADULT_CONTENT_PREFERENCES.hide, label: 'Hide adult content' },
]

export function useAdultContentPreference(enabled: boolean): UseAdultContentPreferenceResult {
  const [preference, setPreferenceState] = useState<AdultContentPreference>(ADULT_CONTENT_PREFERENCES.blur)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoaded(true)
      return
    }
    let cancelled = false
    void (async () => {
      setError(null)
      try {
        const r = await fetch('/api/v1/me/adult-content-preference', { credentials: 'include' })
        const data = (await r.json()) as { adultContentPreference?: AdultContentPreference; error?: string }
        if (r.status === 401) {
          if (!cancelled) {
            setError('Sign in to manage adult content preferences.')
            setLoaded(true)
          }
          return
        }
        if (!r.ok) {
          if (!cancelled) {
            setError(typeof data.error === 'string' ? data.error : 'Failed to load preference')
            setLoaded(true)
          }
          return
        }
        if (data.adultContentPreference && !cancelled) {
          setPreferenceState(data.adultContentPreference)
        }
      } catch {
        if (!cancelled) setError('Network error')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  const setPreference = useCallback((next: AdultContentPreference) => {
    setPreferenceState(next)
    setSaving(true)
    setError(null)
    void (async () => {
      try {
        const r = await fetch('/api/v1/me/adult-content-preference', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adultContentPreference: next }),
        })
        const data = (await r.json()) as { adultContentPreference?: AdultContentPreference; error?: string }
        if (!r.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Save failed')
          return
        }
        if (data.adultContentPreference) {
          setPreferenceState(data.adultContentPreference)
        }
      } catch {
        setError('Network error')
      } finally {
        setSaving(false)
      }
    })()
  }, [])

  return { preference, setPreference, loaded, saving, error }
}
