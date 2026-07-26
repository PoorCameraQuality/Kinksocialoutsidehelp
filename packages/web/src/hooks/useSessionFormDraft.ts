import { useCallback, useEffect, useRef } from 'react'

type DraftHookOptions = {
  enabled?: boolean
}

/** Persist form state to sessionStorage; restore once on mount. */
export function useSessionFormDraft<T>(storageKey: string, options?: DraftHookOptions) {
  const enabled = options?.enabled !== false
  const restoredRef = useRef(false)

  const restore = useCallback((): T | null => {
    if (!enabled) return null
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }, [enabled, storageKey])

  const persist = useCallback(
    (value: T) => {
      if (!enabled) return
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(value))
      } catch {
        /* quota or private mode */
      }
    },
    [enabled, storageKey],
  )

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const markRestored = useCallback(() => {
    restoredRef.current = true
  }, [])

  const hasRestored = useCallback(() => restoredRef.current, [])

  return { restore, persist, clear, markRestored, hasRestored }
}

/** Debounced persist helper for draft objects. */
export function usePersistFormDraft<T>(storageKey: string, draft: T, enabled = true, debounceMs = 400) {
  const { persist } = useSessionFormDraft<T>(storageKey, { enabled })

  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(() => persist(draft), debounceMs)
    return () => window.clearTimeout(timer)
  }, [debounceMs, draft, enabled, persist])
}
