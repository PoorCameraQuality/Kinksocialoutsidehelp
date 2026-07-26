import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'

type AttendeeRow = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

const WINDOW = 6
const ROTATE_MS = 4500

export default function OrgAnchorAttendeesCard({
  anchorEventId,
  compact = true,
}: {
  anchorEventId: string | null
  /** Tighter typography for org overview sidebar */
  compact?: boolean
}) {
  const [items, setItems] = useState<AttendeeRow[]>([])
  const [goingCount, setGoingCount] = useState(0)
  const [loadErr, setLoadErr] = useState(false)
  const [offset, setOffset] = useState(0)

  const load = useCallback(async () => {
    if (!anchorEventId) {
      setItems([])
      setGoingCount(0)
      return
    }
    setLoadErr(false)
    try {
      const r = await fetch(`/api/v1/events/${encodeURIComponent(anchorEventId)}/attendees`, {
        credentials: 'include',
      })
      if (!r.ok) {
        setLoadErr(true)
        setItems([])
        setGoingCount(0)
        return
      }
      const d = (await r.json()) as { items?: AttendeeRow[]; goingCount?: number }
      setItems(d.items ?? [])
      setGoingCount(typeof d.goingCount === 'number' ? d.goingCount : (d.items ?? []).length)
    } catch {
      setLoadErr(true)
      setItems([])
      setGoingCount(0)
    }
  }, [anchorEventId])

  useEffect(() => {
    void load()
  }, [load])

  const maxOffset = useMemo(() => {
    if (items.length <= WINDOW) return 0
    return Math.max(0, items.length - WINDOW)
  }, [items.length])

  useEffect(() => {
    if (maxOffset <= 0) return
    const t = window.setInterval(() => {
      setOffset((o) => (o >= maxOffset ? 0 : o + 1))
    }, ROTATE_MS)
    return () => window.clearInterval(t)
  }, [maxOffset])

  const windowItems = useMemo(() => {
    if (items.length <= WINDOW) return items
    return items.slice(offset, offset + WINDOW)
  }, [items, offset])

  if (!anchorEventId) {
    return (
      <div className="bg-dc-elevated/95 rounded-xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
        <h2
          className={
            compact ?
              'text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-2'
            : 'text-sm font-semibold text-dc-muted uppercase mb-3'
          }
        >
          Attending
        </h2>
        <p className="text-xs text-dc-muted">Link a calendar event with RSVPs to show attendees here.</p>
      </div>
    )
  }

  return (
    <div className="bg-dc-elevated/95 rounded-xl border border-dc-border p-4 shadow-[var(--dc-shadow-soft)]">
      <h2
        className={
          compact ?
            'text-[11px] font-semibold text-dc-muted uppercase tracking-wide mb-2'
          : 'text-sm font-semibold text-dc-muted uppercase mb-3'
        }
      >
        Attending
      </h2>
      {loadErr ?
        <p className="text-xs text-dc-muted">Could not load RSVPs.</p>
      : windowItems.length === 0 && goingCount === 0 ?
        <p className="text-xs text-dc-muted">No RSVPs yet.</p>
      : <>
          <ul className="flex flex-wrap gap-2 justify-center sm:justify-start mb-3" aria-label="Attendee preview">
            {windowItems.map((p) => (
              <li key={p.userId}>
                <Link
                  to={`/profile/${encodeURIComponent(p.username)}`}
                  className="block rounded-full ring-2 ring-white/10 hover:ring-dc-accent/50 transition-shadow"
                  title={p.displayName?.trim() || p.username}
                >
                  {p.avatarUrl ?
                    <img
                      src={p.avatarUrl}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                      loading="lazy"
                    />
                  : <PlaceholderAvatar size="md" className="!w-11 !h-11" />}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-dc-border pt-3 flex flex-col gap-2">
            <p className="text-center sm:text-left">
              <span className="text-lg font-semibold text-dc-text tabular-nums">{goingCount}</span>{' '}
              <span className="text-xs font-medium text-dc-text-muted lowercase">going</span>
            </p>
            <Link
              to={`/events/${encodeURIComponent(anchorEventId)}?tab=${encodeURIComponent('Attendees')}`}
              className="text-xs text-dc-accent hover:underline font-medium"
            >
              See all attendees
            </Link>
          </div>
        </>
      }
    </div>
  )
}
