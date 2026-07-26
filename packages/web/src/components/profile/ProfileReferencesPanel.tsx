import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'

const REFERENCE_DISCLAIMER =
  'References are public endorsements of community presence. The person you reference must accept before it appears. Accepted references are visible on the profile; only established references count toward Community Trust level.'

export type ReferenceItem = {
  id: string
  referrerUsername: string
  category: string
  note: string | null
  createdAt: string
  referrerTrustScore: number
  referrerTrustAtAccept?: number | null
}

export type IncomingRef = {
  id: string
  referrerUsername: string
  category: string
  note: string | null
  createdAt: string
}

type Props = {
  username: string
  viewerUsername: string | null
  isAuthenticated: boolean
  references: ReferenceItem[]
  incoming: IncomingRef[]
  loading: boolean
  viewerHasPendingOrAccepted: boolean
  refCategory: 'character' | 'play' | 'community' | 'technique' | 'general'
  refNote: string
  refNoteId: string
  onRefCategoryChange: (v: Props['refCategory']) => void
  onRefNoteChange: (v: string) => void
  onOfferReference: () => void
  onRespondIncoming: (id: string, action: 'accept' | 'decline') => void
}

export default function ProfileReferencesPanel({
  username,
  viewerUsername,
  isAuthenticated,
  references,
  incoming,
  loading,
  viewerHasPendingOrAccepted,
  refCategory,
  refNote,
  refNoteId,
  onRefCategoryChange,
  onRefNoteChange,
  onOfferReference,
  onRespondIncoming,
}: Props) {
  const isSelf = username === viewerUsername

  return (
    <Card padding="lg">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-dc-text">References</h2>
          <p className="text-sm text-dc-muted mt-1 max-w-prose">{REFERENCE_DISCLAIMER}</p>
        </div>
        {!isSelf && isAuthenticated ?
          <button
            type="button"
            onClick={onOfferReference}
            disabled={viewerHasPendingOrAccepted}
            className="shrink-0 px-4 py-2 min-h-11 bg-dc-accent hover:bg-dc-accent-hover disabled:opacity-50 text-dc-accent-foreground text-sm font-medium rounded-xl"
          >
            {viewerHasPendingOrAccepted ? 'Reference sent' : 'Offer reference'}
          </button>
        : isSelf ?
          <p className="text-xs text-dc-muted max-w-xs">Others offer references from your public profile; you accept or decline below.</p>
        : null}
      </div>

      {isSelf && incoming.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-sm font-medium text-dc-text">Incoming</h3>
          {incoming.map((inc) => (
            <div
              key={inc.id}
              className="flex flex-wrap items-center gap-2 justify-between rounded-xl border border-dc-border bg-dc-elevated-solid p-3"
            >
              <div>
                <span className="text-dc-text font-medium">{inc.referrerUsername}</span>
                <span className="text-xs text-dc-muted ml-2">{inc.category}</span>
                {inc.note ? <p className="text-sm text-dc-text-muted mt-1 italic">&ldquo;{inc.note}&rdquo;</p> : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRespondIncoming(inc.id, 'accept')}
                  className="px-3 py-1.5 text-sm rounded-lg bg-dc-accent text-dc-accent-foreground"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => onRespondIncoming(inc.id, 'decline')}
                  className="px-3 py-1.5 text-sm rounded-lg border border-dc-border text-dc-text-muted"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isSelf && isAuthenticated && !viewerHasPendingOrAccepted && (
        <div className="mb-6 space-y-3 rounded-xl border border-dc-border bg-dc-surface-muted/50 p-4">
          <label className="text-sm font-medium text-dc-text" htmlFor="ref-cat">
            Category
          </label>
          <select
            id="ref-cat"
            value={refCategory}
            onChange={(e) => onRefCategoryChange(e.target.value as Props['refCategory'])}
            className="w-full max-w-md px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-sm text-dc-text"
          >
            <option value="general">General</option>
            <option value="character">Character</option>
            <option value="play">Play</option>
            <option value="community">Community</option>
            <option value="technique">Technique</option>
          </select>
          <label htmlFor={refNoteId} className="text-sm font-medium text-dc-text">
            Optional note
          </label>
          <textarea
            id={refNoteId}
            value={refNote}
            onChange={(e) => onRefNoteChange(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Why you're glad to vouch for this person…"
            className="w-full px-3 py-2 rounded-xl bg-dc-surface-muted border border-dc-border text-sm text-dc-text placeholder-dc-muted resize-none"
          />
        </div>
      )}

      {loading ?
        <div className="space-y-3 py-4" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-dc-elevated-muted" />
          ))}
        </div>
      : references.length === 0 ?
        <EmptyState
          title="No references yet"
          message="When community members vouch for someone, their references show up here."
          inline
        />
      : <div className="space-y-3">
          {references.map((end) => (
            <Link
              key={end.id}
              to={`/profile/${end.referrerUsername}`}
              className="block rounded-xl p-4 border border-dc-border bg-dc-elevated-solid hover:border-dc-accent-border/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <PlaceholderAvatar size="sm" className="!rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-dc-text">{end.referrerUsername}</span>
                    <span className="text-xs uppercase text-dc-muted">{end.category}</span>
                  </div>
                  {end.note ?
                    <p className="mt-2 text-sm text-dc-text-muted italic">&ldquo;{end.note}&rdquo;</p>
                  : <p className="mt-2 text-sm text-dc-muted">Vouched without a note.</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      }
    </Card>
  )
}
