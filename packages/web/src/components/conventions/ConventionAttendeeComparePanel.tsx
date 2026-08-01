import { useCallback, useEffect, useMemo, useState } from 'react'
import ConventionDancecardCompareGrid from '@/components/conventions/ConventionDancecardCompareGrid'
import PlaySpaceCompareBoard from '@/components/conventions/compare/PlaySpaceCompareBoard'
import type { CompareProfile } from '@/components/conventions/compare/CompareProfileCard'
import { fetchKsCompareProfile } from '@/components/conventions/compare/ksCompareProfile'
import {
  buildMutualFreeMillis,
  convBoundsFromShared,
  viewerExpandedBusy,
  type CalItem,
  type FreeGap,
} from '@/components/conventions/convention-dancecard-compare-utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  dancecardApiBase,
  makeDancecardApiScope,
  parseDancecardCompareInput,
  type DancecardApiKind,
} from '@/lib/dancecard/dancecardApiScope'

type SharedPayload = {
  conventionName?: string
  playSpaceName?: string
  timezone: string
  conventionStartsAt?: string
  conventionEndsAt?: string
  playSpaceStartsAt?: string
  playSpaceEndsAt?: string
  freeGaps: FreeGap[]
  sharer?: {
    username: string
    displayName: string | null
    avatarUrl: string | null
    bio?: string | null
  }
  shareToken?: string | null
}

