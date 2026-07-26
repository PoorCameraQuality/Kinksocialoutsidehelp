import { Link } from 'react-router-dom'
import { LANDING_ORGANIZER_BETA } from '@/components/landing/landing-beta-content'

export default function LandingOrganizerBetaSection() {
  return (
    <section id="organizers" className="beta-section" aria-labelledby="landing-organizer-title">
      <div className="public-container">
        <div className="beta-organizer-panel">
          <div>
            <p className="beta-kicker beta-kicker--gold">{LANDING_ORGANIZER_BETA.kicker}</p>
            <h2 id="landing-organizer-title" className="beta-section__title">
              {LANDING_ORGANIZER_BETA.title}
            </h2>
            <p className="beta-section__copy">{LANDING_ORGANIZER_BETA.body}</p>
            <div style={{ marginTop: 28 }}>
              <Link to="/organizer" className="beta-btn beta-btn--secondary">
                {LANDING_ORGANIZER_BETA.cta}
              </Link>
            </div>
          </div>
          <div className="beta-toolstack">
            {LANDING_ORGANIZER_BETA.tools.map((tool) => (
              <div key={tool.title} className="beta-tool">
                <b>{tool.title}</b>
                <span>{tool.body}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
