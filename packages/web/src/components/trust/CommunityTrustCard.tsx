import { COMMUNITY_TRUST_LEVELS } from '@c2k/shared'
import Card from '@/components/ui/Card'
import type { CommunityTrustData } from '@/hooks/useApiCommunityTrust'
import TrustBadge from './TrustBadge'
import SharedTrustContext from './SharedTrustContext'

const LEVEL_LABELS: Record<string, string> = {
  [COMMUNITY_TRUST_LEVELS.newMember]: 'New Member',
  [COMMUNITY_TRUST_LEVELS.buildingTrust]: 'Building Trust',
  [COMMUNITY_TRUST_LEVELS.establishedMember]: 'Established Member',
  [COMMUNITY_TRUST_LEVELS.communityKnown]: 'Community Known',
  [COMMUNITY_TRUST_LEVELS.verifiedContributor]: 'Verified Contributor',
}

type Props = {
  trust: CommunityTrustData | null
  loading?: boolean
  compact?: boolean
  showSharedContext?: boolean
}

export default function CommunityTrustCard({
  trust,
  loading,
  compact,
  showSharedContext = true,
}: Props) {
  if (loading) {
    return (
      <Card padding={compact ? 'md' : 'lg'}>
        <p className="text-sm text-dc-muted">Loading community trust…</p>
      </Card>
    )
  }
  if (!trust) {
    return (
      <Card padding={compact ? 'md' : 'lg'}>
        <p className="text-sm text-dc-muted">Community trust unavailable.</p>
      </Card>
    )
  }

  const levelLabel = LEVEL_LABELS[trust.level] ?? 'Member'

  return (
    <Card padding={compact ? 'md' : 'lg'} className={compact ? '' : 'sticky top-24'}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dc-muted mb-1">Community Trust</h2>
      <p className="text-base font-semibold text-dc-text">{levelLabel}</p>
      <p className="mt-1 text-xs text-dc-text-muted leading-relaxed">{trust.headline}</p>
      {trust.badges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {trust.badges.map((b) => (
            <TrustBadge key={b.key} label={b.label} description={b.description} compact={compact} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-dc-muted">Limited public history. Participation badges appear as you engage.</p>
      )}
      {showSharedContext && trust.sharedContext ? (
        <div className="mt-3 border-t border-dc-border pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted mb-1">Shared context</p>
          <SharedTrustContext
            sharedOrganizations={trust.sharedContext.sharedOrganizations}
            sharedGroups={trust.sharedContext.sharedGroups}
            sharedEvents={trust.sharedContext.sharedEvents}
            compact={compact}
          />
        </div>
      ) : null}
      {trust.references && trust.references.visible > trust.references.countedForLevel ?
        <p className="mt-2 text-[10px] text-dc-muted leading-snug">
          {trust.references.visible} reference{trust.references.visible === 1 ? '' : 's'} accepted publicly.{' '}
          {trust.references.countedForLevel} count toward Community Trust level.
        </p>
      : null}
      <p className="mt-3 text-[10px] text-dc-muted leading-snug">
        Based on participation, references, and verified activity. Not reports or private safety reviews.
      </p>
    </Card>
  )
}
