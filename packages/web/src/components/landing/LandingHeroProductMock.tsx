import { Link } from 'react-router-dom'

/** Static product preview for the landing hero — decorative UI only, no live data. */
export default function LandingHeroProductMock() {
  return (
    <div className="landing-product-mock" aria-label="Platform preview">
      <div className="landing-product-mock__atmosphere" aria-hidden />
      <div className="landing-product-mock__panel">
        <p className="landing-product-mock__label">What you get inside</p>

        <div className="landing-product-mock__stack">
          <Link to="/events" className="landing-mock-card landing-mock-card--event">
            <span className="landing-mock-card__eyebrow">Upcoming event</span>
            <span className="landing-mock-card__title">Weekend munch · RSVP open</span>
            <span className="landing-mock-card__meta">Saturday · Downtown · Schedule attached</span>
          </Link>

          <Link to="/groups" className="landing-mock-card landing-mock-card--group">
            <span className="landing-mock-card__eyebrow">Active group</span>
            <span className="landing-mock-card__title">Local rope community</span>
            <span className="landing-mock-card__meta">Forum · Events · Member directory</span>
          </Link>

          <Link to="/education" className="landing-mock-card landing-mock-card--education">
            <span className="landing-mock-card__eyebrow">Education</span>
            <span className="landing-mock-card__title">Presenter workshop series</span>
            <span className="landing-mock-card__meta">Skills, safety, and consent-first learning</span>
          </Link>

          <Link to="/organizer" className="landing-mock-card landing-mock-card--organizer">
            <span className="landing-mock-card__eyebrow">Organizer console</span>
            <span className="landing-mock-card__title">Roster · Check-in · Schedule</span>
            <span className="landing-mock-card__tools">
              <span>Door</span>
              <span>Roles</span>
              <span>Reports</span>
            </span>
          </Link>
        </div>

        <div className="landing-mock-safety">
          <span className="landing-mock-safety__icon" aria-hidden>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </span>
          <span>
            <span className="landing-mock-safety__title">Privacy & safety built in</span>
            <span className="landing-mock-safety__body">Reporting, blocking, and profile controls</span>
          </span>
        </div>
      </div>
    </div>
  )
}
