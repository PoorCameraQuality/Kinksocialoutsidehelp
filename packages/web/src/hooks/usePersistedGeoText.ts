import { useEffect, useState } from 'react'

const STORAGE_KEY = 'c2k:browse-geo'

export type DistanceUnit = 'mi' | 'km'

type StoredGeo = {
  country?: string
  city?: string
  distanceUnit?: DistanceUnit
}

function readStored(): StoredGeo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredGeo
    return {
      country: typeof parsed.country === 'string' ? parsed.country : '',
      city: typeof parsed.city === 'string' ? parsed.city : '',
      distanceUnit: parsed.distanceUnit === 'km' ? 'km' : 'mi',
    }
  } catch {
    return {}
  }
}

/** Persists country/city browse filters across People, Events, Groups browse surfaces. */
export function usePersistedGeoText() {
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('mi')

  useEffect(() => {
    const stored = readStored()
    setCountry(stored.country ?? '')
    setCity(stored.city ?? '')
    setDistanceUnit(stored.distanceUnit ?? 'mi')
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ country, city, distanceUnit }))
    } catch {
      /* ignore quota / private mode */
    }
  }, [country, city, distanceUnit])

  return { country, setCountry, city, setCity, distanceUnit, setDistanceUnit }
}
