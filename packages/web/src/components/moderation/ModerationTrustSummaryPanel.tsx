import { Link } from 'react-router-dom'
import ReputationIntegritySignalsPanel from '@/components/moderation/ReputationIntegritySignalsPanel'
import { useApiModerationTrustSummary } from '@/hooks/useApiModerationTrustSummary'

type Props = {
  userId: string | null | undefined
  enabled?: boolean
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-dc-muted">{label}</span>
      <span className="text-dc-text font-medium tabular-nums">{value}</span>
    </div>
  )
}

export default function ModerationTrustSummaryPanel({ userId, enabled = true }: Props) {
  const { status, data, error, reload } = useApiModerationTrustSummary(userId, enabled && Boolean(userId))

  if (!userId) {
    return (
      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4">
        <h3 className="text-sm font-semibold text-dc-text">Trust summary</h3>
        <p className="mt-2 text-xs text-dc-muted">No subject user linked to this case.</p>
      </section>
    )
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4">
        <h3 className="text-sm font-semibold text-dc-text">Trust summary</h3>
        <p className="mt-2 text-xs text-dc-muted">Loading moderator context…</p>
      </section>
    )
  }

  if (status === 'forbidden' || status === 'error' || !data) {
    return (
      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4">
        <h3 className="text-sm font-semibold text-dc-text">Trust summary</h3>
        <p className="mt-2 text-xs text-red-300" role="alert">
          {error ?? 'Could not load trust summary.'}
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-dc-text">Trust summary (moderator only)</h3>
        <Link
          to={`/profile/${encodeURIComponent(data.username)}`}
          className="text-xs text-dc-accent hover:underline"
        >
          @{data.username}
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Account basics</p>
        <Stat label="Account age (days)" value={data.account.accountAgeDays} />
        <Stat label="Age affirmed" value={data.account.ageAffirmed ? 'Yes' : 'No'} />
        <Stat
          label="Profile complete"
          value={
            data.account.profileComplete === null ? 'Unknown' : data.account.profileComplete ? 'Yes' : 'No'
          }
        />
        <Stat label="Has profile photo" value={data.account.hasProfilePhoto ? 'Yes' : 'No'} />
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Positive participation</p>
        <Stat label="Accepted references (visible)" value={data.positiveSignals.acceptedReferences} />
        <Stat label="References counted for level" value={data.positiveSignals.countedReferencesForLevel} />
        <Stat label="Convention registrations" value={data.positiveSignals.conventionRegistrations} />
        <Stat label="Staff-confirmed check-ins" value={data.positiveSignals.staffConfirmedCheckIns} />
        <Stat label="Verified presenter credits" value={data.positiveSignals.verifiedPresenterCredits} />
        <Stat label="Verified vendor credits" value={data.positiveSignals.verifiedVendorCredits} />
        <Stat label="Organizer roles (owner/admin)" value={data.positiveSignals.organizerRoles} />
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Moderation context</p>
        <Stat label="Open cases" value={data.moderationContext.openCases} />
        <Stat label="Closed (no violation)" value={data.moderationContext.closedNoViolationCases} />
        <Stat label="Actioned cases" value={data.moderationContext.actionedCases} />
        <Stat label="Open profile review flags" value={data.moderationContext.profileReviewFlags} />
        <Stat label="Scope bans (total)" value={data.moderationContext.scopeBansTotal} />
        <Stat label="Active scope bans" value={data.moderationContext.activeScopeBans} />
        <Stat label="Blocked by users (aggregate)" value={data.moderationContext.blockedByUsersCount} />
        <Stat label="Muted by users (aggregate)" value={data.moderationContext.mutedByUsersCount} />
        {data.moderationContext.restrictedQueueCases !== null ?
          <Stat label="Restricted-queue cases" value={data.moderationContext.restrictedQueueCases} />
        : null}
        {data.restrictions.identityBanActive !== null ?
          <Stat
            label="Identity ban active"
            value={data.restrictions.identityBanActive ? 'Yes' : 'No'}
          />
        : null}
      </div>

      {data.communityTrust ?
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Public community trust</p>
          <Stat label="Level" value={data.communityTrust.level} />
          <p className="text-xs text-dc-muted">{data.communityTrust.headline}</p>
          <Stat label="Public badges" value={data.communityTrust.badgeCount} />
        </div>
      : null}

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Messaging health</p>
        {'status' in data.messagingHealth && data.messagingHealth.status === 'available' ?
          <>
            <Stat label="State" value={data.messagingHealth.state} />
            <Stat label="Outbound (window)" value={data.messagingHealth.outboundMessageCount} />
            <Stat label="Unique recipients" value={data.messagingHealth.uniqueRecipientCount} />
            <Stat label="New conversations" value={data.messagingHealth.newConversationCount} />
            <Stat label="Active restriction" value={data.messagingHealth.activeRestriction ? 'Yes' : 'No'} />
          </>
        : <p className="text-xs text-dc-muted">Unavailable ({(data.messagingHealth as { reason?: string }).reason})</p>}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Incident clustering</p>
        {'status' in data.incidentClustering && data.incidentClustering.status === 'available' ?
          <>
            <Stat label="Open incidents" value={data.incidentClustering.openIncidents} />
            <Stat label="Linked reports" value={data.incidentClustering.totalLinkedReports} />
          </>
        : <p className="text-xs text-dc-muted">Unavailable ({(data.incidentClustering as { reason?: string }).reason})</p>}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Appeals</p>
        {'status' in data.appeals && data.appeals.status === 'available' ?
          <>
            <Stat label="Open scoped appeals" value={data.appeals.openScopedAppeals} />
            <Stat label="Open platform appeals" value={data.appeals.openPlatformAppeals} />
          </>
        : <p className="text-xs text-dc-muted">Unavailable ({(data.appeals as { reason?: string }).reason})</p>}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">
          Reputation integrity signals
        </p>
        {'status' in data.reputationIntegritySignals &&
        data.reputationIntegritySignals.status === 'available' ?
          <ReputationIntegritySignalsPanel
            signals={data.reputationIntegritySignals.items}
            onUpdated={() => void reload()}
          />
        : <p className="text-xs text-dc-muted">
            Unavailable ({(data.reputationIntegritySignals as { reason?: string }).reason})
          </p>}
      </div>

      {data.warnings.length ?
        <ul className="text-[11px] text-amber-200/90 list-disc pl-4 space-y-1">
          {data.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      : null}
    </section>
  )
}
