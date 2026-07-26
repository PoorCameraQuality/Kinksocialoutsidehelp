import type { ZipPlaceCandidate } from '@/lib/profile-edit-location'

type Props = {
  candidates: ZipPlaceCandidate[]
  selectedPlaceId: string | null
  onSelect: (placeId: string) => void
  zipLocality?: string | null
  className?: string
}

function formatPopulation(n: number): string {
  if (n <= 0) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M people`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k people`
  return `${n.toLocaleString()} people`
}

export default function ZipLocationCandidatePicker({
  candidates,
  selectedPlaceId,
  onSelect,
  zipLocality,
  className = '',
}: Props) {
  if (candidates.length === 0) return null

  return (
    <div className={`mt-3 space-y-2 ${className}`}>
      <p className="text-sm font-medium text-dc-text">Choose your area</p>
      <p className="text-xs text-dc-text-muted">
        {zipLocality ?
          `Near ${zipLocality} — tap the city you want on your profile.`
        : 'Tap the city you want shown on your profile.'}
      </p>
      <ul className="space-y-2" role="listbox" aria-label="Nearby places">
        {candidates.map((candidate) => {
          const selected = selectedPlaceId === candidate.placeId
          return (
            <li key={candidate.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(candidate.placeId)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  selected
                    ? 'border-dc-accent bg-dc-accent-muted/40 ring-1 ring-dc-accent/50'
                    : 'border-dc-border bg-dc-surface-muted/60 hover:border-dc-accent-border/50 hover:bg-dc-elevated-muted'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-dc-text">{candidate.display}</p>
                    <p className="mt-0.5 text-xs text-dc-text-muted">
                      {[
                        candidate.isZipMatch ? 'ZIP match' : null,
                        candidate.population > 0 ? formatPopulation(candidate.population) : null,
                        candidate.distanceMi != null ? `~${candidate.distanceMi} mi` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {selected ?
                    <span className="shrink-0 rounded-full bg-dc-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
                      Selected
                    </span>
                  : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      {!selectedPlaceId ?
        <p className="text-xs text-amber-300/90" role="status">
          Select a city to set your displayable location.
        </p>
      : (
        <p className="text-xs text-emerald-300/90" role="status">
          Profile location: {candidates.find((c) => c.placeId === selectedPlaceId)?.display}
        </p>
      )}
    </div>
  )
}
