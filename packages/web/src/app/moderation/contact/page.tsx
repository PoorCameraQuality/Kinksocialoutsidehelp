import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminStepUpModal from '@/components/moderation/AdminStepUpModal'
import { StepUpRequiredError, useApiLegalAlpha, type ContactInquiryRow } from '@/hooks/useApiLegalAlpha'
import { useApiPlatformStaff } from '@/hooks/useApiPlatformStaff'
import { contactTopicLabel } from '@/lib/contact-topics'

export default function ModerationContactPage() {
  const { staff } = useApiPlatformStaff(true)
  const api = useApiLegalAlpha()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState('RECEIVED')
  const [notesPrivate, setNotesPrivate] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [stepUpOpen, setStepUpOpen] = useState(false)

  const canAccess = staff?.siteAdmin || staff?.trustSafetyAdmin || staff?.legalAdmin

  const selected = api.contactInquiries.find((i) => i.id === selectedId) ?? null

  const { loadContactInquiries } = api
  const reload = useCallback(async () => {
    try {
      await loadContactInquiries()
    } catch (e) {
      if (e instanceof StepUpRequiredError) setStepUpOpen(true)
    }
  }, [loadContactInquiries])

  useEffect(() => {
    if (canAccess) void reload()
  }, [canAccess, reload])

  useEffect(() => {
    if (selected) {
      setStatus(selected.status)
      setNotesPrivate(selected.notesPrivate ?? '')
    }
  }, [selected])

  if (!canAccess) {
    return (
      <p className="text-sm text-dc-muted">
        Trust &amp; safety or legal admin access required.{' '}
        <Link to="/moderation/dashboard" className="text-dc-accent hover:underline">
          Dashboard
        </Link>
      </p>
    )
  }

  async function saveInquiry() {
    if (!selectedId || !reason.trim()) {
      setMsg('Select an inquiry and provide an audit reason.')
      return
    }
    setMsg(null)
    try {
      await api.patchContactInquiry(selectedId, {
        status,
        notesPrivate: notesPrivate.trim() || undefined,
        reason: reason.trim(),
      })
      setReason('')
      await reload()
      setMsg('Inquiry updated.')
    } catch (e) {
      if (e instanceof StepUpRequiredError) setStepUpOpen(true)
      else setMsg(e instanceof Error ? e.message : 'Update failed')
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
        <h2 className="text-lg font-semibold text-dc-text">Contact inbox</h2>
        <p className="text-sm text-dc-muted mt-1">
          Public submissions from the Contact page. Safety reports live in moderation cases, not here.
        </p>
      </div>
      {msg ?
        <p className="text-sm text-dc-text-muted">{msg}</p>
      : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-dc-border p-4 space-y-2">
          <h3 className="text-sm font-semibold text-dc-text">Inquiries ({api.contactInquiries.length})</h3>
          <ul className="space-y-2 max-h-[28rem] overflow-y-auto">
            {api.contactInquiries.map((row: ContactInquiryRow) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${selectedId === row.id ? 'border-dc-accent bg-dc-accent-muted/20' : 'border-dc-border'}`}
                >
                  <span className="font-medium text-dc-text">{row.subject}</span>
                  <span className="block text-xs text-dc-muted mt-0.5">
                    {contactTopicLabel(row.category)} · {row.status} · {new Date(row.receivedAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
            {api.contactInquiries.length === 0 ?
              <li className="text-sm text-dc-muted">No contact submissions yet.</li>
            : null}
          </ul>
        </section>

        {selected ?
          <section className="rounded-2xl border border-dc-border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-dc-text">Detail</h3>
            <dl className="text-sm space-y-2 text-dc-text-muted">
              <div>
                <dt className="text-xs uppercase text-dc-muted">From</dt>
                <dd className="text-dc-text">
                  {selected.senderName} &lt;{selected.senderEmail}&gt;
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-dc-muted">Topic</dt>
                <dd>{contactTopicLabel(selected.category)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-dc-muted">Received</dt>
                <dd>{new Date(selected.receivedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-dc-muted">Message</dt>
                <dd className="whitespace-pre-wrap text-dc-text">{selected.message}</dd>
              </div>
            </dl>

            <label className="block text-sm font-medium text-dc-text">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
              >
                <option value="RECEIVED">Received</option>
                <option value="IN_REVIEW">In review</option>
                <option value="REPLIED">Replied</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-dc-text">
              Private notes
              <textarea
                value={notesPrivate}
                onChange={(e) => setNotesPrivate(e.target.value)}
                className="mt-1 w-full min-h-20 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-dc-text">
              Audit reason (required)
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
                placeholder="Why you changed status or notes"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveInquiry()}
              className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-accent-foreground"
            >
              Save changes
            </button>
          </section>
        : null}
      </div>
    </div>
  )
}
