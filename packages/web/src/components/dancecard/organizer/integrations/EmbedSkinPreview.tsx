'use client'

import { useMemo } from 'react'

export function EmbedSkinPreview({
  eventSlug,
  token,
  kind = 'schedule',
}: {
  eventSlug: string
  token: string | null
  kind?: 'schedule' | 'map'
}) {
  const src = useMemo(() => {
    if (!token || typeof window === 'undefined') return null
    const path =
      kind === 'map'
        ? `/embed/dancecard/${encodeURIComponent(eventSlug)}/map`
        : `/embed/dancecard/${encodeURIComponent(eventSlug)}/schedule`
    return `${window.location.origin}${path}?token=${encodeURIComponent(token)}`
  }, [eventSlug, token, kind])

  if (!src) {
    return (
      <p className="mt-3 text-xs text-dc-muted">
        Mint an embed token to preview how the schedule skin renders in an iframe before copying the URL.
      </p>
    )
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Live embed preview</p>
      <div className="overflow-hidden rounded-xl border border-dc-border bg-dc-surface">
        <iframe title="Embed skin preview" src={src} className="h-[280px] w-full border-0 bg-dc-elevated" />
      </div>
    </div>
  )
}
