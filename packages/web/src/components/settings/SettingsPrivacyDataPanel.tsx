import { useEffect, useState } from 'react'
import { useApiLegalAlpha } from '@/hooks/useApiLegalAlpha'
import AccountDeleteButton from '@/components/settings/AccountDeleteButton'
const DELETION_DISCLAIMER =
  'Deleting something removes it from ordinary use and starts the deletion or anonymization process. Some data may be retained temporarily for safety, abuse prevention, backups, legal compliance, or active reports. Legal holds pause deletion where required.'

export default function SettingsPrivacyDataPanel() {
  const api = useApiLegalAlpha()
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reviewNote, setReviewNote] = useState('')

  useEffect(() => {
    void api.loadPrivacyRequests()
  }, [api])

  async function requestExport() {
    setBusy(true)
    setMsg(null)
    try {
      const result = await api.createPrivacyRequest('EXPORT_JSON')
      if (result.blocked) {
        setMsg('Request blocked.')
        return
      }
      const dl = await api.downloadExport(result.request.id)
      const blob = new Blob([JSON.stringify(dl.export, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `c2k-export-${result.request.id.slice(0, 8)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsg('Export downloaded.')
      await api.loadPrivacyRequests()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  async function requestManualReview() {    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/v1/me/privacy/manual-review', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: reviewNote.trim() || undefined }),
      })
      if (!r.ok) throw new Error(await r.text())
      setMsg('Manual privacy review request submitted.')
      setReviewNote('')
      await api.loadPrivacyRequests()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-dc-border p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-dc-text">Privacy &amp; data controls</h2>
        <p className="text-sm text-dc-muted mt-1">{DELETION_DISCLAIMER}</p>
        <p className="text-xs text-dc-muted mt-2">
          We do not keep private data forever by default. Configure DM retention in the Data retention section above.
          Delete individual conversations from your inbox using the conversation menu.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void requestExport()}
          className="rounded-xl border border-dc-border px-4 py-2 text-sm hover:bg-dc-elevated-muted disabled:opacity-60"
        >
          Download my data
        </button>
        <AccountDeleteButton disabled={busy} onResult={setMsg} />      </div>
      <div className="space-y-2">
        <label className="block text-sm text-dc-text" htmlFor="privacy-review-note">
          Request manual privacy review
        </label>
        <textarea
          id="privacy-review-note"
          rows={2}
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          className="w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-sm"
          placeholder="Optional note for our privacy team"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void requestManualReview()}
          className="rounded-xl border border-dc-border px-4 py-2 text-sm hover:bg-dc-elevated-muted disabled:opacity-60"
        >
          Submit review request
        </button>
      </div>
      {msg ?
        <p className="text-sm text-dc-text-muted" role="status">
          {msg}
        </p>
      : null}
      {api.privacyRequests.length > 0 ?
        <ul className="text-xs text-dc-muted space-y-1">
          {api.privacyRequests.slice(0, 5).map((r) => (
            <li key={r.id}>
              {r.requestType}: {r.status} ({new Date(r.requestedAt).toLocaleString()})
            </li>
          ))}
        </ul>
      : null}
    </section>
  )
}
