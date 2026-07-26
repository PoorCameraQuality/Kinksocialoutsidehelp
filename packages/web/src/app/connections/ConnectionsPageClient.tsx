import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TabContentTransition } from '@/components/dancecard/ui/TabContentTransition'
import ConnectionPersonRow from '@/components/connections/ConnectionPersonRow'
import ConnectionsRightRail from '@/components/connections/ConnectionsRightRail'
import ConnectionsSendRequestPanel from '@/components/connections/ConnectionsSendRequestPanel'
import ConnectionsTabs from '@/components/connections/ConnectionsTabs'
import {
  buildConnectionContextLine,
  type ConnTab,
} from '@/components/connections/connections-ui'
import type { PersonHint } from '@/components/connections/connections-ui'
import PersonalUtilityPageShell from '@/components/layout/PersonalUtilityPageShell'
import NotificationsEmptyPanel from '@/components/notifications/NotificationsEmptyPanel'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import StatusBanner from '@/components/ui/StatusBanner'
import type { ConnectionRow, FollowRow, SuggestedPerson } from '@/app/connections/connections-types'
import { useAuth } from '@/contexts/AuthContext'
import {
  CONNECTIONS_EMPTY_BODY,
  CONNECTIONS_EMPTY_TITLE,
  FOLLOW_VS_CONNECT_LONG,
  FOLLOW_VS_CONNECT_SHORT,
} from '@/lib/social-graph-copy'

const actionBtn =
  'inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-sm font-medium text-dc-text hover:border-dc-accent-border hover:bg-dc-elevated-muted'
const actionBtnGold =
  'inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-3 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50'

function otherUsername(c: ConnectionRow): string {
  return c.otherPartyUsername ?? ((c.isOutgoing ? c.recipientUsername : c.requesterUsername) ?? (c.isOutgoing ? c.recipientId : c.requesterId))
}

function connectionPartyMeta(c: ConnectionRow, hint?: PersonHint) {
  return {
    displayName: c.otherPartyDisplayName ?? hint?.displayName,
    avatarUrl: c.otherPartyAvatarUrl ?? hint?.avatarUrl,
  }
}

function matchesSearch(q: string, username: string, displayName?: string | null): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return (
    username.toLowerCase().includes(needle) ||
    (displayName?.toLowerCase().includes(needle) ?? false)
  )
}

