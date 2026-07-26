import { useCallback, useEffect, useState } from 'react'

type Country = { id: string; code: string; name: string }
type StateRow = { id: string; fips: string; name: string }
type PlaceRow = { id: string; name: string; population: number }

type Props = {
  value: string | null
  onChange: (placeId: string | null) => void
  disabled?: boolean
  idPrefix?: string
}

const selectClass =
  'w-full min-h-10 rounded-xl border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text'

export default function PlaceRegionPicker({ value, onChange, disabled, idPrefix = 'place' }: Props) {
  const [mode, setMode] = useState<'loading' | 'ok' | 'off'>('loading')
  const [countries, setCountries] = useState<Country[]>([])
  const [countryId, setCountryId] = useState('')
  const [states, setStates] = useState<StateRow[]>([])
  const [stateId, setStateId] = useState('')
  const [places, setPlaces] = useState<PlaceRow[]>([])
  const [placeId, setPlaceId] = useState<string>(value ?? '')

  useEffect(() => {
    setPlaceId(value ?? '')
  }, [value])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/locations/countries', { credentials: 'include' })
        if (!r.ok) {
          if (!cancelled) setMode('off')
          return
        }
        const j = (await r.json()) as { countries?: Country[] }
        if (cancelled) return
        const list = j.countries ?? []
        setCountries(list)
        const us = list.find((c) => c.code === 'US') ?? list[0]
        if (us) setCountryId(us.id)
        setMode('ok')
      } catch {
        if (!cancelled) setMode('off')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadStates = useCallback(async (cid: string) => {
    const r = await fetch(`/api/locations/states?country_id=${encodeURIComponent(cid)}`, {
      credentials: 'include',
    })
    if (!r.ok) return
    const j = (await r.json()) as { states?: StateRow[] }
    setStates(j.states ?? [])
  }, [])

  const loadPlaces = useCallback(async (sid: string) => {
    const r = await fetch(`/api/locations/places?state_id=${encodeURIComponent(sid)}`, {
      credentials: 'include',
    })
    if (!r.ok) return
    const j = (await r.json()) as { places?: PlaceRow[] }
    setPlaces(j.places ?? [])
  }, [])

  useEffect(() => {
    if (mode !== 'ok' || !countryId) return
    void loadStates(countryId)
  }, [mode, countryId, loadStates])

  useEffect(() => {
    if (!stateId) {
      setPlaces([])
      return
    }
    void loadPlaces(stateId)
  }, [stateId, loadPlaces])

  useEffect(() => {
    if (!value || mode !== 'ok' || states.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const st of states) {
        const r = await fetch(`/api/locations/places?state_id=${encodeURIComponent(st.id)}`, {
          credentials: 'include',
        })
        if (!r.ok || cancelled) continue
        const j = (await r.json()) as { places?: PlaceRow[] }
        const hit = (j.places ?? []).find((p) => p.id === value)
        if (hit) {
          setStateId(st.id)
          setPlaceId(value)
          setPlaces(j.places ?? [])
          break
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [value, mode, states])

  if (mode === 'loading') {
    return <p className="text-sm text-dc-muted">Loading regions…</p>
  }
  if (mode === 'off') {
    return (
      <p className="text-sm text-dc-muted">
        Location lists require the database. Set a place id via API when locations are unavailable.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {countries.length > 1 && (
        <div>
          <label htmlFor={`${idPrefix}-country`} className="block text-xs text-dc-muted mb-1">
            Country
          </label>
          <select
            id={`${idPrefix}-country`}
            value={countryId}
            disabled={disabled}
            onChange={(e) => {
              setCountryId(e.target.value)
              setStateId('')
              setPlaceId('')
              onChange(null)
            }}
            className={selectClass}
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-state`} className="block text-xs text-dc-muted mb-1">
          State / region
        </label>
        <select
          id={`${idPrefix}-state`}
          value={stateId}
          disabled={disabled}
          onChange={(e) => {
            setStateId(e.target.value)
            setPlaceId('')
            onChange(null)
          }}
          className={selectClass}
        >
          <option value="">Select state</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {stateId ? (
        <div>
          <label htmlFor={`${idPrefix}-city`} className="block text-xs text-dc-muted mb-1">
            City or town
          </label>
          <select
            id={`${idPrefix}-city`}
            value={placeId}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value
              setPlaceId(v)
              onChange(v || null)
            }}
            className={selectClass}
          >
            <option value="">No home region</option>
            {places.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  )
}
