import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ConventionDancecardCompareGrid from '@/components/conventions/ConventionDancecardCompareGrid'
import {
  buildMutualFreeMillis,
  convBoundsFromShared,
  viewerExpandedBusy,
  type CalItem,
  type FreeGap,
} from '@/components/conventions/convention-dancecard-compare-utils'

type SharedPayload = {
  conventionName: string
  timezone: string
  conventionStartsAt?: string
  conventionEndsAt?: string
  freeGaps: FreeGap[]
  sharer?: { username: string; displayName: string | null; avatarUrl: string | null }
}

function extractShareToken(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const fromPath = trimmed.match(/\/dancecard\/s\/([a-f0-9]{16,64})/i)
  if (fromPath?.[1]) return fromPath[1]
  if (/^[a-f0-9]{32,64}$/i.test(trimmed)) return trimmed
  return null
}

function formatRange(isoStart: string, isoEnd: string, tz: string): string {
  const fmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const endFmt = new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  return `${fmt.format(new Date(isoStart))} – ${endFmt.format(new Date(isoEnd))}`
}

export default function ConventionAttendeeComparePanel({ conventionKey }: { conventionKey: string }) {
  const key = encodeURIComponent(conventionKey)
  const [linkInput, setLinkInput] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [shared, setShared] = useState<SharedPayload | null>(null)
  const [viewerCal, setViewerCal] = useState<{ items: CalItem[]; bufferMinutes: number } | null>(null)
  const [viewerCalStatus, setViewerCalStatus] = useState<'idle' | 'loading' | 'ready' | 'signed_out' | 'blocked'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadCompare = useCallback(
    async (shareToken: string) => {
      setLoading(true)
      setErr(null)
      setShared(null)
      setViewerCal(null)
      setViewerCalStatus('loading')
      try {
        const [sr, cr] = await Promise.all([
          fetch(`/api/v1/conventions/${key}/dancecard/shared/${encodeURIComponent(shareToken)}`, {
            credentials: 'include',
          }),
          fetch(`/api/v1/conventions/${key}/dancecard/calendar`, { credentials: 'include' }),
        ])
        if (!sr.ok) {
          setErr('Invalid or revoked share link.')
          setViewerCalStatus('idle')
          return
        }
        const sd = (await sr.json()) as SharedPayload
        setShared(sd)
        if (cr.status === 401) {
          setViewerCal(null)
          setViewerCalStatus('signed_out')
          return
        }
        if (!cr.ok) {
          setViewerCal(null)
          setViewerCalStatus('blocked')
          return
        }
        const cj = (await cr.json()) as { items?: CalItem[]; bufferMinutes?: number }
        setViewerCal({ items: cj.items ?? [], bufferMinutes: cj.bufferMinutes ?? 0 })
        setViewerCalStatus('ready')
      } catch {
        setErr('Network error loading compare data.')
        setViewerCalStatus('idle')
      } finally {
        setLoading(false)
      }
    },
    [key],
  )

  useEffect(() => {
    if (!token) return
    void loadCompare(token)
  }, [token, loadCompare])

  const tz = shared?.timezone ?? 'UTC'

  const mutualList = useMemo(() => {
    if (!shared || viewerCalStatus !== 'ready' || !viewerCal) return []
    const bounds = convBoundsFromShared(shared)
    if (!bounds) return []
    const busy = viewerExpandedBusy(
      viewerCal.items,
      viewerCal.bufferMinutes,
      bounds.start.getTime(),
      bounds.end.getTime(),
    )
    const mutual = buildMutualFreeMillis(shared.freeGaps, busy)
    return mutual.map((m) => ({
      startsAt: new Date(m.s).toISOString(),
      endsAt: new Date(m.e).toISOString(),
    }))
  }, [shared, viewerCal, viewerCalStatus])

  return (
    <div className="space-y-4">
      <p className="text-sm text-dc-text-muted">
        Paste a partner&apos;s share link to see mutual free time. Use the day grid below or open the full compare page
        to request a scene.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="min-w-0 flex-1 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
          placeholder="Share link or token"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
        />
        <button
          type="button"
          className="shrink-0 rounded-xl bg-amber-600/90 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-500 disabled:opacity-50"
          disabled={!linkInput.trim()}
          onClick={() => {
            const t = extractShareToken(linkInput)
            if (!t) {
              setErr('Paste a full share URL or the token from the end of the link.')
              setToken(null)
              return
            }
            setErr(null)
            setToken(t)
          }}
        >
          Compare
        </button>
      </div>
      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      {loading ?
        <p className="text-sm text-dc-muted">Loading…</p>
      : null}
      {shared ?
        <div className="space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/95/50 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Partner</p>
            <p className="text-lg font-semibold text-dc-text">
              {shared.sharer?.displayName?.trim() || shared.sharer?.username || 'Shared dancecard'}
            </p>
            {shared.sharer?.username ?
              <p className="text-xs text-dc-muted">@{shared.sharer.username}</p>
            : null}
          </div>

          {viewerCalStatus === 'signed_out' ?
            <p className="text-xs text-amber-200">Sign in to overlay your calendar and see mutual free time in the grid.</p>
          : null}

          <ConventionDancecardCompareGrid
            hostFreeGaps={shared.freeGaps}
            conventionStartsAt={shared.conventionStartsAt}
            conventionEndsAt={shared.conventionEndsAt}
            timezone={tz}
            viewerCal={viewerCal}
            viewerCalStatus={viewerCalStatus}
            compact
          />

          <div>
            <p className="text-sm font-semibold text-dc-text">Mutual free windows</p>
            {viewerCalStatus !== 'ready' ?
              <p className="mt-1 text-xs text-amber-200">Sign in to list mutual windows with your buffer applied.</p>
            : mutualList.length === 0 ?
              <p className="mt-1 text-sm text-dc-muted">No mutual free time in the convention window.</p>
            : <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-sm text-dc-text-muted">
                {mutualList.slice(0, 12).map((g) => (
                  <li key={`${g.startsAt}-${g.endsAt}`}>{formatRange(g.startsAt, g.endsAt, tz)}</li>
                ))}
                {mutualList.length > 12 ?
                  <li className="text-xs text-dc-muted">+{mutualList.length - 12} more in the grid above</li>
                : null}
              </ul>
            }
          </div>

          {token ?
            <Link
              to={`/conventions/${encodeURIComponent(conventionKey)}/dancecard/s/${encodeURIComponent(token)}`}
              className="inline-flex min-h-10 items-center rounded-xl bg-dc-accent/18 px-4 text-sm font-medium text-dc-accent hover:bg-dc-accent/26"
            >
              Open full compare &amp; request scene →
            </Link>
          : null}
        </div>
      : null}
    </div>
  )
}