export default function ConnectionsPageClient() {
  const { isAuthenticated, status } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as ConnTab) || 'connections'
  const setTab = (t: ConnTab) => {
    setSearchParams(t === 'connections' ? {} : { tab: t }, { replace: true })
  }

  const [items, setItems] = useState<ConnectionRow[]>([])
  const [following, setFollowing] = useState<FollowRow[]>([])
  const [followers, setFollowers] = useState<FollowRow[]>([])
  const [suggested, setSuggested] = useState<SuggestedPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [requestNotice, setRequestNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [respondNotice, setRespondNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [recipientUsername, setRecipientUsername] = useState('')
  const [sendPanelOpen, setSendPanelOpen] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [respondBusyId, setRespondBusyId] = useState<string | null>(null)
  const [followBusy, setFollowBusy] = useState<string | null>(null)
  const [disconnectId, setDisconnectId] = useState<string | null>(null)
  const [keepFollowing, setKeepFollowing] = useState(true)
  const [disconnectBusy, setDisconnectBusy] = useState(false)
  const [listSearch, setListSearch] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const loadFollows = useCallback(async () => {
    if (!isAuthenticated) {
      setFollowing([])
      setFollowers([])
      return
    }
    try {
      const [f1, f2] = await Promise.all([
        fetch('/api/v1/me/follows?direction=following', { credentials: 'include' }),
        fetch('/api/v1/me/follows?direction=followers', { credentials: 'include' }),
      ])
      if (f1.ok) {
        const d = (await f1.json()) as { items: FollowRow[] }
        setFollowing(d.items ?? [])
      }
      if (f2.ok) {
        const d = (await f2.json()) as { items: FollowRow[] }
        setFollowers(d.items ?? [])
      }
    } catch {
      setFollowing([])
      setFollowers([])
    }
  }, [isAuthenticated])

  const loadSuggested = useCallback(async () => {
    if (!isAuthenticated) {
      setSuggested([])
      return
    }
    try {
      const r = await fetch('/api/v1/connections/suggested?source=co_attendance&limit=8', {
        credentials: 'include',
      })
      if (!r.ok) {
        setSuggested([])
        return
      }
      const data = (await r.json()) as { items: SuggestedPerson[] }
      setSuggested(data.items ?? [])
    } catch {
      setSuggested([])
    }
  }, [isAuthenticated])

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch('/api/v1/connections', { credentials: 'include' })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setLoadError(j.error ?? `HTTP ${r.status}`)
        setItems([])
        return
      }
      const data = (await r.json()) as { items: ConnectionRow[] }
      setItems(data.items ?? [])
    } catch {
      setLoadError('Failed to load connections')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (status !== 'ready') return
    void load()
    void loadFollows()
    void loadSuggested()
  }, [status, load, loadFollows, loadSuggested])

  const hintByUsername = useMemo(() => {
    const m = new Map<string, PersonHint>()
    for (const p of suggested) {
      m.set(p.username.toLowerCase(), {
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        sharedCount: p.sharedCount,
        location: p.location ?? null,
      })
    }
    return m
  }, [suggested])

  const acceptedUsernames = useMemo(() => {
    const s = new Set<string>()
    for (const c of items) {
      if (c.status !== 'ACCEPTED') continue
      const u = c.isOutgoing ? c.recipientUsername : c.requesterUsername
      if (u) s.add(u.toLowerCase())
    }
    return s
  }, [items])

  const tabCounts = useMemo(
    () => ({
      connections: items.filter((c) => c.status === 'ACCEPTED').length,
      requests: items.filter((c) => c.status === 'PENDING').length,
      following: following.length,
      followers: followers.length,
      ignored: items.filter((c) => c.status === 'IGNORED').length,
    }),
    [items, following.length, followers.length],
  )

  const incomingRequests = useMemo(
    () => items.filter((c) => c.status === 'PENDING' && !c.isOutgoing),
    [items],
  )

  const visibleConnections = useMemo(() => {
    let list: ConnectionRow[] | FollowRow[] = []
    if (tab === 'requests') list = items.filter((c) => c.status === 'PENDING')
    else if (tab === 'ignored') list = items.filter((c) => c.status === 'IGNORED')
    else if (tab === 'connections') list = items.filter((c) => c.status === 'ACCEPTED')
    else if (tab === 'following') list = following
    else if (tab === 'followers') list = followers
    else list = items

    if (tab === 'following' || tab === 'followers') {
      const q = listSearch.trim().toLowerCase()
      if (!q) return list as FollowRow[]
      return (list as FollowRow[]).filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.displayName?.toLowerCase().includes(q) ?? false),
      )
    }

    const sorted = [...(list as ConnectionRow[])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    const q = listSearch.trim()
    if (!q) return sorted
    return sorted.filter((c) => {
      const u = otherUsername(c)
      const hint = hintByUsername.get(u.toLowerCase())
      return matchesSearch(q, u, hint?.displayName)
    })
  }, [items, tab, listSearch, following, followers, hintByUsername])

  useEffect(() => {
    if (!requestNotice || requestNotice.kind !== 'success') return
    const timer = window.setTimeout(() => setRequestNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [requestNotice])

  useEffect(() => {
    if (!respondNotice || respondNotice.kind !== 'success') return
    const timer = window.setTimeout(() => setRespondNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [respondNotice])

  const sendRequest = async (usernameOverride?: string) => {
    const u = (usernameOverride ?? recipientUsername).trim()
    if (!u || requestBusy) return
    setRequestBusy(true)
    setRequestNotice(null)
    try {
      const r = await fetch('/api/v1/connections/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUsername: u }),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setRequestNotice({ kind: 'error', text: j.error ?? `HTTP ${r.status}` })
        return
      }
      if (!usernameOverride) setRecipientUsername('')
      setRequestNotice({ kind: 'success', text: `Connection request sent to @${u}.` })
      setSendPanelOpen(false)
      await load()
    } catch {
      setRequestNotice({ kind: 'error', text: 'Request failed. Check your connection and try again.' })
    } finally {
      setRequestBusy(false)
    }
  }

  const accept = async (id: string) => {
    if (respondBusyId) return
    setRespondBusyId(id)
    setRespondNotice(null)
    try {
      const r = await fetch(`/api/v1/connections/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        credentials: 'include',
      })
      if (r.ok) {
        setRespondNotice({ kind: 'success', text: 'Connection accepted.' })
        await load()
        return
      }
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setRespondNotice({ kind: 'error', text: j.error ?? 'Could not accept request.' })
    } finally {
      setRespondBusyId(null)
    }
  }

  const decline = async (id: string) => {
    if (respondBusyId) return
    setRespondBusyId(id)
    setRespondNotice(null)
    try {
      const r = await fetch(`/api/v1/connections/${encodeURIComponent(id)}/decline`, {
        method: 'POST',
        credentials: 'include',
      })
      if (r.ok) {
        setRespondNotice({ kind: 'success', text: 'Request declined.' })
        await load()
        return
      }
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      setRespondNotice({ kind: 'error', text: j.error ?? 'Could not decline request.' })
    } finally {
      setRespondBusyId(null)
    }
  }

  const cancelRequest = async (id: string) => {
    if (respondBusyId) return
    setRespondBusyId(id)
    try {
      const r = await fetch(`/api/v1/connections/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        credentials: 'include',
      })
      if (r.ok) {
        setRespondNotice({ kind: 'success', text: 'Request cancelled.' })
        await load()
      }
    } finally {
      setRespondBusyId(null)
    }
  }

  const ignore = async (id: string) => {
    if (respondBusyId) return
    setRespondBusyId(id)
    try {
      const r = await fetch(`/api/v1/connections/${encodeURIComponent(id)}/ignore`, {
        method: 'POST',
        credentials: 'include',
      })
      if (r.ok) {
        setRespondNotice({ kind: 'success', text: 'Moved to Ignored.' })
        await load()
      }
    } finally {
      setRespondBusyId(null)
    }
  }

  const unignore = async (id: string) => {
    if (respondBusyId) return
    setRespondBusyId(id)
    try {
      const r = await fetch(`/api/v1/connections/${encodeURIComponent(id)}/unignore`, {
        method: 'POST',
        credentials: 'include',
      })
      if (r.ok) {
        setRespondNotice({ kind: 'success', text: 'Request restored to pending.' })
        await load()
      }
    } finally {
      setRespondBusyId(null)
    }
  }

  const disconnect = async () => {
    if (!disconnectId || disconnectBusy) return
    setDisconnectBusy(true)
    try {
      const r = await fetch(`/api/v1/connections/${encodeURIComponent(disconnectId)}/disconnect`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepFollowing }),
      })
      if (r.ok) {
        setDisconnectId(null)
        setRespondNotice({
          kind: 'success',
          text: keepFollowing ? 'Disconnected. You still follow them.' : 'Disconnected.',
        })
        await load()
        await loadFollows()
      }
    } finally {
      setDisconnectBusy(false)
    }
  }

  const followUser = async (username: string) => {
    if (followBusy) return
    setFollowBusy(username)
    try {
      const r = await fetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, {
        method: 'POST',
        credentials: 'include',
      })
      if (r.ok) await loadFollows()
    } finally {
      setFollowBusy(null)
    }
  }

  const unfollowUser = async (username: string) => {
    if (followBusy) return
    setFollowBusy(username)
    try {
      const r = await fetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (r.ok) await loadFollows()
    } finally {
      setFollowBusy(null)
    }
  }

  const renderConnectionRow = (c: ConnectionRow) => {
    const username = otherUsername(c)
    const hint = hintByUsername.get(username.toLowerCase())
    const party = connectionPartyMeta(c, hint)
    const contextLine = buildConnectionContextLine(c.status, c.createdAt, hint, { isOutgoing: c.isOutgoing })

    if (c.status === 'ACCEPTED') {
      return (
        <ConnectionPersonRow
          key={c.id}
          username={username}
          displayName={party.displayName}
          avatarUrl={party.avatarUrl}
          contextLine={contextLine}
          connectedBadge
          overflow={[
            {
              label: 'Disconnect',
              destructive: true,
              onClick: () => {
                setDisconnectId(c.id)
                setKeepFollowing(true)
              },
            },
            { label: 'Report', onClick: () => window.location.assign('/support') },
          ]}
        >
          <Link to={`/messaging?user=${encodeURIComponent(username)}`} className={actionBtnGold}>
            Message
          </Link>
          <Link to={`/profile/${encodeURIComponent(username)}`} className={actionBtn}>
            View profile
          </Link>
        </ConnectionPersonRow>
      )
    }

    if (c.status === 'PENDING') {
      if (c.isOutgoing) {
        return (
          <ConnectionPersonRow
            key={c.id}
            username={username}
            displayName={party.displayName}
            avatarUrl={party.avatarUrl}
            contextLine={contextLine}
            overflow={[
              {
                label: 'Cancel request',
                destructive: true,
                onClick: () => void cancelRequest(c.id),
              },
            ]}
          >
            <Link to={`/profile/${encodeURIComponent(username)}`} className={actionBtn}>
              View profile
            </Link>
          </ConnectionPersonRow>
        )
      }
      return (
        <ConnectionPersonRow
          key={c.id}
          username={username}
          displayName={party.displayName}
          avatarUrl={party.avatarUrl}
          contextLine={contextLine}
          overflow={[{ label: 'Ignore', onClick: () => void ignore(c.id) }]}
        >
          <button
            type="button"
            disabled={respondBusyId !== null}
            onClick={() => void accept(c.id)}
            className={actionBtnGold}
          >
            {respondBusyId === c.id ? 'Accepting…' : 'Accept'}
          </button>
          <button
            type="button"
            disabled={respondBusyId !== null}
            onClick={() => void decline(c.id)}
            className={actionBtn}
          >
            Decline
          </button>
          <Link to={`/profile/${encodeURIComponent(username)}`} className={actionBtn}>
            View profile
          </Link>
        </ConnectionPersonRow>
      )
    }

    if (c.status === 'IGNORED') {
      return (
        <ConnectionPersonRow
          key={c.id}
          username={username}
          displayName={party.displayName}
          avatarUrl={party.avatarUrl}
          contextLine={contextLine}
          overflow={[{ label: 'Unignore', onClick: () => void unignore(c.id) }]}
        >
          <Link to={`/profile/${encodeURIComponent(username)}`} className={actionBtn}>
            View profile
          </Link>
        </ConnectionPersonRow>
      )
    }

    return null
  }

  const renderFollowRow = (u: FollowRow, mode: 'following' | 'followers') => {
    const connected = acceptedUsernames.has(u.username.toLowerCase())
    const hint = hintByUsername.get(u.username.toLowerCase())
    const contextParts: string[] = []
    if (hint?.sharedCount && hint.sharedCount > 0) {
      contextParts.push(`${hint.sharedCount} mutual event${hint.sharedCount === 1 ? '' : 's'}`)
    }
    contextParts.push(mode === 'following' ? 'Following' : 'Follows you')

    return (
      <ConnectionPersonRow
        key={u.id}
        username={u.username}
        displayName={u.displayName ?? hint?.displayName}
        avatarUrl={u.avatarUrl ?? hint?.avatarUrl}
        contextLine={contextParts.join(' · ')}
        overflow={
          mode === 'followers' ?
            [{ label: 'View on profile', onClick: () => window.location.assign(`/profile/${u.username}`) }]
          : undefined
        }
      >
        {mode === 'following' ?
          <>
            <Link to={`/profile/${encodeURIComponent(u.username)}`} className={actionBtn}>
              View profile
            </Link>
            <button
              type="button"
              disabled={followBusy !== null}
              onClick={() => void unfollowUser(u.username)}
              className={actionBtn}
            >
              {followBusy === u.username ? '…' : 'Unfollow'}
            </button>
            {connected ?
              <Link to={`/messaging?user=${encodeURIComponent(u.username)}`} className={actionBtnGold}>
                Message
              </Link>
            : null}
          </>
        : <>
            <button
              type="button"
              disabled={followBusy !== null}
              onClick={() => void followUser(u.username)}
              className={actionBtnGold}
            >
              {followBusy === u.username ? '…' : 'Follow back'}
            </button>
            <Link to={`/profile/${encodeURIComponent(u.username)}`} className={actionBtn}>
              View profile
            </Link>
          </>
        }
      </ConnectionPersonRow>
    )
  }

  const tabIntro = useMemo(() => {
    switch (tab) {
      case 'following':
        return 'People you follow. Their public activity can appear in your Following feed.'
      case 'followers':
        return 'People who follow you. Following back can help you stay connected.'
      case 'ignored':
        return 'People you have ignored or hidden.'
      case 'requests':
        return 'Incoming and outgoing connection requests. Accept to connect, or ignore requests you do not want.'
      default:
        return null
    }
  }, [tab])

  const emptyPanel = () => {
    switch (tab) {
      case 'connections':
        return (
          <NotificationsEmptyPanel
            title={CONNECTIONS_EMPTY_TITLE}
            message={CONNECTIONS_EMPTY_BODY}
            actions={[
              { label: 'Find people', href: '/people', primary: true },
              { label: 'Explore groups', href: '/groups' },
              { label: 'Browse events', href: '/events' },
            ]}
          />
        )
      case 'requests':
        return (
          <NotificationsEmptyPanel
            title="No pending requests"
            message="Connection requests you send or receive will appear here."
            actions={[{ label: 'People', href: '/people', primary: true }]}
          />
        )
      case 'following':
        return (
          <NotificationsEmptyPanel
            title="Not following anyone yet"
            message="Follow organizers, presenters, vendors, and people you want to keep up with."
            actions={[
              { label: 'People', href: '/people', primary: true },
              { label: 'Browse presenters', href: '/presenters' },
            ]}
          />
        )
      case 'followers':
        return (
          <NotificationsEmptyPanel
            title="No followers yet"
            message="When others follow you, they appear here."
          />
        )
      case 'ignored':
        return (
          <NotificationsEmptyPanel
            title="No ignored users"
            message="People you ignore or hide will appear here."
          />
        )
      default:
        return null
    }
  }

  const requestSections = tab === 'requests' && visibleConnections.length > 0 && (
    <div className="space-y-8">
      {(['incoming', 'outgoing'] as const).map((section) => {
        const rows = (visibleConnections as ConnectionRow[]).filter((c) =>
          section === 'incoming' ? !c.isOutgoing : c.isOutgoing,
        )
        if (rows.length === 0) return null
        return (
          <section key={section}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dc-muted">
              {section === 'incoming' ? 'Incoming' : 'Outgoing'}
            </h2>
            <ul className="space-y-3">{rows.map(renderConnectionRow)}</ul>
          </section>
        )
      })}
    </div>
  )

  const mainList = () => {
    if (loading) {
      return (
        <ul className="space-y-3" aria-busy="true" role="status">
          {[1, 2, 3].map((i) => (
            <li key={i} className="h-24 animate-pulse rounded-2xl bg-dc-elevated-muted" />
          ))}
        </ul>
      )
    }
    if (visibleConnections.length === 0) return emptyPanel()
    if (tab === 'following' || tab === 'followers') {
      return (
        <ul className="space-y-3">
          {(visibleConnections as FollowRow[]).map((u) => renderFollowRow(u, tab))}
        </ul>
      )
    }
    if (tab === 'requests') return requestSections
    return <ul className="space-y-3">{(visibleConnections as ConnectionRow[]).map(renderConnectionRow)}</ul>
  }

  return (
    <PersonalUtilityPageShell
      showMobileNavToggle
      mobileNavOpen={mobileNavOpen}
      onMobileNavToggle={() => setMobileNavOpen((o) => !o)}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <header className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-dc-text sm:text-3xl">Connections</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-text-muted">
                {FOLLOW_VS_CONNECT_SHORT}{' '}
                <span className="text-dc-text-muted" title={FOLLOW_VS_CONNECT_LONG}>
                  Pending requests need your response before you are mutually connected.
                </span>
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link to="/people" className={`${actionBtnGold} justify-center px-5 sm:min-w-[10rem]`}>
                  People
                </Link>
              </div>
              <ConnectionsSendRequestPanel
                open={sendPanelOpen}
                onToggle={() => setSendPanelOpen((o) => !o)}
                username={recipientUsername}
                onUsernameChange={(v) => {
                  setRecipientUsername(v)
                  if (requestNotice) setRequestNotice(null)
                }}
                busy={requestBusy}
                onSubmit={() => void sendRequest()}
                notice={requestNotice}
                onDismissNotice={() => setRequestNotice(null)}
              />
            </header>

            <ConnectionsTabs active={tab} counts={tabCounts} onChange={setTab} />

            {tabIntro ?
              <p className="mb-4 text-sm text-dc-text-muted">{tabIntro}</p>
            : null}

            {!loading &&
            (tab === 'connections' ||
              tab === 'requests' ||
              tab === 'following' ||
              tab === 'followers' ||
              tab === 'ignored') ?
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="sr-only" htmlFor="conn-list-search">
                  Search
                </label>
                <input
                  id="conn-list-search"
                  type="search"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder={
                    tab === 'connections' ? 'Search your connections…'
                    : tab === 'requests' ? 'Search requests…'
                    : 'Search…'
                  }
                  className="min-h-11 flex-1 rounded-xl border border-dc-border bg-[var(--dc-input)] px-3 text-sm text-dc-text"
                />
                {tab === 'connections' ?
                  <span className="text-xs text-dc-muted sm:shrink-0">Sort: Recently added</span>
                : null}
              </div>
            : null}

            {loadError ?
              <LoadErrorBanner className="mb-4" message={loadError} onRetry={() => void load()} />
            : null}

            {respondNotice ?
              <StatusBanner tone={respondNotice.kind === 'success' ? 'success' : 'error'} className="mb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <p className="flex-1">{respondNotice.text}</p>
                  {respondNotice.kind === 'error' ?
                    <button
                      type="button"
                      onClick={() => setRespondNotice(null)}
                      className="min-h-10 shrink-0 rounded-xl border border-dc-border px-3 text-sm"
                    >
                      Dismiss
                    </button>
                  : null}
                </div>
              </StatusBanner>
            : null}

            <TabContentTransition tabKey={tab}>{mainList()}</TabContentTransition>
          </div>

          <ConnectionsRightRail
            incomingRequests={incomingRequests}
            suggested={suggested}
            onAccept={(id) => void accept(id)}
            onDecline={(id) => void decline(id)}
            respondBusyId={respondBusyId}
            onConnectUsername={(u) => void sendRequest(u)}
          />
        </div>
      </div>

      {disconnectId ?
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md w-full space-y-4 rounded-2xl border border-dc-border bg-dc-elevated p-6">
            <h2 className="text-lg font-semibold text-dc-text">Disconnect?</h2>
            <p className="text-sm text-dc-text-muted">
              You will no longer be mutual connections. Direct messages may require a new request.
            </p>
            <label className="flex items-center gap-2 text-sm text-dc-text">
              <input
                type="checkbox"
                checked={keepFollowing}
                onChange={(e) => setKeepFollowing(e.target.checked)}
                className="rounded border-dc-border"
              />
              Keep following them
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDisconnectId(null)} className={actionBtn}>
                Cancel
              </button>
              <button
                type="button"
                disabled={disconnectBusy}
                onClick={() => void disconnect()}
                className={actionBtnGold}
              >
                {disconnectBusy ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      : null}
    </PersonalUtilityPageShell>
  )
}
