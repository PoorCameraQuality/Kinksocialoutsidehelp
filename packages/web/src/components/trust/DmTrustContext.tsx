import SharedTrustContext from './SharedTrustContext'
import { useApiCommunityTrustByUsername } from '@/hooks/useApiCommunityTrust'

type Props = {
  partnerUsername: string | null | undefined
}

/** Shared positive context in DM header - recipient never sees restriction labels. */
export default function DmTrustContext({ partnerUsername }: Props) {
  const { status, data } = useApiCommunityTrustByUsername(partnerUsername, Boolean(partnerUsername?.trim()))

  if (!partnerUsername?.trim() || status !== 'ok' || !data?.sharedContext) return null

  const { sharedOrganizations, sharedGroups, sharedEvents } = data.sharedContext
  if (sharedOrganizations + sharedGroups + sharedEvents === 0) return null

  return (
    <div className="px-4 py-2 border-b border-dc-border bg-dc-elevated/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted mb-1">Shared context</p>
      <SharedTrustContext
        sharedOrganizations={sharedOrganizations}
        sharedGroups={sharedGroups}
        sharedEvents={sharedEvents}
        compact
      />
    </div>
  )
}
