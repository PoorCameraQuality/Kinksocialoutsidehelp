import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'

type Props = {
  userId?: string | number
  username: string
  displayName?: string | null
  subtitle?: string | null
  avatarUrl?: string | null
}

export default function HomeFeedSuggestedPerson({
  username,
  displayName,
  subtitle,
  avatarUrl,
}: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const name = displayName ?? username

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dc-border/80 bg-dc-surface-muted/40 p-2">
      <Link to={`/profile/${encodeURIComponent(username)}`} className="shrink-0">
        {avatarUrl ?
          <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        : <PlaceholderAvatar size="sm" className="!h-10 !w-10" />}
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/profile/${encodeURIComponent(username)}`} className="block truncate text-sm font-medium text-dc-text hover:text-dc-accent">
          {name}
        </Link>
        {subtitle ? <p className="truncate text-xs text-dc-text-muted">{subtitle}</p> : null}
      </div>
      <Link
        to={`/profile/${encodeURIComponent(username)}`}
        className="shrink-0 rounded-lg border border-dc-border px-2.5 py-1 text-xs font-medium text-dc-text-muted hover:border-dc-border-strong hover:bg-dc-elevated-hover hover:text-dc-text"
      >
        View profile
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-dc-muted hover:bg-dc-elevated-hover hover:text-dc-text"
        aria-label={`Dismiss ${name}`}
      >
        ×
      </button>
    </div>
  )
}
