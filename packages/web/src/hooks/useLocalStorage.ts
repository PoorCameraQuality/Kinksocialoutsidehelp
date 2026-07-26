import { useState, useEffect, useCallback } from 'react'

/**
 * Generic localStorage hook with SSR guard.
 * Returns [value, setValue] - value is fallback until hydrated.
 */
export function useLocalStorage<T>(key: string, fallback: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValueState] = useState<T>(fallback)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        setValueState(JSON.parse(raw) as T)
      }
    } catch (e) {
      console.warn(`[useLocalStorage] Failed to load key "${key}":`, e)
    }
  }, [key])

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(key, JSON.stringify(resolved))
          } catch (e) {
            console.warn(`[useLocalStorage] Failed to save key "${key}":`, e)
          }
        }
        return resolved
      })
    },
    [key]
  )

  return [value, setValue]
}
