import type { ReactNode } from 'react'

import { Link } from 'react-router-dom'

import LandingPreviewEventRow from '@/components/landing/LandingPreviewEventRow'

import LandingPreviewEducatorRow from '@/components/landing/LandingPreviewEducatorRow'

import { mockEvents, mockPeople } from '@/data/mock-data'



const SAMPLE_ACTIVITY = [

  { user: 'RopeDreamer', action: 'shared an event', time: '1h ago', initial: 'R' },

  { user: 'LeatherMama', action: 'joined a group', time: '3h ago', initial: 'L' },

  { user: 'DungeonHost', action: 'posted in a discussion', time: '5h ago', initial: 'D' },

] as const



function PreviewPanel({

  title,

  footerHref,

  footerLabel,

  children,

}: {

  title: string

  footerHref?: string

  footerLabel?: string

  children: ReactNode

}) {

  return (

    <article className="preview-card flex h-full flex-col">

      <div className="mb-4 flex min-h-11 items-center justify-between gap-2">

        <h3 className="text-base font-bold text-[var(--pub-text)]">{title}</h3>

        {footerHref && footerLabel ?

          <Link to={footerHref} className="shrink-0 text-sm font-semibold text-[var(--pub-gold-bright)] hover:underline">

            {footerLabel}

          </Link>

        : null}

      </div>

      <div className="min-h-0 flex-1">{children}</div>

    </article>

  )

}



export default function LandingDiscoveryPreview() {

  const educators = mockPeople.filter((p) => p.verified).slice(0, 3)

  const events = mockEvents.slice(0, 3)



  return (

    <section className="pb-16 pt-4 lg:pb-20" aria-labelledby="landing-preview-heading">

      <div className="public-container">

        <header className="mb-8 lg:mb-10">

          <h2 id="landing-preview-heading" className="text-2xl font-bold text-[var(--pub-text)] lg:text-3xl">

            A glimpse of the community

          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--pub-text-muted)] lg:text-base">

            Public preview. Community data may be limited during beta. After you join, discovery uses real events and

            people near you.

          </p>

        </header>



        <div className="preview-grid">

          <PreviewPanel title="Upcoming events" footerHref="/events" footerLabel="View all">

            <ul className="divide-y divide-white/10">

              {events.map((event) => (

                <li key={event.id} className="py-1 first:pt-0 last:pb-0">

                  <LandingPreviewEventRow event={event} />

                </li>

              ))}

            </ul>

          </PreviewPanel>



          <PreviewPanel title="Community activity" footerHref="/home?mode=discover&tab=Local" footerLabel="See all">

            <ul className="space-y-4">

              {SAMPLE_ACTIVITY.map((row) => (

                <li key={row.user} className="flex gap-3">

                  <span

                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(216,173,54,0.15)] text-sm font-semibold text-[var(--pub-gold-bright)] ring-1 ring-[rgba(216,173,54,0.3)]"

                    aria-hidden

                  >

                    {row.initial}

                  </span>

                  <div className="min-w-0 text-sm">

                    <p className="text-[var(--pub-text)]">

                      <span className="font-semibold">{row.user}</span>{' '}

                      <span className="text-[var(--pub-text-muted)]">{row.action}</span>

                    </p>

                    <p className="text-xs text-[var(--pub-text-soft)]">{row.time}</p>

                  </div>

                </li>

              ))}

            </ul>

            <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-[var(--pub-text-soft)]">

              Illustrative activity during beta. Sign in to see updates from your network.

            </p>

          </PreviewPanel>



          <PreviewPanel title="Featured educators" footerHref="/presenters" footerLabel="View all">

            <ul className="divide-y divide-white/10">

              {educators.map((person) => (

                <li key={person.id} className="py-1 first:pt-0 last:pb-0">

                  <LandingPreviewEducatorRow person={person} />

                </li>

              ))}

            </ul>

          </PreviewPanel>

        </div>

      </div>

    </section>

  )

}

