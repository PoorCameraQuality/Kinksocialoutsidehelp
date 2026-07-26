import { useAuth } from '@/contexts/AuthContext'
import SettingsBlockedSections from '@/components/settings/SettingsBlockedSections'
import { useApiBlockedMembers } from '@/hooks/useApiBlockedMembers'

/** Embedded blocked list (legacy privacy composite). Prefer `/settings/blocked`. */
export default function BlockedMembersPanel() {
  const { status: authStatus, isAuthenticated, isFallback } = useAuth()
  const enabled = authStatus === 'ready' && isAuthenticated && !isFallback
  const hook = useApiBlockedMembers(enabled)

  if (!enabled) return null

  return <SettingsBlockedSections hook={hook} embed />
}
