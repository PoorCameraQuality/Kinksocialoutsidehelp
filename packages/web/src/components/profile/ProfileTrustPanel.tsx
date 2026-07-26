import CommunityTrustCard from '@/components/trust/CommunityTrustCard'
import { useApiCommunityTrustByUsername } from '@/hooks/useApiCommunityTrust'

type Props = {
  username: string
  compact?: boolean
}

export default function ProfileTrustPanel({ username, compact = false }: Props) {
  const { status, data } = useApiCommunityTrustByUsername(username, Boolean(username))
  return (
    <CommunityTrustCard
      trust={data}
      loading={status === 'loading'}
      compact={compact}
      showSharedContext
    />
  )
}
