import type { MapZonePin } from '@/lib/dancecard/mapPinZones'

/** Pin overlay label: custom pin label, then room name from Settings → Rooms. */
export function mapPinDisplayName(
  pin: Pick<MapZonePin, 'label' | 'locationId'>,
  locationNames: Record<string, string>,
): string {
  return pin.label?.trim() || locationNames[pin.locationId]?.trim() || 'Unnamed room'
}
