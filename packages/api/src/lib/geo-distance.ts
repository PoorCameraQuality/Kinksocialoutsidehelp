/** Great-circle distance in miles (Earth radius ≈ 3958.8 mi). */
export function haversineDistanceMi(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return 3958.8 * c
}

export function parseProfileGeoPoint(geoJson: unknown): { lat: number; lng: number } | null {
  if (!geoJson || typeof geoJson !== 'object') return null
  const g = geoJson as { type?: string; coordinates?: unknown }
  if (g.type !== 'Point' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) return null
  const lng = Number(g.coordinates[0])
  const lat = Number(g.coordinates[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}
