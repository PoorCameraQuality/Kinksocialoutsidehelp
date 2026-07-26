import { Link } from 'react-router-dom'

import { demoMockImageUrl } from '@/data/mock-data'



type EventLike = {

  id: number | string

  title: string

  date: string

  location: string

  rsvpCount?: number

  imageUrl?: string | null

}



export default function LandingPreviewEventRow({ event }: { event: EventLike }) {

  const img = event.imageUrl ?? demoMockImageUrl(`landing-event-${String(event.id)}`, 160, 120)

  const interested = event.rsvpCount ?? 0



  return (

    <Link

      to={`/events/${event.id}`}

      className="event-preview-row flex min-h-11 gap-3 rounded-xl border border-transparent p-1.5 transition-colors hover:border-white/10 hover:bg-white/[0.03]"

    >

      <img

        src={img}

        alt=""

        className="h-14 w-14 shrink-0 rounded-lg object-cover"

        loading="lazy"

        decoding="async"

      />

      <span className="min-w-0 flex-1">

        <span className="block truncate text-sm font-semibold text-[var(--pub-text)]">{event.title}</span>

        <span className="mt-0.5 block text-xs text-[var(--pub-gold-bright)]">{event.date}</span>

        <span className="block truncate text-xs text-[var(--pub-text-soft)]">{event.location}</span>

        {interested > 0 ?

          <span className="mt-0.5 block text-[11px] text-[var(--pub-text-soft)]">{interested} interested</span>

        : null}

      </span>

      <span className="shrink-0 self-center text-[var(--pub-gold-bright)]" aria-hidden>

        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">

          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />

        </svg>

      </span>

    </Link>

  )

}

