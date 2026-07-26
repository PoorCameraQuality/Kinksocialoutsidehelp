import SettingsPaymentHistorySections from '@/components/settings/SettingsPaymentHistorySections'
import SettingsPaymentHistorySidebar from '@/components/settings/SettingsPaymentHistorySidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useApiTicketHistory } from '@/hooks/useApiTicketHistory'

export default function SettingsPaymentHistoryPage() {
  const { status: authStatus, isAuthenticated, isFallback } = useAuth()
  const enabled = authStatus === 'ready' && isAuthenticated && !isFallback
  const hook = useApiTicketHistory(enabled)

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8 lg:items-start">
      <SettingsPaymentHistorySections hook={hook} />
      <aside className="mt-8 lg:mt-0">
        <SettingsPaymentHistorySidebar />
      </aside>
    </div>
  )
}
