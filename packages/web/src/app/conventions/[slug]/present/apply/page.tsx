import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import { submitPresenterApplications } from '@/hooks/useApiConventionParticipation'

type Offering = {
  id: string
  title: string
  tease: string | null
  isPublic: boolean
}

export default function ConventionPresentApplyPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { isAuthenticated, isFallback, status } = useAuth()
  const signedIn = isAuthenticated && !isFallback
  const [offerings, setOfferings] = useState<Offering[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, { room?: string; materials?: string }>>({})
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [orgOwned, setOrgOwned] = useState<boolean | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/v1/conventions/${encodeURIComponent(slug)}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          setOrgOwned(false)
          return
        }
        const j = (await r.json()) as { convention?: { organizationId?: string | null } }
        setOrgOwned(Boolean(j.convention?.organizationId))
      })
      .catch(() => setOrgOwned(false))
  }, [slug])

  useEffect(() => {
    if (!signedIn) return
    fetch('/api/v1/presenters/me/offerings', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load catalog')
        const j = (await r.json()) as { items?: Offering[] }
        setOfferings((j.items ?? []).filter((o) => o.isPublic))
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : 'Failed to load'))
  }, [signedIn])

  if (status === 'loading' || orgOwned === null) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-dc-muted">Loading…</div>
  }
  if (!signedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-dc-text">Sign in to apply</h1>
        <Link
          to={buildLoginHref(`/conventions/${slug}/present/apply`)}
          className="mt-4 inline-flex rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text"
        >
          Sign in
        </Link>
      </div>
    )
  }
  if (!orgOwned) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link to={`/conventions/${slug}`} className="text-sm text-dc-accent hover:underline">
          ← Back to event
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-dc-text">Presenter applications unavailable</h1>
        <p className="mt-2 text-sm text-dc-muted">
          Presenter applications are only available for conventions linked to an organization. This event is not
          org-owned, so the program team cannot review applications here.
        </p>
      </div>
    )
  }
  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-dc-text">Application submitted</h1>
        <p className="mt-2 text-sm text-dc-muted">
          The program team will review your classes. If accepted, you will receive an offer letter with comp terms.
        </p>
        <Link to={`/conventions/${slug}`} className="mt-6 inline-flex rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text">
          Back to event
        </Link>
      </div>
    )
  }

  async function submit() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([id]) => id)
    if (ids.length === 0) {
      setSubmitErr('Select at least one class from your catalog.')
      return
    }
    setBusy(true)
    setSubmitErr(null)
    const result = await submitPresenterApplications(
      slug,
      ids.map((id) => ({
        presenterOfferingId: id,
        roomNeeds: notes[id]?.room,
        materialNeeds: notes[id]?.materials,
      })),
    )
    setBusy(false)
    if (!result.ok) {
      setSubmitErr(result.error ?? 'Submit failed')
      return
    }
    setDone(true)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link to={`/conventions/${slug}`} className="text-sm text-dc-accent hover:underline">
        ← Back to event
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-dc-text">Apply to present</h1>
      <p className="mt-2 text-sm text-dc-muted">
        Choose public classes from your presenter catalog. Organizers review and send offer letters. Not guaranteed until you accept.
      </p>

      {loadErr ? <p className="mt-4 text-sm text-red-400">{loadErr}</p> : null}
      {offerings.length === 0 && !loadErr ?
        <p className="mt-6 text-sm text-dc-muted">
          Add public offerings in{' '}
          <Link to="/settings/ecosystem#presenter-catalog" className="text-dc-accent underline">
            Settings → Presenter catalog
          </Link>{' '}
          before applying.
        </p>
      : null}

      <ul className="mt-6 space-y-4">
        {offerings.map((o) => (
          <li key={o.id} className="rounded-xl border border-dc-border bg-dc-elevated p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(selected[o.id])}
                onChange={(e) => setSelected((s) => ({ ...s, [o.id]: e.target.checked }))}
              />
              <span>
                <span className="font-medium text-dc-text">{o.title}</span>
                {o.tease ? <span className="mt-1 block text-xs text-dc-muted">{o.tease}</span> : null}
              </span>
            </label>
            {selected[o.id] ?
              <div className="mt-3 ml-7 space-y-2">
                <textarea
                  placeholder="Room needs (optional)"
                  className="w-full rounded-lg border border-dc-border bg-dc-surface px-2 py-1.5 text-xs"
                  rows={2}
                  value={notes[o.id]?.room ?? ''}
                  onChange={(e) =>
                    setNotes((n) => ({ ...n, [o.id]: { ...n[o.id], room: e.target.value } }))
                  }
                />
                <textarea
                  placeholder="Material needs (optional)"
                  className="w-full rounded-lg border border-dc-border bg-dc-surface px-2 py-1.5 text-xs"
                  rows={2}
                  value={notes[o.id]?.materials ?? ''}
                  onChange={(e) =>
                    setNotes((n) => ({ ...n, [o.id]: { ...n[o.id], materials: e.target.value } }))
                  }
                />
              </div>
            : null}
          </li>
        ))}
      </ul>

      {submitErr ? <p className="mt-4 text-sm text-red-400">{submitErr}</p> : null}
      {offerings.length > 0 ?
        <button
          type="button"
          disabled={busy}
          className="mt-6 rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text disabled:opacity-50"
          onClick={() => void submit()}
        >
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      : null}
    </div>
  )
}
