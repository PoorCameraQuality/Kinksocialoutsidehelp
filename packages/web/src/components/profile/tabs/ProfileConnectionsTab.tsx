import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ConnectionPersonRow from '@/components/connections/ConnectionPersonRow'
import EmptyState from '@/components/ui/EmptyState'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'
import Card from '@/components/ui/Card'

export type ProfileConnectionItem = {
  username: string
  displayName: string | null
  avatarUrl: string | null
  connectedAt: string
}

type Props = {
  username: string
  listVisible: boolean
  totalCount: number
  mutualCount: number | null
  viewerIsOwner: boolean
}

function formatConnectedDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Recently connected'
  return `Since ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
}

export default function ProfileConnectionsTab({
  username,
  listVisible,
  totalCount,
  mutualCount,
  viewerIsOwner,
}: Props) {
  const [items, setItems] = useState<ProfileConnectionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadConnections = useCallback(async () => {
    if (!listVisible) {
      setItems([])
      setLoadError(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(username)}/connections`, {
        credentials: 'include',
      })
      if (res.status === 403) {
        setItems([])
        setLoadError(null)
        return
      }
      if (!res.ok) {
        setLoadError('Could not load connections.')
        setItems([])
        return
      }
      const data = (await res.json()) as { items?: ProfileConnectionItem[] }
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch {
      setLoadError('Could not load connections.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [username, listVisible])

  useEffect(() => {
    void loadConnections()
  }, [loadConnections])

  if (!listVisible) {
    return (
      <Card padding="lg">
        <EmptyState
          title="Connections list is private"
          message={
            mutualCount != null && mutualCount > 0
              ? `You and @${username} have ${mutualCount} mutual ${mutualCount === 1 ? 'connection' : 'connections'}.`
              : `@${username} has not shared their connections list with you.`
          }
          inline
        />
      </Card>
    )
  }

  return (
    <Card padding="lg" className="max-sm:!p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 sm:mb-4 sm:gap-3">
        <div>
          <h2 className="text-base font-semibold text-dc-text sm:text-lg">Connections</h2>
          <p className="mt-0.5 text-xs text-dc-text-muted sm:mt-1 sm:text-sm">
            {viewerIsOwner
              ? 'Accepted connections on your profile.'
              : `Accepted connections for @${username}.`}
          </p>
          {viewerIsOwner ?
            <p className="mt-1 hidden text-xs text-dc-muted sm:block">Manage privacy in Settings.</p>
          : null}
          {mutualCount != null && mutualCount > 0 && !viewerIsOwner ?
            <p className="mt-1.5 text-xs text-dc-muted sm:mt-2">
              {mutualCount} mutual {mutualCount === 1 ? 'connection' : 'connections'}
            </p>
          : null}
        </div>
        {viewerIsOwner ?
          <Link
            to="/settings/privacy"
            className="shrink-0 text-xs font-medium text-dc-accent hover:underline sm:text-sm"
          >
            Privacy settings
          </Link>
        : null}
      </div>

      {loadError ?
        <LoadErrorBanner message={loadError} onRetry={() => void loadConnections()} />
      : loading ?
        <p className="text-sm text-dc-muted" aria-busy="true">
          Loading connections…
        </p>
      : items.length === 0 ?
        <EmptyState
          title="No connections yet"
          message={
            viewerIsOwner
              ? 'When you accept connection requests, members you allow can see them here.'
              : 'This member has not shared any connections yet.'
          }
          inline
          ctaLabel={viewerIsOwner ? 'View requests' : undefined}
          ctaHref={viewerIsOwner ? '/connections?tab=requests' : undefined}
        />
      : (
        <ul className="space-y-2 pb-2 sm:space-y-3 sm:pb-0">
          {items.map((item) => (
            <ConnectionPersonRow
              key={item.username}
              username={item.username}
              displayName={item.displayName}
              avatarUrl={item.avatarUrl}
              contextLine={formatConnectedDate(item.connectedAt)}
              connectedBadge
            />
          ))}
        </ul>
      )}

      {viewerIsOwner && totalCount > 0 ?
        <p className="mt-4 text-xs text-dc-muted">
          Showing {items.length} of {totalCount} accepted{' '}
          {totalCount === 1 ? 'connection' : 'connections'}.
        </p>
      : null}
    </Card>
  )
}
