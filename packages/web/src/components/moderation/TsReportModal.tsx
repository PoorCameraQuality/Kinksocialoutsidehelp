import { useEffect, useState } from 'react'
import {
  POLICY_REASONS,
  POLICY_REASON_LABELS,
  POLICY_REASON_VALUES,
  type PolicyReason,
} from '@c2k/shared'
import Dialog from '@/components/ui/Dialog'
import { useSubmitReport } from '@/hooks/useSubmitReport'

export type TsReportTarget = {
  targetType: string
  targetId: string
  label: string
  context?: Record<string, unknown>
}

type Props = {
  open: TsReportTarget | null
  onClose: () => void
  onSubmitted?: () => void
}

export default function TsReportModal({ open, onClose, onSubmitted }: Props) {
  const [policyReason, setPolicyReason] = useState<PolicyReason>(POLICY_REASONS.harassmentThreats)
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const { submit: submitReport, busy, error: submitError, resetError } = useSubmitReport()

  useEffect(() => {
    if (!open) return
    setPolicyReason(POLICY_REASONS.harassmentThreats)
    setBody('')
    setMsg(null)
    resetError()
  }, [open, resetError])

  const noteRequired = policyReason === POLICY_REASONS.other
  const noteMissing = noteRequired && !body.trim()
  const canSubmit = !busy && !noteMissing

  async function handleSubmit() {
    const target = open
    if (!target || !canSubmit) return
    if (noteRequired && !body.trim()) {
      setMsg('Please describe the issue when selecting Other.')
      return
    }
    setMsg(null)
    try {
      await submitReport({
        targetType: target.targetType,
        targetId: target.targetId,
        policyReason,
        body: body.trim() || undefined,
        context: target.context,
      })
      onSubmitted?.()
      onClose()
    } catch {
      /* error surfaced via submitError */
    }
  }

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      title={open ? `Report ${open.label}` : 'Report'}
      description="Choose the policy issue that best matches what you saw. Moderators review every report."
      maxWidthClass="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 px-4 rounded-xl text-sm border border-dc-border text-dc-text-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="min-h-10 px-4 rounded-xl text-sm font-medium bg-dc-accent text-dc-accent-foreground disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Submit report'}
          </button>
        </>
      }
    >
      <label htmlFor="ts-report-policy-reason" className="block text-xs text-dc-muted mb-1">
        Policy reason
      </label>
      <select
        id="ts-report-policy-reason"
        value={policyReason}
        onChange={(e) => setPolicyReason(e.target.value as PolicyReason)}
        className="w-full bg-dc-elevated-solid border border-dc-border rounded-lg px-2 py-2 text-sm text-dc-text mb-3"
      >
        {POLICY_REASON_VALUES.map((reason) => (
          <option key={reason} value={reason}>
            {POLICY_REASON_LABELS[reason]}
          </option>
        ))}
      </select>
      <label htmlFor="ts-report-details" className="block text-xs text-dc-muted mb-1">
        {noteRequired ? 'Details (required)' : 'Additional details (optional)'}
      </label>
      <textarea
        id="ts-report-details"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder={
          noteRequired ?
            'Describe what happened so moderators can review.'
          : 'Quotes, links, or context that helps moderators.'
        }
        className="w-full bg-dc-elevated-solid border border-dc-border rounded-xl p-3 text-sm text-dc-text-muted"
        aria-required={noteRequired}
      />
      {noteMissing ?
        <p className="text-xs text-dc-muted mt-1">A note is required when reporting Other.</p>
      : null}
      {msg ? <p className="text-sm text-dc-danger mt-2">{msg}</p> : null}
      {submitError && !msg ? <p className="text-sm text-dc-danger mt-2">{submitError}</p> : null}
      {!msg && !submitError ?
        <p className="text-xs text-dc-muted mt-3">Thank you. Moderators review every report.</p>
      : null}
    </Dialog>
  )
}
