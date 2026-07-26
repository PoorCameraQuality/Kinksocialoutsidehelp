'use client'

import { organizerConventionApiBase } from '@/components/dancecard/organizer/organizerApi'

export function BadgeQr({
  eventSlug,
  registrantId,
  size = 72,
}: {
  eventSlug: string
  registrantId: string
  size?: number
}) {
  const src = `${organizerConventionApiBase(eventSlug)}/registrants/${encodeURIComponent(registrantId)}/qr`
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="rounded bg-white p-0.5" />
  )
}
