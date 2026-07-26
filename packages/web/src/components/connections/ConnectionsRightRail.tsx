import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'
import type { ConnectionRow } from '@/app/connections/connections-types'
import type { SuggestedPerson } from '@/app/connections/connections-types'

type Props = {
  incomingRequests: ConnectionRow[]
  suggested: SuggestedPerson[]
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  respondBusyId: string | null
  onConnectUsername: (username: string) => void
}

function requestContext(c: ConnectionRow): string {
  const other = c.isOutgoing ? c.recipientUsername : c.requesterUsername
  return c.isOutgoing ? 'Outgoing request' : `From @${other ?? 'member'}`
}

export default function ConnectionsRightRail({
  incomingRequests,
  suggested,
  onAccept,
  onDecline,
  respondBusyId,
  onConnectUsername,
}: Props) {
  const preview = incomingRequests.filter((c) => !c.isOutgoing).slice(0, 2)
  const suggestPreview = suggested.slice(0, 3)

  return (
    <aside className={`hidden lg:block ${railAsideClass}`} aria-label="Connections sidebar">
      <RailCard title="Connection requests" footerHref="/connections?tab=requests" footerLabel="View all">
        {preview.length === 0 ?
          <p className="text-xs leading-relaxed text-dc-text-muted">No pending requests right now.</p>
        : <ul className="space-y-3">
            {preview.map((c) => {
              const username = c.requesterUsername ?? c.requesterId
              return (
                <li key={c.id} className="rounded-xl border border-dc-border/80 bg-dc-surface-muted/40 p-3">
                  <p className="text-sm font-medium text-dc-text">{username}</p>
                  <p className="mt-0.5 text-xs text-dc-muted">{requestContext(c)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={respondBusyId !== null}
                      onClick={() => onAccept(c.id)}
                      className="rounded-lg bg-dc-accent px-2.5 py-1 text-xs font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
                    >
                      {respondBusyId === c.id ? '…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      disabled={respondBusyId !== null}
                      onClick={() => onDecline(c.id)}
                      className="rounded-lg border border-dc-border px-2.5 py-1 text-xs text-dc-text-muted hover:text-dc-text disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        }
      </RailCard>

      <RailCard title="People you may know" footerHref="/people" footerLabel="View all">
        {suggestPreview.length === 0 ?
          <p className="text-xs leading-relaxed text-dc-text-muted">
            RSVP to events to see people you may have met.
          </p>
        : <ul className="space-y-3">
            {suggestPreview.map((p) => (
              <li key={p.userId}>
                <div className="flex items-center gap-2">
                  <Link to={`/profile/${encodeURIComponent(p.username)}`} className="shrink-0">
                    {p.avatarUrl ?
                      <img src={p.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    : <PlaceholderAvatar size="sm" className="!rounded-full" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/profile/${encodeURIComponent(p.username)}`}
                      className="block truncate text-sm font-medium text-dc-text hover:text-dc-accent"
                    >
                      {p.displayName ?? p.username}
                    </Link>
                    {p.sharedCount != null && p.sharedCount > 0 ?
                      <p className="text-xs text-dc-muted">
                        {p.sharedCount} mutual event{p.sharedCount === 1 ? '' : 's'}
                      </p>
                    : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onConnectUsername(p.username)}
                    className="shrink-0 rounded-lg border border-dc-accent-border/60 px-2 py-1 text-[11px] font-semibold text-dc-accent hover:bg-dc-accent-muted"
                  >
                    Connect
                  </button>
                </div>
              </li>
            ))}
          </ul>
        }
      </RailCard>

      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
        <div className="flex gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dc-accent-muted text-dc-accent"
            aria-hidden
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </span>
          <p className="text-xs leading-relaxed text-dc-text-muted">
            Only connect with people you trust. You can disconnect, ignore, or report someone anytime.
          </p>
        </div>
        <Link to="/support" className="mt-3 inline-block text-xs font-medium text-dc-accent hover:underline">
          Safety tips &amp; support
        </Link>
      </div>
    </aside>
  )
}
