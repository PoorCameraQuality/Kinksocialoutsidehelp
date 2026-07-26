import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

function resolveTabFromUrl<T extends string>(
  tabParam: string | null,
  tabs: readonly T[],
  defaultTab: T
): T {
  if (!tabParam) return defaultTab
  let decoded = tabParam
  try {
    decoded = decodeURIComponent(tabParam)
  } catch {
    decoded = tabParam
  }
  if (tabs.includes(decoded as T)) return decoded as T
  const lower = decoded.toLowerCase()
  const fuzzy = tabs.find((t) => t.toLowerCase() === lower)
  return (fuzzy as T) ?? defaultTab
}

/**
 * Syncs activeTab with ?tab= search param (URL → state).
 * Multi-word tab labels (e.g. "Events Attended") match when the param matches exactly or case-insensitively.
 */
export function useTabFromUrl<T extends string>(
  tabs: readonly T[],
  defaultTab: T
): [string, (tab: string) => void] {
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<string>(() => resolveTabFromUrl(tabParam, tabs, defaultTab))

  useEffect(() => {
    setActiveTab(resolveTabFromUrl(tabParam, tabs, defaultTab))
  }, [tabParam, tabs, defaultTab])

  return [activeTab, setActiveTab]
}
