import { Suspense } from 'react'
import ProfilePageClient from './ProfilePageClient'

function ProfileFallback() {
  return (
    <div
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      <div className="mt-6 h-24 animate-pulse rounded-xl bg-white/5" />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfilePageClient />
    </Suspense>
  )
}
