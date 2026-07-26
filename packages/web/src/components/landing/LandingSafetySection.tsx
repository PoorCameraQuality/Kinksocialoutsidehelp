import { Link } from 'react-router-dom'
import { LANDING_SAFETY_BODY, LANDING_SAFETY_HEADLINE } from '@/components/landing/landing-content'

export default function LandingSafetySection() {
  return (
    <section className="landing-safety-section" aria-labelledby="landing-safety-heading">
      <div className="public-container">
        <div className="landing-safety-panel pub-animate">
          <div className="landing-safety-panel__copy">
            <h2 id="landing-safety-heading" className="landing-safety-panel__title">
              {LANDING_SAFETY_HEADLINE}
            </h2>
            <p className="landing-safety-panel__body">{LANDING_SAFETY_BODY}</p>
            <Link to="/guidelines" className="landing-safety-panel__link">
              Read community guidelines →
            </Link>
          </div>
          <ul className="landing-safety-list" aria-label="Trust and safety features">
            {[
              '18+ community standards',
              'Privacy-first profile controls',
              'Report and block tools',
              'Organizer accountability',
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
