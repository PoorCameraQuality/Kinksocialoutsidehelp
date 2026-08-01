import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import PlaySpaceReservations from '@/components/play/reservations/PlaySpaceReservations'
import { fetchPlaySpace, type PlaySpaceListItem } from '@/hooks/useApiPlaySpaces'
import {
  appearanceVarsToStyle,
  getAppearancePreset,
  PLAY_SURFACE_APPEARANCE,
} from '@/lib/dancecard/appearancePresets'

export default function PlaySpaceReservationsPage() {
  const { slug = '' } = useParams()
  const [space, setSpace] = useState<PlaySpaceListItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  const theme = getAppearancePreset(PLAY_SURFACE_APPEARANCE)
  const themeStyle = appearanceVarsToStyle(theme.vars, theme.mode)

  const load = useCallback(async () => {
    if (!slug) return
    try {
      setSpace(await fetchPlaySpace(slug))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load play space')
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div
      className="dc-gold-chrome min-h-dvh text-dc-text"
      data-dc-appearance={PLAY_SURFACE_APPEARANCE}
      style={themeStyle as CSSProperties}
    >
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        <header className="mb-4 flex items-center justify-between gap-2">
          <Link
            to={`/play/${encodeURIComponent(slug)}`}
            className="min-h-11 text-sm font-medium text-dc-text-muted"
          >
            ‹ More
          </Link>
          <p className="text-sm font-semibold text-dc-text">Reservations</p>
          <span className="w-12" />
        </header>
        {space?.title ? (
          <p className="mb-2 text-[13px] text-dc-muted">{space.title}</p>
        ) : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {space ? (
          <PlaySpaceReservations slug={slug} timezone={space.timezone} />
        ) : !error ? (
          <p className="text-sm text-dc-muted">Loading…</p>
        ) : null}
      </div>
    </div>
  )
}
