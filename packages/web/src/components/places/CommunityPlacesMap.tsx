import { lazy, Suspense } from 'react'
import type { PlaceMapPin } from '@/components/places/place-map-types'

const CommunityPlacesMapInner = lazy(() => import('@/components/places/CommunityPlacesMapInner'))

type Props = {
  places: PlaceMapPin[]
  className?: string
  singlePinZoom?: number
}

export default function CommunityPlacesMap({ places, className = 'h-72 w-full', singlePinZoom = 13 }: Props) {
  const mappable = places.filter((p) => p.lat != null && p.lng != null)
  if (mappable.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dc-border bg-dc-elevated/40 text-sm text-dc-text-muted ${className}`}
      >
        Map pins appear when venues add latitude and longitude.
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div
          className={`animate-pulse rounded-2xl border border-dc-border bg-dc-elevated/40 ${className}`}
          aria-busy="true"
        />
      }
    >
      <CommunityPlacesMapInner places={mappable} className={className} singlePinZoom={singlePinZoom} />
    </Suspense>
  )
}
