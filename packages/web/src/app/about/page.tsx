import { Link } from 'react-router-dom'
import { ECKE_KINK_SOCIAL_EXPLAINER_PATH, ECKE_URL } from '@c2k/shared'

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-dc-text mb-2">About Kink Social</h1>
        <p className="text-sm text-dc-text-muted leading-relaxed">
          Kink Social is consent-first kink social media for the BDSM and fetish lifestyle — events, groups, profiles,
          messaging, and organizer tools. Built for real community, not as a generic social feed clone.
        </p>
      </header>

      <section className="mb-8 space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6">
        <h2 className="text-lg font-semibold text-dc-text">What we do</h2>
        <p className="text-sm text-dc-text-muted leading-relaxed">
          We help kink, BDSM, and fetish communities run conventions and local events with registration, door tools,
          programs, vendor halls, and member directories. Members discover events, follow organizations, message safely,
          and build trust over time — whether you are new to the scene or coming from FetLife, Recon, or local groups.
        </p>
      </section>

      <section className="mb-8 space-y-4 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6">
        <h2 className="text-lg font-semibold text-dc-text">Who we serve</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-dc-text-muted">
          <li>
            <strong className="text-dc-text">Organizers</strong>. Conventions, groups, and venues that need workflow tools, not
            just a Facebook event page.
          </li>
          <li>
            <strong className="text-dc-text">Attendees</strong>. Profiles, RSVPs, messaging, and convention programs in one place.
          </li>
          <li>
            <strong className="text-dc-text">Vendors &amp; educators</strong>. Shops, classes, and presenter catalogs linked to
            real events.
          </li>
        </ul>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-text-muted">
        <h2 className="text-lg font-semibold text-dc-text">Public event discovery</h2>
        <p>
          Kink Social is the private member and organizer platform. Public event discovery, education, and regional
          directories live on{' '}
          <a
            href={`${ECKE_URL}${ECKE_KINK_SOCIAL_EXPLAINER_PATH}`}
            className="text-dc-accent hover:underline"
            rel="noopener noreferrer"
          >
            East Coast Kink Events
          </a>
          .
        </p>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-text-muted">
        <h2 className="text-lg font-semibold text-dc-text">Explore</h2>
        <p>
          <Link to="/events" className="text-dc-accent hover:underline">
            Events
          </Link>
          {' · '}
          <Link to="/orgs" className="text-dc-accent hover:underline">
            Organizations
          </Link>
          {' · '}
          <Link to="/groups" className="text-dc-accent hover:underline">
            Groups
          </Link>
          {' · '}
          <Link to="/presenters" className="text-dc-accent hover:underline">
            Presenters
          </Link>
        </p>
        <p>
          Questions or safety concerns? Visit{' '}
          <Link to="/support" className="text-dc-accent hover:underline">
            Help &amp; support
          </Link>
          .
        </p>
      </section>

      <Link
        to="/home"
        className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-4 text-sm text-dc-text-muted hover:text-dc-text"
      >
        Back to home
      </Link>
    </div>
  )
}