export default function ConventionAttendeeComparePanel({
  conventionKey,
  apiKind = 'convention',
}: {
  conventionKey: string
  apiKind?: DancecardApiKind
}) {
  const isPlay = apiKind === 'play-space'
  const scope = useMemo(() => makeDancecardApiScope(apiKind, conventionKey), [apiKind, conventionKey])
  const apiBase = dancecardApiBase(scope)
  const { viewerUsername, viewerDisplayName, isAuthenticated, isFallback } = useAuth()

  const [usernameInput, setUsernameInput] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [shared, setShared] = useState<SharedPayload | null>(null)
  const [viewerCal, setViewerCal] = useState<{ items: CalItem[]; bufferMinutes: number } | null>(null)
  const [viewerCalStatus, setViewerCalStatus] = useState<'idle' | 'loading' | 'ready' | 'signed_out' | 'blocked'>(
    'idle',
  )
  const [viewerProfile, setViewerProfile] = useState<CompareProfile | null>(null)
  const [hostProfile, setHostProfile] = useState<CompareProfile | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const applyShared = useCallback((sd: SharedPayload) => {
    setShared({
      ...sd,
      conventionStartsAt: sd.conventionStartsAt ?? sd.playSpaceStartsAt,
      conventionEndsAt: sd.conventionEndsAt ?? sd.playSpaceEndsAt,
      conventionName: sd.conventionName ?? sd.playSpaceName,
    })
    if (sd.shareToken) setActiveToken(sd.shareToken)
  }, [])

  const loadViewerSide = useCallback(async () => {
    const cr = await fetch(`${apiBase}/dancecard/calendar`, { credentials: 'include' })
    if (cr.status === 401) {
      setViewerCal(null)
      setViewerCalStatus('signed_out')
    } else if (!cr.ok) {
      setViewerCal(null)
      setViewerCalStatus('blocked')
    } else {
      const cj = (await cr.json()) as { items?: CalItem[]; bufferMinutes?: number }
      setViewerCal({ items: cj.items ?? [], bufferMinutes: cj.bufferMinutes ?? 0 })
      setViewerCalStatus('ready')
    }

    if (viewerUsername && isAuthenticated && !isFallback) {
      const ks = await fetchKsCompareProfile(viewerUsername)
      setViewerProfile(
        ks ?? {
          displayName: viewerDisplayName || viewerUsername,
          username: viewerUsername,
        },
      )
    } else {
      setViewerProfile(null)
    }
  }, [apiBase, isAuthenticated, isFallback, viewerDisplayName, viewerUsername])

  useEffect(() => {
    const username = shared?.sharer?.username?.trim()
    if (!username) {
      setHostProfile(null)
      return
    }
    let cancelled = false
    void (async () => {
      const ks = await fetchKsCompareProfile(username)
      if (cancelled) return
      if (ks) {
        setHostProfile({
          ...ks,
          // Play-space prefs may override scene name / card bio for this gathering.
          displayName: shared?.sharer?.displayName?.trim() || ks.displayName,
          bio: shared?.sharer?.bio?.trim() || ks.bio,
          avatarUrl: ks.avatarUrl || shared?.sharer?.avatarUrl || null,
        })
        return
      }
      setHostProfile({
        displayName: shared?.sharer?.displayName?.trim() || username,
        username,
        avatarUrl: shared?.sharer?.avatarUrl ?? null,
        bio: shared?.sharer?.bio ?? null,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [shared?.sharer?.username, shared?.sharer?.displayName, shared?.sharer?.bio, shared?.sharer?.avatarUrl])

  const loadByToken = useCallback(
    async (shareToken: string) => {
      setLoading(true)
      setErr(null)
      setShared(null)
      setViewerCal(null)
      setViewerCalStatus('loading')
      setActiveToken(shareToken)
      try {
        const sr = await fetch(`${apiBase}/dancecard/shared/${encodeURIComponent(shareToken)}`, {
          credentials: 'include',
        })
        if (!sr.ok) {
          setErr('Invalid or revoked share link.')
          setActiveToken(null)
          setViewerCalStatus('idle')
          return
        }
        applyShared((await sr.json()) as SharedPayload)
        await loadViewerSide()
      } catch {
        setErr('Network error loading compare data.')
        setViewerCalStatus('idle')
      } finally {
        setLoading(false)
      }
    },
    [apiBase, applyShared, loadViewerSide],
  )

  const loadByUsername = useCallback(
    async (username: string) => {
      setLoading(true)
      setErr(null)
      setShared(null)
      setViewerCal(null)
      setViewerCalStatus('loading')
      setActiveToken(null)
      try {
        const sr = await fetch(`${apiBase}/dancecard/compare/by-username`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        })
        const body = (await sr.json().catch(() => ({}))) as SharedPayload & { error?: string }
        if (!sr.ok) {
          setErr(body.error ?? 'Compare not available for that username.')
          setViewerCalStatus('idle')
          return
        }
        applyShared(body)
        if (body.shareToken) setActiveToken(body.shareToken)
        await loadViewerSide()
      } catch {
        setErr('Network error loading compare data.')
        setViewerCalStatus('idle')
      } finally {
        setLoading(false)
      }
    },
    [apiBase, applyShared, loadViewerSide],
  )

  const mutualGaps: FreeGap[] = useMemo(() => {
    if (!shared || viewerCalStatus !== 'ready' || !viewerCal) return []
    const bounds = convBoundsFromShared({
      conventionStartsAt: shared.conventionStartsAt,
      conventionEndsAt: shared.conventionEndsAt,
      freeGaps: shared.freeGaps,
    })
    if (!bounds) return []
    const busy = viewerExpandedBusy(
      viewerCal.items,
      viewerCal.bufferMinutes,
      bounds.start.getTime(),
      bounds.end.getTime(),
    )
    return buildMutualFreeMillis(shared.freeGaps, busy).map((m) => ({
      startsAt: new Date(m.s).toISOString(),
      endsAt: new Date(m.e).toISOString(),
    }))
  }, [shared, viewerCal, viewerCalStatus])

  function onCompareUsername() {
    const parsed = parseDancecardCompareInput(usernameInput)
    if (!parsed) {
      setErr('Enter a login name (e.g. sandboxfriend) or paste a share URL.')
      return
    }
    setErr(null)
    if (parsed.kind === 'token') {
      void loadByToken(parsed.token)
      return
    }
    if (!isPlay) {
      setErr('Username compare is available on Play Spaces. Paste their full share URL instead.')
      return
    }
    void loadByUsername(parsed.username)
  }

  function onCompareAdvanced() {
    const parsed = parseDancecardCompareInput(tokenInput)
    if (!parsed || parsed.kind !== 'token') {
      setErr('Paste a full share URL or the token from the end of the link.')
      return
    }
    setErr(null)
    void loadByToken(parsed.token)
  }

  return (
    <div className="space-y-4">
      {isPlay ?
        <div className="rounded-2xl border border-dc-accent/25 bg-dc-accent/10 px-3 py-2.5 md:py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-dc-accent">Compare schedules</p>
          <p className="mt-1 hidden text-sm text-dc-text-muted md:block">
            If someone shared a login name or link, open it here. Their <span className="text-dc-text">login name</span>{' '}
            loads when you tap <span className="text-dc-text">Compare</span>. Green / blue on the strips. Only a token?{' '}
            <span className="text-dc-text">Advanced</span>.
          </p>
          <p className="mt-1 text-sm text-dc-text-muted md:hidden">Enter their login name, then Compare.</p>
        </div>
      : <p className="text-sm text-dc-text-muted">
          Paste a partner&apos;s share link to see mutual free time.
        </p>
      }

      <div className="space-y-2 rounded-2xl border border-dc-border bg-dc-elevated/40 p-3">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-dc-muted">
          {isPlay ? 'Host login name' : 'Share link or token'}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
            placeholder={isPlay ? 'sandboxfriend' : 'Share link or token'}
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCompareUsername()
            }}
          />
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-xl bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
            disabled={!usernameInput.trim() || loading}
            onClick={onCompareUsername}
          >
            Compare
          </button>
        </div>

        {isPlay ?
          <div className="flex items-center justify-between gap-2 border-t border-dc-border pt-2">
            <p className="text-xs text-dc-muted">Advanced — link or token</p>
            <button
              type="button"
              className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-text hover:border-dc-accent/40"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Hide' : 'Show'}
            </button>
          </div>
        : null}

        {(showAdvanced || !isPlay) && isPlay ?
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
              placeholder="https://…/play/summer-camp/s/…"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCompareAdvanced()
              }}
            />
            <button
              type="button"
              className="shrink-0 rounded-xl border border-dc-border px-4 py-2 text-sm font-medium text-dc-text hover:bg-dc-elevated-muted disabled:opacity-50"
              disabled={!tokenInput.trim() || loading}
              onClick={onCompareAdvanced}
            >
              Load link
            </button>
          </div>
        : null}
      </div>

      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      {loading ? <p className="text-sm text-dc-muted">Loading…</p> : null}

      {shared && isPlay ?
        <PlaySpaceCompareBoard
          scope={scope}
          shareToken={activeToken}
          timezone={shared.timezone}
          hostFreeGaps={shared.freeGaps}
          mutualFreeGaps={mutualGaps}
          windowStartsAt={shared.conventionStartsAt}
          windowEndsAt={shared.conventionEndsAt}
          viewerProfile={viewerProfile}
          hostProfile={hostProfile}
          hasViewerCalendar={viewerCalStatus === 'ready'}
        />
      : null}

      {shared && !isPlay ?
        <div className="space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/95/50 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-dc-muted">Partner</p>
            <p className="text-lg font-semibold text-dc-text">
              {shared.sharer?.displayName?.trim() || shared.sharer?.username || 'Shared dancecard'}
            </p>
          </div>
          <ConventionDancecardCompareGrid
            hostFreeGaps={shared.freeGaps}
            conventionStartsAt={shared.conventionStartsAt}
            conventionEndsAt={shared.conventionEndsAt}
            timezone={shared.timezone}
            viewerCal={viewerCal}
            viewerCalStatus={viewerCalStatus}
            compact
          />
        </div>
      : null}
    </div>
  )
}
