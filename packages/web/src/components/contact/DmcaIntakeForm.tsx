import { useState, type FormEvent } from 'react'

export default function DmcaIntakeForm({ className = '' }: { className?: string }) {
  const [claimantName, setClaimantName] = useState('')
  const [claimantEmail, setClaimantEmail] = useState('')
  const [workIdentified, setWorkIdentified] = useState('')
  const [infringingUrl, setInfringingUrl] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [perjury, setPerjury] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!goodFaith || !perjury) {
      setFeedback({ tone: 'err', text: 'You must confirm both statements to submit a takedown notice.' })
      return
    }
    setFeedback(null)
    setBusy(true)
    try {
      const r = await fetch('/api/v1/dmca/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimantName: claimantName.trim(),
          claimantEmail: claimantEmail.trim(),
          workIdentified: workIdentified.trim(),
          infringingUrl: infringingUrl.trim(),
        }),
      })
      const data = (await r.json().catch(() => ({}))) as { error?: string; case?: { id: string } }
      if (!r.ok) {
        setFeedback({ tone: 'err', text: typeof data.error === 'string' ? data.error : 'Submission failed.' })
        return
      }
      setFeedback({
        tone: 'ok',
        text: 'Takedown notice received. We will review it and follow up if we need more information.',
      })
      setWorkIdentified('')
      setInfringingUrl('')
      setGoodFaith(false)
      setPerjury(false)
    } catch {
      setFeedback({ tone: 'err', text: 'Network error. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className={`space-y-4 ${className}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dmca-name" className="block text-sm font-medium text-dc-text mb-1">
            Your name
          </label>
          <input
            id="dmca-name"
            required
            value={claimantName}
            onChange={(e) => setClaimantName(e.target.value)}
            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="dmca-email" className="block text-sm font-medium text-dc-text mb-1">
            Contact email
          </label>
          <input
            id="dmca-email"
            type="email"
            required
            value={claimantEmail}
            onChange={(e) => setClaimantEmail(e.target.value)}
            className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label htmlFor="dmca-work" className="block text-sm font-medium text-dc-text mb-1">
          Copyrighted work you believe was infringed
        </label>
        <textarea
          id="dmca-work"
          required
          rows={3}
          value={workIdentified}
          onChange={(e) => setWorkIdentified(e.target.value)}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="dmca-url" className="block text-sm font-medium text-dc-text mb-1">
          URL or location on Kink Social of the allegedly infringing material
        </label>
        <input
          id="dmca-url"
          required
          value={infringingUrl}
          onChange={(e) => setInfringingUrl(e.target.value)}
          className="w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm"
          placeholder="https://…"
        />
      </div>
      <label className="flex gap-2 text-sm text-dc-text-muted">
        <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} className="mt-1" />
        <span>
          I have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or
          the law.
        </span>
      </label>
      <label className="flex gap-2 text-sm text-dc-text-muted">
        <input type="checkbox" checked={perjury} onChange={(e) => setPerjury(e.target.checked)} className="mt-1" />
        <span>
          I declare under penalty of perjury that the information in this notice is accurate and that I am authorized
          to act on behalf of the copyright owner.
        </span>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-5 text-sm font-medium disabled:opacity-60"
      >
        {busy ? 'Submitting…' : 'Submit takedown notice'}
      </button>
      {feedback ?
        <p className={`text-sm ${feedback.tone === 'ok' ? 'text-emerald-300' : 'text-red-300'}`} role="status">
          {feedback.text}
        </p>
      : null}
    </form>
  )
}
