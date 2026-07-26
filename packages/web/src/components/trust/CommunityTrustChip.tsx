import { COMMUNITY_TRUST_LEVELS } from '@c2k/shared'
import { useApiCommunityTrustByUsername } from '@/hooks/useApiCommunityTrust'

const LEVEL_LABELS: Record<string, string> = {
  [COMMUNITY_TRUST_LEVELS.newMember]: 'New Member',
  [COMMUNITY_TRUST_LEVELS.buildingTrust]: 'Building Trust',
  [COMMUNITY_TRUST_LEVELS.establishedMember]: 'Established Member',
  [COMMUNITY_TRUST_LEVELS.communityKnown]: 'Community Known',
  [COMMUNITY_TRUST_LEVELS.verifiedContributor]: 'Verified Contributor',
}

type Props = {
  username: string | null | undefined
  enabled?: boolean
}

/** Compact positive trust label for cards and headers - never shows negative signals. */
export default function CommunityTrustChip({ username, enabled = true }: Props) {
  const { status, data } = useApiCommunityTrustByUsername(username, enabled && Boolean(username?.trim()))

  if (!username?.trim() || status === 'idle' || status === 'error') return null
  if (status === 'loading') {
    return (
      <span className="inline-flex w-fit items-center rounded-md border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-[10px] text-dc-muted">
        …
      </span>
    )
  }
  if (!data) return null

  const label = LEVEL_LABELS[data.level] ?? 'Member'

  return (
    <span
      className="inline-flex w-fit items-center rounded-md border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-[10px] font-medium text-dc-muted"
      title={data.headline}
    >
      {label}
    </span>
  )
}
