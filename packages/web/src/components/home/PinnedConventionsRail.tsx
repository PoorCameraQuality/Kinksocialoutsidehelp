'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type PinItem = {
  convention: {
    slug: string
    name: string
    heroImage: string | null
    accent: string | null
  }
  latestAnnouncement: {
    id: string
    bodyExcerpt: string
    authorUsername: string | null
  } | null
  unreadChatCount: number
}

export default function PinnedConventionsRail() {
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

  if (!loaded || items.length === 0) return null

  return (
    <section className="mb-8 space-y-3" aria-label="From your conventions">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-dc-muted">From your conventions</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((pin) => {
          const slug = pin.convention.slug
          const accent = pin.convention.accent ?? undefined
          return (
            <article
              key={slug}
              className="w-[min(100%,320px)] shrink-0 overflow-hidden rounded-2xl border border-dc-border bg-dc-elevated/95"
              style={accent ? { borderColor: `${accent}44` } : undefined}
            >
              {pin.convention.heroImage ?
                <div
                  className="h-20 bg-cover bg-center"
                  style={{ backgroundImage: `url(${JSON.stringify(pin.convention.heroImage)})` }}
                />
              : (
                <div className="h-20 bg-gradient-to-br from-dc-accent/30 to-slate-900" />
              )}
              <div className="space-y-2 p-4">
                <p className="font-semibold text-dc-text line-clamp-1">{pin.convention.name}</p>
                {pin.latestAnnouncement ?
                  <div className="text-xs text-dc-text-muted">
                    <p className="font-medium text-dc-muted">Latest announcement</p>
                    <p className="mt-1 line-clamp-2">{pin.latestAnnouncement.bodyExcerpt}</p>
                    {pin.latestAnnouncement.authorUsername ?
                      <p className="mt-1 text-dc-muted">, {pin.latestAnnouncement.authorUsername}</p>
                    : null}
                  </div>
                : (
                  <p className="text-xs text-dc-muted">No new announcements</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    to={`/conventions/${encodeURIComponent(slug)}?tab=Chat`}
                    className="inline-flex min-h-9 items-center rounded-lg border border-dc-border px-3 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted"
                  >
                    Chat
                    {pin.unreadChatCount > 0 ?
                      <span className="ml-2 rounded-full bg-dc-accent px-2 py-0.5 text-[10px] font-bold text-dc-text">
                        {pin.unreadChatCount}
                      </span>
                    : null}
                  </Link>
                  <Link
                    to={`/conventions/${encodeURIComponent(slug)}`}
                    className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-medium text-dc-accent hover:underline"
                  >
                    Open
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
