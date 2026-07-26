export type ConnTab = 'connections' | 'followers' | 'following' | 'ignored' | 'requests'

export const CONN_TABS: { id: ConnTab; label: string }[] = [
  { id: 'connections', label: 'Connections' },
  { id: 'requests', label: 'Requests' },
  { id: 'following', label: 'Following' },
  { id: 'followers', label: 'Followers' },
  { id: 'ignored', label: 'Ignored' },
]

export function formatConnectedSince(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export type PersonHint = {
  displayName?: string | null
  avatarUrl?: string | null
  sharedCount?: number
  location?: string | null
}

export function buildConnectionContextLine(
  status: string,
  createdAt: string,
  hint: PersonHint | undefined,
  opts?: { isOutgoing?: boolean },
): string {
  const parts: string[] = []
  const shared = hint?.sharedCount
  if (shared != null && shared > 0) {
    parts.push(`${shared} mutual event${shared === 1 ? '' : 's'}`)
  }
  const loc = hint?.location?.trim()
  if (loc) parts.push(loc)
  if (status === 'ACCEPTED') {
    const since = formatConnectedSince(createdAt)
    if (since) parts.push(`Connected since ${since}`)
  } else if (status === 'PENDING') {
    parts.push(opts?.isOutgoing ? 'Request sent' : 'Incoming request')
  } else if (status === 'IGNORED') {
    parts.push('Ignored')
  }
  return parts.join(' · ') || (opts?.isOutgoing ? 'Outgoing' : 'Incoming')
}
