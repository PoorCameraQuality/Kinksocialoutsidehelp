import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminStepUpModal from '@/components/moderation/AdminStepUpModal'
import { StepUpRequiredError, useApiLegalAlpha } from '@/hooks/useApiLegalAlpha'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'

export default function ModerationLegalPage() {
  const { staff } = useApiPlatformStaff(true)
  const api = useApiLegalAlpha()
  const [requestType, setRequestType] = useState('subpoena')
  const [requesterName, setRequesterName] = useState('')
  const [reason, setReason] = useState('')
  const [holdTargetType, setHoldTargetType] = useState('user')
  const [holdTargetId, setHoldTargetId] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [stepUpOpen, setStepUpOpen] = useState(false)

  const canAccess = staff?.siteAdmin || staff?.legalAdmin

  const { loadLegalRequests } = api
  const reload = useCallback(async () => {
    try {
      await loadLegalRequests()
    } catch (e) {
      if (e instanceof StepUpRequiredError) setStepUpOpen(true)
    }
  }, [loadLegalRequests])

  useEffect(() => {
    if (canAccess) void reload()
  }, [canAccess, reload])

  if (!canAccess) {
    return (
      <p className="text-sm text-dc-muted">
        Legal admin or site admin access required.{' '}
        <Link to="/moderation/dashboard" className="text-dc-accent hover:underline">
          Dashboard
        </Link>
      </p>
    )
  }

  async function createRequest() {
    if (!reason.trim()) {
      setMsg('Reason is required.')
      return
    }
    setMsg(null)
    try {
      const { request } = await api.createLegalRequest({
        requestType,
        requesterName: requesterName.trim() || undefined,
        reason: reason.trim(),
      })
      setSelectedRequestId(request.id)
      setReason('')
      setRequesterName('')
      await reload()
      setMsg('Legal request created.')
    } catch (e) {
      if (e instanceof StepUpRequiredError) setStepUpOpen(true)
      else setMsg(e instanceof Error ? e.message : 'Create failed')
    }
  }

  async function createHold() {
    if (!selectedRequestId || !holdReason.trim() || !holdTargetId.trim()) {
      setMsg('Select a request and provide hold target + reason.')
      return
    }
    setMsg(null)
    try {
      await api.createLegalHold(selectedRequestId, {
        targetType: holdTargetType,
        targetId: holdTargetId.trim(),
        reason: holdReason.trim(),
      })
      setHoldReason('')
      setMsg('Legal hold placed.')
    } catch (e) {
      if (e instanceof StepUpRequiredError) setStepUpOpen(true)
      else setMsg(e instanceof Error ? e.message : 'Hold failed')
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
        <h2 className="text-lg font-semibold text-dc-text">Legal requests</h2>
        <p className="text-sm text-dc-muted mt-1">Inbound legal process, preservation holds, and scoped export placeholders.</p>
      </div>
      {msg ?
        <p className="text-sm text-dc-text-muted">{msg}</p>
      : null}

      <section className="rounded-2xl border border-dc-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-dc-text">Create request</h3>
        <input
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
          placeholder="Request type (e.g. subpoena)"
        />
        <input
          value={requesterName}
          onChange={(e) => setRequesterName(e.target.value)}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
          placeholder="Requester name (optional)"
        />
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full min-h-20 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
          placeholder="Reason (required)"
        />
        <button
          type="button"
          onClick={() => void createRequest()}
          className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground"
        >
          Create legal request
        </button>
      </section>

      <section className="rounded-2xl border border-dc-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-dc-text">Requests</h3>
        <ul className="space-y-2">
          {api.legalRequests.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelectedRequestId(r.id)}
                className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${selectedRequestId === r.id ? 'border-dc-accent bg-dc-accent-muted/20' : 'border-dc-border'}`}
              >
                {r.requestType}: {r.status} ({new Date(r.receivedAt).toLocaleDateString()})
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedRequestId ?
        <section className="rounded-2xl border border-dc-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-dc-text">Place legal hold</h3>
          <input
            value={holdTargetType}
            onChange={(e) => setHoldTargetType(e.target.value)}
            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
            placeholder="Target type (user, media, …)"
          />
          <input
            value={holdTargetId}
            onChange={(e) => setHoldTargetId(e.target.value)}
            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm font-mono"
            placeholder="Target UUID"
          />
          <textarea
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value)}
            className="w-full min-h-16 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
            placeholder="Hold reason (required)"
          />
          <button
            type="button"
            onClick={() => void createHold()}
            className="rounded-xl border border-dc-border px-4 py-2 text-sm"
          >
            Create hold
          </button>
        </section>
      : null}
    </div>
  )
}
