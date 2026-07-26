import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminStepUpModal from '@/components/moderation/AdminStepUpModal'
import { StepUpRequiredError, useApiLegalAlpha } from '@/hooks/useApiLegalAlpha'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'

export default function ModerationDmcaPage() {
  const { staff } = useApiPlatformStaff(true)
  const api = useApiLegalAlpha()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [stepUpOpen, setStepUpOpen] = useState(false)

  const canAccess = staff?.siteAdmin || staff?.trustSafetyAdmin

  const { loadDmcaCases } = api
  const reload = useCallback(async () => {
    try {
      await loadDmcaCases()
    } catch (e) {
      if (e instanceof StepUpRequiredError) setStepUpOpen(true)
    }
  }, [loadDmcaCases])

  useEffect(() => {
    if (canAccess) void reload()
  }, [canAccess, reload])

  const selected = api.dmcaCases.find((c) => c.id === selectedId) ?? null

  if (!canAccess) {
    return (
      <p className="text-sm text-dc-muted">
        Trust &amp; Safety or site admin access required.{' '}
        <Link to="/moderation/dashboard" className="text-dc-accent hover:underline">
          Dashboard
        </Link>
      </p>
    )
  }

  async function runAction(action: 'disable' | 'restore') {
    if (!selected || !reason.trim()) {
      setMsg('Reason is required.')
      return
    }
    setMsg(null)
    try {
      await api.dmcaAction(selected.id, action, reason.trim())
      setMsg(action === 'disable' ? 'Content disabled.' : 'Content restored.')
      setReason('')
      await reload()
    } catch (e) {
      if (e instanceof StepUpRequiredError) setStepUpOpen(true)
      else setMsg(e instanceof Error ? e.message : 'Action failed')
    }
  }

  return (
    <div className="space-y-6">
      <AdminStepUpModal
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onSuccess={() => void reload()}
        submitStepUp={api.submitStepUp}
      />
      <div>
        <h2 className="text-lg font-semibold text-dc-text">DMCA cases</h2>
        <p className="text-sm text-dc-muted mt-1">
          Review takedown notices. Disable/restore requires a reason and is audited.
        </p>
      </div>
      {api.error ?
        <p className="text-sm text-red-300">{api.error}</p>
      : null}
      {msg ?
        <p className="text-sm text-dc-text-muted">{msg}</p>
      : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-dc-border overflow-hidden">
          <ul className="divide-y divide-dc-border max-h-[480px] overflow-y-auto">
            {api.dmcaCases.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-dc-elevated-muted ${selectedId === c.id ? 'bg-dc-elevated-muted' : ''}`}
                >
                  <div className="text-sm font-medium text-dc-text">{c.claimantName}</div>
                  <div className="text-xs text-dc-muted">{c.status} · {new Date(c.receivedAt).toLocaleDateString()}</div>
                </button>
              </li>
            ))}
            {api.dmcaCases.length === 0 && !api.loading ?
              <li className="px-4 py-6 text-sm text-dc-muted">No cases yet.</li>
            : null}
          </ul>
        </section>
        {selected ?
          <section className="rounded-2xl border border-dc-border p-4 space-y-3">
            <h3 className="font-semibold text-dc-text">{selected.claimantName}</h3>
            <p className="text-sm text-dc-muted">{selected.claimantEmail}</p>
            <p className="text-sm"><strong>Work:</strong> {selected.workIdentified}</p>
            <p className="text-sm break-all"><strong>URL:</strong> {selected.infringingUrl}</p>
            <p className="text-sm">Status: {selected.status}</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required for actions)"
              className="w-full min-h-20 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runAction('disable')}
                className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm"
              >
                Disable content
              </button>
              <button
                type="button"
                onClick={() => void runAction('restore')}
                className="rounded-xl border border-dc-border px-3 py-2 text-sm"
              >
                Restore content
              </button>
            </div>
          </section>
        : null}
      </div>
    </div>
  )
}
