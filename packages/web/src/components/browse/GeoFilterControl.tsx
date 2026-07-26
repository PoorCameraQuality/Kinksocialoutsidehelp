import TextInput from '@/components/ui/TextInput'
import { MAX_DISTANCE_MI } from '@/lib/discovery-utils'

import type { DistanceUnit } from '@/hooks/usePersistedGeoText'

export type GeoFilterControlProps = {
  idPrefix: string
  distance: number
  onDistanceChange: (value: number) => void
  country: string
  onCountryChange: (value: string) => void
  city: string
  onCityChange: (value: string) => void
  maxDistance?: number
  distanceStep?: number
  distanceUnit?: DistanceUnit
  onDistanceUnitChange?: (unit: DistanceUnit) => void
}

const fieldClass = 'min-h-11 rounded-xl'

/** Shared country / city / radius control for browse surfaces (SG-135). */
export default function GeoFilterControl({
  idPrefix,
  distance,
  onDistanceChange,
  country,
  onCountryChange,
  city,
  onCityChange,
  maxDistance = MAX_DISTANCE_MI,
  distanceStep = 25,
  distanceUnit = 'mi',
  onDistanceUnitChange,
}: GeoFilterControlProps) {
  const countryId = `${idPrefix}-geo-country`
  const cityId = `${idPrefix}-geo-city`
  const distanceId = `${idPrefix}-geo-distance`
  const anyDistance = distance >= maxDistance

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={countryId} className="block text-sm font-medium text-dc-text-muted mb-2">
          Country
        </label>
        <TextInput
          id={countryId}
          type="text"
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          placeholder="e.g. United States"
          autoComplete="country-name"
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor={cityId} className="block text-sm font-medium text-dc-text-muted mb-2">
          City or region
        </label>
        <TextInput
          id={cityId}
          type="text"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="e.g. Philadelphia, PA"
          autoComplete="address-level2"
          className={fieldClass}
        />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <label htmlFor={distanceId} className="text-sm font-medium text-dc-text-muted">
            Radius: {anyDistance ? 'Any' : `${distance} ${distanceUnit}`}
          </label>
          {onDistanceUnitChange ?
            <div className="flex rounded-lg border border-dc-border overflow-hidden text-xs">
              {(['mi', 'km'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onDistanceUnitChange(u)}
                  className={`px-2 py-1 ${distanceUnit === u ? 'bg-dc-accent/20 text-dc-accent' : 'text-dc-muted'}`}
                >
                  {u}
                </button>
              ))}
            </div>
          : null}
        </div>
        <input
          id={distanceId}
          type="range"
          min="0"
          max={maxDistance}
          step={distanceStep}
          value={distance}
          onChange={(e) => onDistanceChange(Number(e.target.value))}
          className="w-full accent-dc-accent"
        />
      </div>
    </div>
  )
}
