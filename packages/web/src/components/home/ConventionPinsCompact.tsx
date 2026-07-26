import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type PinItem = {
  convention: {
    slug: string
    name: string
  }
  latestAnnouncement: {
    bodyExcerpt: string
    authorUsername: string | null
  } | null
  unreadChatCount: number
}

/** Slim convention hub row - lives inside the feed column, not as a homepage billboard. */
export default function ConventionPinsCompact() {
  const [items, setItems] = useState<PinItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/me/convention-pins', { credentials: 'include' })
      if (!r.ok) {
        setItems([])
        return
      }
      const d = (await r.json()) as { items: PinItem[] }
      setItems(d.items ?? [])
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const actionable = items.filter((p) => p.unreadChatCount > 0 || p.latestAnnouncement != null)
  if (!loaded || actionable.length === 0) return null

  const sorted = [...actionable].sort((a, b) => {
    const score = (p: PinItem) => (p.unreadChatCount > 0 ? 2 : 0) + (p.latestAnnouncement ? 1 : 0)
    return score(b) - score(a)
  })

  return (
    <div className="mb-5 rounded-xl border border-dc-border/80 bg-dc-surface-muted/40 px-3 py-2.5" aria-label="Convention hubs you follow">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-dc-muted">Convention hubs</p>
        <Link to="/events" className="text-xs text-dc-accent hover:underline">
          All events
        </Link>
      </div>
      <ul className="space-y-1.5">
        {sorted.slice(0, 4).map((pin) => {
          const slug = pin.convention.slug
          const hasNews = pin.unreadChatCount > 0 || pin.latestAnnouncement
          return (
            <li key={slug}>
              <div className="flex flex-wrap items-center gap-2 rounded-lg px-1 py-1 hover:bg-dc-elevated-muted/60">
                <Link
                  to={`/conventions/${encodeURIComponent(slug)}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-dc-text hover:text-dc-accent"
                >
                  {pin.convention.name}
                </Link>
                {pin.unreadChatCount > 0 ?
                  <Link
                    to={`/conventions/${encodeURIComponent(slug)}?tab=Chat`}
                    className="inline-flex shrink-0 items-center rounded-md bg-dc-accent/20 px-2 py-0.5 text-xs font-medium text-dc-accent"
                  >
                    Chat · {pin.unreadChatCount}
                  </Link>
                : null}
                {hasNews && pin.latestAnnouncement ?
                  <span className="w-full text-xs text-dc-muted line-clamp-1 sm:w-auto sm:flex-1 sm:min-w-[8rem]">
                    {pin.latestAnnouncement.bodyExcerpt}
                  </span>
                : null}
                <Link
                  to={`/conventions/${encodeURIComponent(slug)}`}
                  className="shrink-0 text-xs font-medium text-dc-accent hover:underline"
                >
                  Open
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
