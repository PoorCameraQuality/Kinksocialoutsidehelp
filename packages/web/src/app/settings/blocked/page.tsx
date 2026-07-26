import SettingsBlockedSections from '@/components/settings/SettingsBlockedSections'
import SettingsBlockedSidebar from '@/components/settings/SettingsBlockedSidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useApiBlockedMembers } from '@/hooks/useApiBlockedMembers'

export default function SettingsBlockedPage() {
  const { status: authStatus, isAuthenticated, isFallback } = useAuth()
  const enabled = authStatus === 'ready' && isAuthenticated && !isFallback
  const hook = useApiBlockedMembers(enabled)

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8 lg:items-start">
      <SettingsBlockedSections hook={hook} />
      <aside className="mt-8 lg:mt-0">
        <SettingsBlockedSidebar />
      </aside>
    </div>
  )
}
