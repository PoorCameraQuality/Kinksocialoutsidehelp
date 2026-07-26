import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettingsBundle } from '@/hooks/useSettingsBundle'
import { useApiMutedTags } from '@/hooks/useApiMutedTags'

type SettingsContextValue = ReturnType<typeof useSettingsBundle> & {
  settingsEnabled: boolean
  viewerUsername: string | null
  viewerEmail: string | null
  mutedTagsStatus: ReturnType<typeof useApiMutedTags>['status']
  mutedTags: ReturnType<typeof useApiMutedTags>['items']
  mutedTagsError: ReturnType<typeof useApiMutedTags>['error']
  muteTag: ReturnType<typeof useApiMutedTags>['mute']
  muteTagBusy: ReturnType<typeof useApiMutedTags>['muteBusy']
  unmuteTag: ReturnType<typeof useApiMutedTags>['unmute']
  unmuteTagBusy: ReturnType<typeof useApiMutedTags>['unmuteBusy']
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, isAuthenticated, isFallback, viewerUsername, viewerEmail } = useAuth()
  const settingsEnabled = authStatus === 'ready' && isAuthenticated && !isFallback

  const bundle = useSettingsBundle({
    enabled: settingsEnabled,
    viewerUsername,
  })

  const muted = useApiMutedTags(settingsEnabled)

  const value: SettingsContextValue = {
    ...bundle,
    settingsEnabled,
    viewerUsername,
    viewerEmail,
    mutedTagsStatus: muted.status,
    mutedTags: muted.items,
    mutedTagsError: muted.error,
    muteTag: muted.mute,
    muteTagBusy: muted.muteBusy,
    unmuteTag: muted.unmute,
    unmuteTagBusy: muted.unmuteBusy,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettingsContext() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettingsContext must be used within SettingsProvider')
  return ctx
}
