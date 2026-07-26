import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import {
  acceptParticipationOffer,
  declineParticipationOffer,
  loadMyParticipationOffers,
  type ParticipationOffer,
} from '@/hooks/useApiConventionParticipation'

export default function ConventionMyOffersPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { isAuthenticated, isFallback, status } = useAuth()
  const signedIn = isAuthenticated && !isFallback
  const [offers, setOffers] = useState<ParticipationOffer[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feeAck, setFeeAck] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!signedIn || !slug) return
    void loadMyParticipationOffers(slug).then(setOffers)
  }, [signedIn, slug])

  if (status === 'loading') {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-dc-muted">Checking session…</div>
  }
  if (!signedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link to={buildLoginHref(`/conventions/${slug}/my-offers`)} className="rounded-xl bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text">
          Sign in to view offers
        </Link>
      </div>
    )
  }

  async function accept(offer: ParticipationOffer) {
    if (offer.feeCents != null && offer.feeCents > 0 && !feeAck[offer.id]) {
      setErr('Acknowledge the fee terms before accepting.')
      return
    }
    setBusyId(offer.id)
    setErr(null)
    const result = await acceptParticipationOffer(slug, offer.id)
    setBusyId(null)
    if (!result.ok) {
      setErr(result.error ?? 'Accept failed')
      return
    }
    if (result.registerUrl) {
      window.location.href = result.registerUrl
      return
    }
    setOffers(await loadMyParticipationOffers(slug))
  }

  async function decline(offer: ParticipationOffer) {
    setBusyId(offer.id)
    const result = await declineParticipationOffer(slug, offer.id)
    setBusyId(null)
    if (!result.ok) {
      setErr(result.error ?? 'Decline failed')
      return
    }
    setOffers(await loadMyParticipationOffers(slug))
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link to={`/conventions/${slug}`} className="text-sm text-dc-accent hover:underline">
        ← Back to event
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-dc-text">Your participation offers</h1>
      <p className="mt-2 text-sm text-dc-muted">Review offer letters from organizers and accept or decline.</p>

      {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}

      <ul className="mt-6 space-y-4">
        {offers.length === 0 ?
          <li className="text-sm text-dc-muted">No offers yet.</li>
        : offers.map((o) => (
            <li key={o.id} className="rounded-xl border border-dc-border bg-dc-elevated p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wide text-dc-muted">{o.sourceType.replace(/_/g, ' ')}</span>
                <span className="rounded-full bg-dc-surface-muted px-2 py-0.5 text-[10px] font-medium text-dc-text">{o.status}</span>
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm text-dc-text">{o.letterText ?? o.letterHtml}</div>
              {o.accessCode && o.status === 'sent' ?
                <p className="mt-2 text-sm">
                  <span className="text-dc-muted">Access code: </span>
                  <code className="rounded bg-dc-surface-muted px-1.5 py-0.5 font-mono text-dc-accent">{o.accessCode}</code>
                </p>
              : null}
              {o.boothLabel ?
                <p className="mt-1 text-sm text-dc-muted">Booth: {o.boothLabel}</p>
              : null}
              {o.feeCents != null && o.feeCents > 0 ?
                <p className="mt-1 text-sm text-dc-muted">
                  Fee: ${(o.feeCents / 100).toFixed(2)}
                  {o.feeInstructions ? ` · ${o.feeInstructions}` : ''}
                </p>
              : null}
              {o.expiresAt ?
                <p className="mt-1 text-xs text-dc-muted">Respond by {new Date(o.expiresAt).toLocaleDateString()}</p>
              : null}
              {o.status === 'sent' ?
                <div className="mt-4 flex flex-wrap gap-2">
                  {o.feeCents != null && o.feeCents > 0 ?
                    <label className="flex w-full items-center gap-2 text-xs text-dc-muted">
                      <input
                        type="checkbox"
                        checked={Boolean(feeAck[o.id])}
                        onChange={(e) => setFeeAck((f) => ({ ...f, [o.id]: e.target.checked }))}
                      />
                      I agree to the fee terms described above (payment handled separately by organizers).
                    </label>
                  : null}
                  <button
                    type="button"
                    disabled={busyId === o.id}
                    className="rounded-lg bg-dc-accent px-3 py-1.5 text-xs font-medium text-dc-text disabled:opacity-50"
                    onClick={() => void accept(o)}
                  >
                    Accept offer
                  </button>
                  <button
                    type="button"
                    disabled={busyId === o.id}
                    className="rounded-lg border border-dc-border px-3 py-1.5 text-xs disabled:opacity-50"
                    onClick={() => void decline(o)}
                  >
                    Decline
                  </button>
                </div>
              : null}
            </li>
          ))
        }
      </ul>
    </div>
  )
}
