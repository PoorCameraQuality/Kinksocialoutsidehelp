/** City dropdown: state-only profile location */
import { formatPlaceLocationLabel } from '@c2k/shared'

export const PLACE_STATE_ONLY = '__state_only__'
/** City dropdown: free-text town not in list */
export const PLACE_CUSTOM = '__custom__'

type LocationState = {
  locationsMode: 'loading' | 'ok' | 'off'
  location: string
  placeSelect: string
  customLocation: string
  stateId: string
  states: { id: string; name: string }[]
  places: { id: string; name: string }[]
}

/** Human-readable location string for preview / storage. */
export function formatProfileLocationDisplay(state: LocationState): string {
  const { locationsMode, location, placeSelect, customLocation, stateId, states, places } = state
  if (locationsMode === 'ok') {
    if (placeSelect === PLACE_CUSTOM) return customLocation.trim() || location
    if (placeSelect === PLACE_STATE_ONLY) return states.find((s) => s.id === stateId)?.name ?? ''
    if (placeSelect) {
      const pl = places.find((p) => p.id === placeSelect)
      const st = states.find((s) => s.id === stateId)
      if (pl && st) return formatPlaceLocationLabel(pl.name, st.name)
    }
    return location
  }
  return location
}

export type ZipPlaceCandidate = {
  placeId: string
  display: string
  population: number
  distanceMi: number | null
  isZipMatch: boolean
}

export type ZipLookupResponse = {
  matchType?: 'exact' | 'nearest'
  display?: string
  zipLocality?: string
  distanceMi?: number
  placeId?: string
  stateId?: string
  stateName?: string
  candidates?: ZipPlaceCandidate[]
}

export function formatZipLookupHint(data: ZipLookupResponse): string | null {
  if (data.matchType === 'nearest' && data.display && data.zipLocality) {
    const miles = data.distanceMi != null ? ` (~${data.distanceMi} mi)` : ''
    return `${data.display}. Nearest city to ${data.zipLocality}${miles}`
  }
  return data.display?.trim() || null
}
