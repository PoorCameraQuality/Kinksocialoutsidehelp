import { Link } from 'react-router-dom'

import LandingDanceCardMock from '@/components/landing/LandingDanceCardMock'
import {
  LANDING_ORGANIZER_BODY,
  LANDING_ORGANIZER_HEADLINE,
  ORGANIZER_FEATURES,
} from '@/components/landing/landing-content'

export default function LandingOrganizerSection() {
  return (
    <section className="landing-organizer-section" aria-labelledby="landing-organizer-heading">
      <div className="public-container">
        <div className="landing-organizer-panel pub-animate">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--pub-gold-bright)]">
              For organizers
            </p>
            <h2 id="landing-organizer-heading" className="mt-2 text-2xl font-bold text-[var(--pub-text)] lg:text-3xl">
              {LANDING_ORGANIZER_HEADLINE}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--pub-text-muted)] lg:text-base">
              {LANDING_ORGANIZER_BODY}
            </p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {ORGANIZER_FEATURES.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-[var(--pub-text-muted)]">
                  <span className="text-[var(--pub-gold-bright)]" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/organizer" className="pub-primary-cta mt-8 inline-flex">
              Explore organizer tools
            </Link>
          </div>

          <LandingDanceCardMock />
        </div>
      </div>
    </section>
  )
}
