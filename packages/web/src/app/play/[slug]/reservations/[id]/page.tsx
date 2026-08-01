import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import PlaySpaceReservations from '@/components/play/reservations/PlaySpaceReservations'
import { fetchPlaySpace, type PlaySpaceListItem } from '@/hooks/useApiPlaySpaces'
import {
  appearanceVarsToStyle,
  getAppearancePreset,
  PLAY_SURFACE_APPEARANCE,
} from '@/lib/dancecard/appearancePresets'

export default function PlaySpaceReservationDetailPage() {
  const { slug = '', id = '' } = useParams()
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
        {!space && !error ? <p className="text-sm text-dc-muted">Loading…</p> : null}
        {error ? (
          <div>
            <p className="text-sm text-red-300">{error}</p>
            <Link to={`/play/${encodeURIComponent(slug)}/reservations`} className="mt-3 inline-block text-sm text-dc-accent">
              Back to Reservations
            </Link>
          </div>
        ) : null}
        {space ? (
          <PlaySpaceReservations slug={slug} timezone={space.timezone} selectedId={id} />
        ) : null}
      </div>
    </div>
  )
}
