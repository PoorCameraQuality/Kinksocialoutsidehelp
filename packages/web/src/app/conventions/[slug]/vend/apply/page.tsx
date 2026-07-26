import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { submitVendorApplication } from '@/hooks/useApiConventionParticipation'

export default function ConventionVendApplyPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { isAuthenticated, isFallback, status } = useAuth()
  const signedIn = isAuthenticated && !isFallback
  const [productSummary, setProductSummary] = useState('')
  const [boothPreferences, setBoothPreferences] = useState('')
  const [powerNeeds, setPowerNeeds] = useState('')
  const [hours, setHours] = useState('')
  const [url, setUrl] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (status === 'loading') {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-dc-muted">Checking session…</div>
  }
  if (!signedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-dc-text">Sign in to apply</h1>
        <Link to={buildLoginHref(`/conventions/${slug}/vend/apply`)} className="mt-4 inline-flex rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text">
          Sign in
        </Link>
      </div>
    )
  }
  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-dc-text">Application submitted</h1>
        <p className="mt-2 text-sm text-dc-muted">
          If approved, you will receive an offer letter with booth assignment and fee terms to accept.
        </p>
        <Link to={`/conventions/${slug}`} className="mt-6 inline-flex rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text">
          Back to event
        </Link>
      </div>
    )
  }

  async function submit() {
    if (!productSummary.trim()) {
      setErr('Describe what you plan to sell.')
      return
    }
    setBusy(true)
    setErr(null)
    const result = await submitVendorApplication(slug, {
      productSummary: productSummary.trim(),
      boothPreferences: boothPreferences.trim() || undefined,
      powerNeeds: powerNeeds.trim() || undefined,
      hours: hours.trim() || undefined,
      url: url.trim() || undefined,
    })
    setBusy(false)
    if (!result.ok) {
      setErr(result.error ?? 'Submit failed')
      return
    }
    setDone(true)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link to={`/conventions/${slug}`} className="text-sm text-dc-accent hover:underline">
        ← Back to event
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-dc-text">Apply to vend</h1>
      <p className="mt-2 text-sm text-dc-muted">
        Requires a vendor shop profile.{' '}
        <Link to="/vendors/onboarding" className="text-dc-accent underline">
          Complete vendor onboarding
        </Link>{' '}
        first if needed.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block text-sm text-dc-muted">
          What will you sell?
          <textarea
            className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-sm text-dc-text"
            rows={4}
            value={productSummary}
            onChange={(e) => setProductSummary(e.target.value)}
          />
        </label>
        <label className="block text-sm text-dc-muted">
          Booth preferences (optional)
          <textarea className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-sm" rows={2} value={boothPreferences} onChange={(e) => setBoothPreferences(e.target.value)} />
        </label>
        <label className="block text-sm text-dc-muted">
          Power / space needs (optional)
          <input className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-sm" value={powerNeeds} onChange={(e) => setPowerNeeds(e.target.value)} />
        </label>
        <label className="block text-sm text-dc-muted">
          Hours at booth (optional)
          <input className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-sm" value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="block text-sm text-dc-muted">
          Shop URL (optional)
          <input className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 py-2 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
      </div>

      {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}
      <button
        type="button"
        disabled={busy}
        className="mt-6 rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
        onClick={() => void submit()}
      >
        {busy ? 'Submitting…' : 'Submit vendor application'}
      </button>
    </div>
  )
}
