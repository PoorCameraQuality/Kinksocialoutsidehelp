'use client'

import { useState } from 'react'
import { createAndSendParticipationOffer } from '@/hooks/useApiConventionParticipation'

type Props = {
  conventionKey: string
  sourceType: 'presenter_request' | 'vetting_application' | 'vendor_application'
  sourceId: string
  defaultLetter?: string
  showVendorFields?: boolean
  showStaffFields?: boolean
  onSent: () => void
  onCancel: () => void
}

export function ParticipationOfferComposer({
  conventionKey,
  sourceType,
  sourceId,
  defaultLetter = '',
  showVendorFields = false,
  showStaffFields = false,
  onSent,
  onCancel,
}: Props) {
  const [letterText, setLetterText] = useState(defaultLetter)
  const [accessCode, setAccessCode] = useState('')
  const [boothLabel, setBoothLabel] = useState('')
  const [feeCents, setFeeCents] = useState('')
  const [feeInstructions, setFeeInstructions] = useState('')
  const [expectedHours, setExpectedHours] = useState('')
  const [grantsStaffAccess, setGrantsStaffAccess] = useState(showStaffFields)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function send() {
    if (!letterText.trim()) {
      setErr('Offer letter text is required.')
      return
    }
    setBusy(true)
    setErr(null)
    const feeParsed = feeCents.trim() ? Math.round(parseFloat(feeCents) * 100) : null
    const result = await createAndSendParticipationOffer(conventionKey, {
      sourceType,
      sourceId,
      letterText: letterText.trim(),
      accessCode: accessCode.trim() || null,
      boothLabel: boothLabel.trim() || null,
      feeCents: feeParsed,
      feeInstructions: feeInstructions.trim() || null,
      expectedHours: expectedHours.trim() ? parseFloat(expectedHours) : null,
      grantsStaffAccess,
    })
    setBusy(false)
    if (!result.ok) {
      setErr(result.error ?? 'Send failed')
      return
    }
    onSent()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-dc-border bg-dc-elevated p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-dc-text">Send participation offer</h3>
        <p className="mt-1 text-sm text-dc-muted">
          Compose the offer letter. The applicant must accept before comp codes or booth terms take effect.
        </p>

        <label className="mt-4 block text-xs font-medium text-dc-muted">
          Offer letter
          <textarea
            className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface px-3 py-2 text-sm text-dc-text"
            rows={8}
            value={letterText}
            onChange={(e) => setLetterText(e.target.value)}
            placeholder="Dear {{applicantName}}, we would like to invite you to…"
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-dc-muted">
          Access / comp code (optional)
          <input
            className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface px-3 py-2 text-sm"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
          />
        </label>

        {showVendorFields ?
          <>
            <label className="mt-3 block text-xs font-medium text-dc-muted">
              Booth assignment
              <input
                className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface px-3 py-2 text-sm"
                value={boothLabel}
                onChange={(e) => setBoothLabel(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-dc-muted">
              Fee (USD)
              <input
                type="number"
                min={0}
                step={0.01}
                className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface px-3 py-2 text-sm"
                value={feeCents}
                onChange={(e) => setFeeCents(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-dc-muted">
              Payment instructions
              <textarea
                className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface px-3 py-2 text-sm"
                rows={3}
                value={feeInstructions}
                onChange={(e) => setFeeInstructions(e.target.value)}
                placeholder="Send check to… Payment due by…"
              />
            </label>
          </>
        : null}

        {showStaffFields ?
          <>
            <label className="mt-3 block text-xs font-medium text-dc-muted">
              Expected service hours
              <input
                type="number"
                min={0}
                step={0.5}
                className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface px-3 py-2 text-sm"
                value={expectedHours}
                onChange={(e) => setExpectedHours(e.target.value)}
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-dc-text">
              <input
                type="checkbox"
                checked={grantsStaffAccess}
                onChange={(e) => setGrantsStaffAccess(e.target.checked)}
              />
              Registration includes staff area access
            </label>
          </>
        : null}

        {err ? <p className="mt-3 text-sm text-red-400" role="alert">{err}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text hover:bg-dc-accent-hover disabled:opacity-50"
            onClick={() => void send()}
          >
            {busy ? 'Sending…' : 'Send offer'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-dc-border px-4 py-2 text-sm text-dc-muted"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
