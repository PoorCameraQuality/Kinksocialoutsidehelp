import { Suspense } from 'react'
import EventDetailClient from './EventDetailClient'

function EventDetailFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6" aria-busy="true" aria-live="polite">
      <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
      <div className="mt-6 h-10 max-w-md animate-pulse rounded-lg bg-white/5" />
      <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/5" />
    </div>
  )
}

export default function EventDetailPage() {
  return (
    <Suspense fallback={<EventDetailFallback />}>
      <EventDetailClient />
    </Suspense>
  )
}
