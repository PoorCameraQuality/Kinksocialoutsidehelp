import { Link } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import type { PlaceMapPin } from '@/components/places/place-map-types'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type Props = {
  places: PlaceMapPin[]
  className?: string
  singlePinZoom?: number
}

export default function CommunityPlacesMapInner({ places, className, singlePinZoom = 13 }: Props) {
  const first = places[0]!
  const center: [number, number] = [first.lat!, first.lng!]
  const zoom = places.length === 1 ? singlePinZoom : 5

  return (
    <div className={`overflow-hidden rounded-2xl border border-dc-border ${className}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {places.map((p) => (
          <Marker key={p.id} position={[p.lat!, p.lng!]}>
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{p.name}</p>
                {(p.city || p.region) ?
                  <p className="text-gray-600">{[p.city, p.region].filter(Boolean).join(', ')}</p>
                : null}
                <Link to={`/places/${encodeURIComponent(p.slug)}`} className="font-semibold text-blue-700">
                  View place
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
