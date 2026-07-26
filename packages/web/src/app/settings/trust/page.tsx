import { useCallback, useEffect, useState } from 'react'
import CommunityTrustCard from '@/components/trust/CommunityTrustCard'
import { useApiCommunityTrustByUsername } from '@/hooks/useApiCommunityTrust'
import { useAuth } from '@/contexts/AuthContext'

type RestrictionRow = {
  id?: string
  scopeType?: string | null
  scopeId?: string | null
  type?: string
  reasonCategory: string
  expiresAt: string | null
  userNotice?: string
  appealPath?: string
}

type AppealRow = {
  id: string
  scopeType: string
  scopeId: string
  status: string
  filedAt: string
}

type RestrictionsPayload = {
  scopeBans: RestrictionRow[]
  messagingRestrictions: RestrictionRow[]
  scopedStandings?: RestrictionRow[]
  openAppeals?: AppealRow[]
}

export default function SettingsTrustPage() {
  const { viewerUsername } = useAuth()
  const { status: trustStatus, data: trustData } = useApiCommunityTrustByUsername(viewerUsername, Boolean(viewerUsername))
  const [restrictions, setRestrictions] = useState<RestrictionsPayload | null>(null)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [appealDraft, setAppealDraft] = useState('')
  const [appealTarget, setAppealTarget] = useState<RestrictionRow | null>(null)
  const [appealStatus, setAppealStatus] = useState<string | null>(null)

  const loadRestrictions = useCallback(async () => {
    setLoadState('loading')
    try {
      const r = await fetch('/api/v1/me/trust/restrictions', { credentials: 'include' })
      if (!r.ok) throw new Error(String(r.status))
      setRestrictions((await r.json()) as RestrictionsPayload)
      setLoadState('ok')
    } catch {
      setRestrictions(null)
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void loadRestrictions()
  }, [loadRestrictions])

  async function submitAppeal() {
    if (!appealTarget?.id || !appealTarget.scopeType || !appealTarget.scopeId || appealDraft.trim().length < 10) return
    setAppealStatus('submitting')
    try {
      const r = await fetch('/api/v1/me/trust/appeals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeType: appealTarget.scopeType,
          scopeId: appealTarget.scopeId,
          sourceType: 'scope_ban',
          sourceId: appealTarget.id,
          reason: appealDraft.trim(),
        }),
      })
      if (!r.ok) throw new Error('Failed')
      setAppealStatus('submitted')
      setAppealDraft('')
      setAppealTarget(null)
      await loadRestrictions()
    } catch {
      setAppealStatus('error')
    }
  }

  const activeRestrictions = [
    ...(restrictions?.scopeBans ?? []),
    ...(restrictions?.scopedStandings ?? []),
    ...(restrictions?.messagingRestrictions ?? []),
  ]

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-dc-text">Community Trust &amp; standing</h2>
        <p className="mt-1 text-sm text-dc-muted">
          Community Trust is based on participation, references, and verified community activity. Reports and private
          safety reviews are not shown publicly.
        </p>
      </div>

      <CommunityTrustCard
        trust={trustData}
        loading={trustStatus === 'loading'}
        showSharedContext={false}
      />

      <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-dc-text">Active restrictions</h3>
        {loadState === 'loading' ?
          <p className="text-xs text-dc-muted">Loading…</p>
        : loadState === 'error' ?
          <p className="text-xs text-dc-muted">Restrictions unavailable · API or database may be offline.</p>
        : activeRestrictions.length === 0 ?
          <p className="text-xs text-dc-muted">No active scoped or messaging restrictions on your account.</p>
        : (
          <ul className="space-y-3">
            {activeRestrictions.map((row, i) => (
              <li key={`${row.reasonCategory}-${i}`} className="rounded-xl border border-dc-border p-3 text-sm">
                <p className="font-medium text-dc-text capitalize">{row.reasonCategory.replace(/_/g, ' ')}</p>
                {row.userNotice ?
                  <p className="mt-1 text-xs text-dc-muted">{row.userNotice}</p>
                : null}
                {row.expiresAt ?
                  <p className="mt-1 text-xs text-dc-muted">Expires {new Date(row.expiresAt).toLocaleString()}</p>
                : (
                  <p className="mt-1 text-xs text-dc-muted">No automatic expiry. Appeal if you believe this is mistaken.</p>
                )}
                {row.scopeType && row.scopeId && !row.type ?
                  <button
                    type="button"
                    onClick={() => {
                      setAppealTarget(row)
                      setAppealStatus(null)
                    }}
                    className="mt-2 text-xs font-medium text-dc-accent hover:underline"
                  >
                    Appeal this restriction
                  </button>
                : row.type ?
                  <p className="mt-2 text-xs text-dc-muted">
                    Messaging restriction appeals are reviewed by platform staff through the moderation appeals process.
                  </p>
                : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {restrictions?.openAppeals && restrictions.openAppeals.length > 0 ?
        <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-dc-text">Appeal status</h3>
          <ul className="space-y-2 text-sm">
            {restrictions.openAppeals.map((a) => (
              <li key={a.id} className="text-dc-muted">
                {a.scopeType} appeal · <span className="capitalize">{a.status.replace(/_/g, ' ').toLowerCase()}</span>{' '}
                (filed {new Date(a.filedAt).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </section>
      : null}

      {appealTarget ?
        <section className="rounded-2xl border border-dc-border bg-dc-elevated/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-dc-text">File appeal</h3>
          <textarea
            value={appealDraft}
            onChange={(e) => setAppealDraft(e.target.value)}
            rows={4}
            placeholder="Explain why this restriction should be reviewed (min 10 characters)…"
            className="w-full rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 py-2 text-sm text-dc-text"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submitAppeal()}
              disabled={appealDraft.trim().length < 10 || appealStatus === 'submitting'}
              className="rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground disabled:opacity-50"
            >
              Submit appeal
            </button>
            <button
              type="button"
              onClick={() => {
                setAppealTarget(null)
                setAppealDraft('')
              }}
              className="rounded-lg border border-dc-border px-4 py-2 text-sm text-dc-text"
            >
              Cancel
            </button>
          </div>
          {appealStatus === 'submitted' ?
            <p className="text-xs text-emerald-300">Appeal submitted. A scoped moderator or platform staff will review.</p>
          : null}
          {appealStatus === 'error' ?
            <p className="text-xs text-red-300">Could not submit appeal. Try again later.</p>
          : null}
        </section>
      : null}
    </div>
  )
}
