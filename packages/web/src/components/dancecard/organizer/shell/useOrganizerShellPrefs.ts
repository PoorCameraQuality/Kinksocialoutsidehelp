'use client'

import { useCallback, useEffect, useState } from 'react'

const WIDE_KEY = 'dc-organizer-wide-canvas'

export function useOrganizerShellPrefs(eventSlug: string) {
  const storageKey = `${WIDE_KEY}-${eventSlug}`
  const [wideCanvas, setWideCanvas] = useState(false)

  useEffect(() => {
    try {
      setWideCanvas(window.localStorage.getItem(storageKey) === '1')
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const toggleWideCanvas = useCallback(() => {
    setWideCanvas((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [storageKey])

  return { wideCanvas, toggleWideCanvas }
}
