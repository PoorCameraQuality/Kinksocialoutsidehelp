import { useCallback, useEffect, useState } from 'react'

const DISMISSED_KEY = 'c2k-home-trust-rail-dismissed'

function storageKey(username: string | null): string {
  return username ? `${DISMISSED_KEY}:${username}` : DISMISSED_KEY
}

function readDismissed(username: string | null): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(storageKey(username)) === '1'
}

export function useHomeTrustRailPrefs(viewerUsername: string | null) {
  const [visible, setVisible] = useState(() => !readDismissed(viewerUsername))

  useEffect(() => {
    setVisible(!readDismissed(viewerUsername))
  }, [viewerUsername])

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey(viewerUsername), '1')
    }
    setVisible(false)
  }, [viewerUsername])

  return { visible, dismiss }
}
